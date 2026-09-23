package com.academiax.enrollment.service;

import com.academiax.enrollment.client.CourseClient;
import com.academiax.enrollment.client.PaymentClient;
import com.academiax.enrollment.dto.EnrollmentRequest;
import com.academiax.enrollment.dto.EnrollmentResponse;
import com.academiax.enrollment.entity.Enrollment;
import com.academiax.enrollment.entity.EnrollmentStatus;
import com.academiax.enrollment.repository.EnrollmentRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final CourseClient courseClient;
    private final PaymentClient paymentClient;

    @Transactional
    @CircuitBreaker(name = "courseService", fallbackMethod = "fallbackEnrollment")
    @Retry(name = "courseService")
    public EnrollmentResponse enrollStudent(EnrollmentRequest request) {
        if (enrollmentRepository.findByStudentIdAndCourseId(request.getStudentId(), request.getCourseId()).isPresent()) {
            throw new IllegalArgumentException("Duplicate enrollment is not allowed");
        }

        Map<String, Object> course = courseClient.getCourse(request.getCourseId());
        if (course == null) {
            throw new IllegalArgumentException("Course not found");
        }

        Object availableSeatsObj = course.get("availableSeats");
        if (availableSeatsObj instanceof Number seats && seats.intValue() <= 0) {
            throw new IllegalArgumentException("No seats available");
        }

        Enrollment enrollment = Enrollment.builder()
                .studentId(request.getStudentId())
                .courseId(request.getCourseId())
                .status(EnrollmentStatus.PENDING)
                .enrolledAt(LocalDateTime.now())
                .build();
        Enrollment saved = enrollmentRepository.save(enrollment);

        try {
            courseClient.reserveSeat(request.getCourseId());
            Map<String, Object> paymentReq = new HashMap<>();
            paymentReq.put("studentId", request.getStudentId());
            paymentReq.put("enrollmentId", saved.getId());
            paymentReq.put("amount", 5000);

            Map<String, Object> payment = paymentClient.createPayment(paymentReq);
            if (payment == null || payment.get("id") == null) {
                throw new IllegalArgumentException("Payment failed");
            }

            saved.setStatus(EnrollmentStatus.CONFIRMED);
            enrollmentRepository.save(saved);
            return buildResponse(saved, payment);
        } catch (Exception ex) {
            saved.setStatus(EnrollmentStatus.PAYMENT_FAILED);
            enrollmentRepository.save(saved);
            try {
                courseClient.releaseSeat(request.getCourseId());
            } catch (Exception ignored) {
            }
            throw new IllegalArgumentException("Payment processing failed. Seat has been released.");
        }
    }

    public EnrollmentResponse getEnrollment(Long id) {
        Enrollment enrollment = enrollmentRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Enrollment not found"));
        return toResponse(enrollment);
    }

    public List<EnrollmentResponse> getByStudentId(Long studentId) {
        return enrollmentRepository.findByStudentId(studentId).stream().map(this::toResponse).toList();
    }

    public List<EnrollmentResponse> getByCourseId(Long courseId) {
        return enrollmentRepository.findByCourseId(courseId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public void cancelEnrollment(Long id) {
        Enrollment enrollment = enrollmentRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Enrollment not found"));
        enrollment.setStatus(EnrollmentStatus.CANCELLED);
        enrollmentRepository.save(enrollment);
        courseClient.releaseSeat(enrollment.getCourseId());
    }

    private EnrollmentResponse toResponse(Enrollment enrollment) {
        return EnrollmentResponse.builder()
                .id(enrollment.getId())
                .studentId(enrollment.getStudentId())
                .courseId(enrollment.getCourseId())
                .status(enrollment.getStatus())
                .enrolledAt(enrollment.getEnrolledAt())
                .build();
    }

    private EnrollmentResponse buildResponse(Enrollment enrollment, Map<String, Object> payment) {
        EnrollmentResponse response = toResponse(enrollment);
        response.setPaymentId(payment.get("id") != null ? Long.valueOf(payment.get("id").toString()) : null);
        response.setPaymentStatus(payment.get("status") != null ? payment.get("status").toString() : "SUCCESS");
        return response;
    }

    private EnrollmentResponse fallbackEnrollment(EnrollmentRequest request, Exception ex) {
        throw new IllegalArgumentException("Service unavailable. Please try again later.");
    }
}
