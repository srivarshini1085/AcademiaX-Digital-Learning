package com.academiax.payment.service;

import com.academiax.payment.client.EnrollmentClient;
import com.academiax.payment.dto.PaymentRequest;
import com.academiax.payment.dto.PaymentResponse;
import com.academiax.payment.entity.IdempotencyRecord;
import com.academiax.payment.entity.Payment;
import com.academiax.payment.entity.PaymentStatus;
import com.academiax.payment.exception.*;
import com.academiax.payment.repository.IdempotencyRecordRepository;
import com.academiax.payment.repository.PaymentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final EnrollmentClient enrollmentClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public PaymentResponse processPayment(PaymentRequest request, String idempotencyKey, Long authenticatedUserId, String userRole) {
        // Idempotency check: if key provided and already processed, return cached response
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<IdempotencyRecord> recordOpt = idempotencyRecordRepository.findByIdempotencyKey(idempotencyKey.trim());
            if (recordOpt.isPresent()) {
                try {
                    log.info("Idempotency hit for key: {}", idempotencyKey);
                    return objectMapper.readValue(recordOpt.get().getResponseJson(), PaymentResponse.class);
                } catch (JsonProcessingException e) {
                    log.error("Failed to deserialize idempotency record", e);
                }
            }
        }

        if (authenticatedUserId == null) {
            throw new ForbiddenException("Authentication required to make a payment");
        }

        // Load the enrollment as the caller, so enrollment-service enforces ownership (403 for someone else's).
        Map<String, Object> enrollment = fetchEnrollment(request.getEnrollmentId(), authenticatedUserId, userRole);
        if (!"SEAT_HELD".equals(String.valueOf(enrollment.get("status")))) {
            throw new ConflictException("Enrollment is not awaiting payment (status: " + enrollment.get("status") + ")");
        }
        Long studentId = ((Number) enrollment.get("studentId")).longValue();

        // Tuition is always the amount stored on the enrollment, never a client-supplied figure.
        BigDecimal amount = new BigDecimal(String.valueOf(enrollment.get("tuitionFee")));

        String rawCardNumber = request.getCardNumber() != null ? request.getCardNumber().replaceAll("\\s+", "") : "";
        String cardLast4 = rawCardNumber.length() >= 4 ? rawCardNumber.substring(rawCardNumber.length() - 4) : "0000";

        // Simulated card rule: card ending with "0002" or "4000000000000002" always fails for demo
        boolean isSimulatedFailureCard = rawCardNumber.endsWith("0002") || rawCardNumber.contains("4000000000000002");

        Payment payment = Payment.builder()
                .enrollmentId(request.getEnrollmentId())
                .studentId(studentId)
                .amount(amount)
                .transactionRef("TXN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .cardLast4(cardLast4)
                .createdAt(LocalDateTime.now())
                .build();

        Payment saved;
        PaymentResponse response;

        if (isSimulatedFailureCard) {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason("Transaction declined: Simulated test failure card (4000...0002) used");
            saved = paymentRepository.save(payment);

            // Inform enrollment service about payment failure to release seat
            try {
                enrollmentClient.failEnrollment(request.getEnrollmentId(), payment.getFailureReason());
            } catch (Exception ex) {
                log.warn("Failed to notify enrollment service of payment failure: {}", ex.getMessage());
            }

            response = toResponse(saved);
        } else {
            payment.setStatus(PaymentStatus.SUCCESS);
            payment.setPaidAt(LocalDateTime.now());
            saved = paymentRepository.save(payment);

            // Inform enrollment service about payment success to confirm enrollment.
            // If it can't confirm (e.g. the hold expired a moment ago), reverse the charge instead of keeping the money.
            try {
                enrollmentClient.confirmEnrollment(request.getEnrollmentId(), saved.getId());
            } catch (Exception ex) {
                log.warn("Enrollment {} could not be confirmed, auto-refunding payment {}: {}",
                        request.getEnrollmentId(), saved.getId(), ex.getMessage());
                saved.setStatus(PaymentStatus.REFUNDED);
                saved.setFailureReason("Auto-refunded: enrollment could not be confirmed (hold may have expired)");
                saved = paymentRepository.save(saved);
            }

            response = toResponse(saved);
        }

        // Save idempotency record if key was provided
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            try {
                IdempotencyRecord record = IdempotencyRecord.builder()
                        .idempotencyKey(idempotencyKey.trim())
                        .responseJson(objectMapper.writeValueAsString(response))
                        .createdAt(LocalDateTime.now())
                        .build();
                idempotencyRecordRepository.save(record);
            } catch (Exception ex) {
                log.warn("Could not save idempotency record: {}", ex.getMessage());
            }
        }

        return response;
    }

    @Transactional
    public PaymentResponse confirmPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + paymentId));

        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaidAt(LocalDateTime.now());
        return toResponse(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentResponse failPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + paymentId));

        payment.setStatus(PaymentStatus.FAILED);
        payment.setFailureReason("Manual failure update");
        return toResponse(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentResponse refundPayment(Long paymentId, Long authenticatedUserId, String userRole) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + paymentId));

        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !payment.getStudentId().equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot refund another student's payment");
            }
        }

        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new ConflictException("Only successfully confirmed payments can be refunded. Current status: " + payment.getStatus());
        }

        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);

        // Notify enrollment service to refund enrollment and release seat (auto-promote waitlist)
        try {
            enrollmentClient.refundEnrollment(payment.getEnrollmentId());
        } catch (Exception ex) {
            log.warn("Failed to notify enrollment service of refund: {}", ex.getMessage());
        }

        return toResponse(saved);
    }

    public List<PaymentResponse> getByStudentId(Long studentId, Long authenticatedUserId, String userRole) {
        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !studentId.equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot view payments for other students");
            }
        }
        return paymentRepository.findByStudentId(studentId).stream().map(this::toResponse).toList();
    }

    public Page<PaymentResponse> searchPayments(PaymentStatus status, Long studentId, Pageable pageable) {
        return paymentRepository.searchPayments(status, studentId, pageable).map(this::toResponse);
    }

    public PaymentResponse getById(Long paymentId, Long authenticatedUserId, String userRole) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + paymentId));

        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !payment.getStudentId().equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot access this payment record");
            }
        }
        return toResponse(payment);
    }

    public Map<String, Object> getPaymentStats() {
        Map<String, Object> stats = new HashMap<>();
        BigDecimal totalRevenue = paymentRepository.calculateTotalRevenue();
        stats.put("totalRevenue", totalRevenue != null ? totalRevenue : BigDecimal.ZERO);
        stats.put("successfulPayments", paymentRepository.countByStatus(PaymentStatus.SUCCESS));
        stats.put("failedPayments", paymentRepository.countByStatus(PaymentStatus.FAILED));
        stats.put("refundedPayments", paymentRepository.countByStatus(PaymentStatus.REFUNDED));
        stats.put("totalTransactions", paymentRepository.count());
        return stats;
    }

    private Map<String, Object> fetchEnrollment(Long enrollmentId, Long userId, String role) {
        try {
            return enrollmentClient.getEnrollment(enrollmentId, userId, role);
        } catch (FeignException.Forbidden ex) {
            throw new ForbiddenException("You cannot pay for another student's enrollment");
        } catch (FeignException.NotFound ex) {
            throw new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId);
        }
    }

    private PaymentResponse toResponse(Payment payment) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .enrollmentId(payment.getEnrollmentId())
                .studentId(payment.getStudentId())
                .amount(payment.getAmount())
                .status(payment.getStatus())
                .transactionRef(payment.getTransactionRef())
                .failureReason(payment.getFailureReason())
                .cardLast4(payment.getCardLast4())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .build();
    }
}
