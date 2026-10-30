package com.academiax.payment.controller;

import com.academiax.payment.dto.PaymentRequest;
import com.academiax.payment.dto.PaymentResponse;
import com.academiax.payment.entity.PaymentStatus;
import com.academiax.payment.exception.ForbiddenException;
import com.academiax.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Tuition processing, simulated transactions, idempotency, and refunds")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Process tuition payment with Idempotency-Key support and test failure simulation")
    public ResponseEntity<PaymentResponse> createPayment(
            @Valid @RequestBody PaymentRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        PaymentResponse response = paymentService.processPayment(request, idempotencyKey, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Confirm payment (Internal Feign call with explicit @PathVariable)")
    public ResponseEntity<PaymentResponse> confirmPayment(@PathVariable("id") Long id) {
        return ResponseEntity.ok(paymentService.confirmPayment(id));
    }

    @PostMapping("/{id}/fail")
    @Operation(summary = "Mark payment failed")
    public ResponseEntity<PaymentResponse> failPayment(@PathVariable("id") Long id) {
        return ResponseEntity.ok(paymentService.failPayment(id));
    }

    @PostMapping("/{id}/refund")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Refund a confirmed payment and trigger compensating saga transaction")
    public ResponseEntity<PaymentResponse> refundPayment(
            @PathVariable("id") Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(paymentService.refundPayment(id, userId, role));
    }

    @GetMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all payments with filters and pagination (ADMIN only)")
    public ResponseEntity<Page<PaymentResponse>> getAllPayments(
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) Long studentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view all payment records");
        }
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(Sort.Direction.DESC, "id"));
        return ResponseEntity.ok(paymentService.searchPayments(status, studentId, pageRequest));
    }

    @GetMapping("/my")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment history for the logged-in student")
    public ResponseEntity<List<PaymentResponse>> getMyPayments(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (userId == null) {
            throw new ForbiddenException("Authentication required");
        }
        return ResponseEntity.ok(paymentService.getByStudentId(userId, userId, role));
    }

    @GetMapping("/student/{studentId}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payments for a specific student (Student himself or ADMIN)")
    public ResponseEntity<List<PaymentResponse>> getStudentPayments(
            @PathVariable("studentId") Long studentId,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(paymentService.getByStudentId(studentId, userId, role));
    }

    @GetMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment details by ID")
    public ResponseEntity<PaymentResponse> getById(
            @PathVariable("id") Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(paymentService.getById(id, userId, role));
    }

    @GetMapping("/stats")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment statistics, revenue total, and counts by status (ADMIN only)")
    public ResponseEntity<Map<String, Object>> getStats(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view financial metrics");
        }
        return ResponseEntity.ok(paymentService.getPaymentStats());
    }
}
