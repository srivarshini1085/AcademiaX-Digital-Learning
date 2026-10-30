package com.academiax.enrollment.controller;

import com.academiax.enrollment.dto.EnrollmentRequest;
import com.academiax.enrollment.dto.EnrollmentResponse;
import com.academiax.enrollment.entity.EnrollmentStatus;
import com.academiax.enrollment.exception.ForbiddenException;
import com.academiax.enrollment.service.EnrollmentService;
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
@RequestMapping("/enrollments")
@RequiredArgsConstructor
@Tag(name = "Enrollments", description = "Course enrollment saga, seat holds, waitlist, and lifecycle management")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    @PostMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Hold a seat in a course for 10 minutes (Saga Step 1)")
    public ResponseEntity<EnrollmentResponse> holdSeat(
            @Valid @RequestBody EnrollmentRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        EnrollmentResponse response = enrollmentService.holdSeat(request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/waitlist")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Join course waitlist when seats are full")
    public ResponseEntity<EnrollmentResponse> joinWaitlist(
            @RequestParam Long courseId,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        EnrollmentResponse response = enrollmentService.joinWaitlist(courseId, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Search enrollments across all students (ADMIN only)")
    public ResponseEntity<Page<EnrollmentResponse>> getEnrollments(
            @RequestParam(required = false) EnrollmentStatus status,
            @RequestParam(required = false) Long courseId,
            @RequestParam(required = false) Long studentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view all enrollments");
        }
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(Sort.Direction.DESC, "id"));
        return ResponseEntity.ok(enrollmentService.searchEnrollments(status, courseId, studentId, pageRequest));
    }

    @GetMapping("/my")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get enrollments for the logged-in student")
    public ResponseEntity<List<EnrollmentResponse>> getMyEnrollments(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (userId == null) {
            throw new ForbiddenException("Authentication required");
        }
        return ResponseEntity.ok(enrollmentService.getByStudentId(userId, userId, role));
    }

    @GetMapping("/course/{courseId}/roster")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Roster of a course: held, confirmed and waitlisted students (ADMIN or the course's own instructor)")
    public ResponseEntity<List<EnrollmentResponse>> getRoster(
            @PathVariable Long courseId,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(enrollmentService.getRoster(courseId, userId, role));
    }

    @GetMapping("/student/{studentId}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get enrollments for a specific student (Student himself or ADMIN)")
    public ResponseEntity<List<EnrollmentResponse>> getByStudentId(
            @PathVariable Long studentId,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(enrollmentService.getByStudentId(studentId, userId, role));
    }

    @GetMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get enrollment details by ID")
    public ResponseEntity<EnrollmentResponse> getById(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(enrollmentService.getEnrollment(id, userId, role));
    }

    @PutMapping("/{id}/cancel")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Cancel enrollment, release seat, and promote waitlist")
    public ResponseEntity<Void> cancelEnrollment(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        enrollmentService.cancelEnrollment(id, userId, role);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Cancel enrollment (DELETE alias)")
    public ResponseEntity<Void> deleteEnrollment(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        enrollmentService.cancelEnrollment(id, userId, role);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/confirm")
    @Operation(summary = "Confirm enrollment upon payment success (Internal Feign endpoint)")
    public ResponseEntity<EnrollmentResponse> confirmEnrollment(
            @PathVariable("id") Long id,
            @RequestParam("paymentId") Long paymentId) {
        return ResponseEntity.ok(enrollmentService.confirmEnrollment(id, paymentId));
    }

    @PutMapping("/{id}/fail")
    @Operation(summary = "Mark enrollment failed upon payment failure (Internal Feign endpoint)")
    public ResponseEntity<EnrollmentResponse> failEnrollment(
            @PathVariable("id") Long id,
            @RequestParam(value = "reason", defaultValue = "Payment failed") String reason) {
        return ResponseEntity.ok(enrollmentService.failEnrollment(id, reason));
    }

    @PutMapping("/{id}/refund")
    @Operation(summary = "Refund enrollment upon payment refund (Internal Feign endpoint)")
    public ResponseEntity<Void> refundEnrollment(@PathVariable("id") Long id) {
        enrollmentService.refundEnrollment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/count")
    @Operation(summary = "Count active enrollments for a course (Internal check for course deletion)")
    public ResponseEntity<Map<String, Object>> countActiveEnrollments(@RequestParam Long courseId) {
        return ResponseEntity.ok(enrollmentService.countActiveEnrollments(courseId));
    }

    @GetMapping("/stats")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get enrollment counts and statistics (ADMIN only)")
    public ResponseEntity<Map<String, Object>> getStats(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view enrollment statistics");
        }
        return ResponseEntity.ok(enrollmentService.getEnrollmentStats());
    }
}
