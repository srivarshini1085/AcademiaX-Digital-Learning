package com.academiax.enrollment.service;

import com.academiax.enrollment.client.CourseClient;
import com.academiax.enrollment.client.NotificationClient;
import com.academiax.enrollment.dto.EnrollmentRequest;
import com.academiax.enrollment.dto.EnrollmentResponse;
import com.academiax.enrollment.entity.Enrollment;
import com.academiax.enrollment.entity.EnrollmentStatus;
import com.academiax.enrollment.exception.*;
import com.academiax.enrollment.repository.EnrollmentRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final CourseClient courseClient;
    private final NotificationClient notificationClient;

    /**
     * Saga Step 1: Hold seat atomically and transition enrollment to SEAT_HELD with a 10-minute hold window.
     */
    @Transactional
    @CircuitBreaker(name = "courseService", fallbackMethod = "fallbackHoldSeat")
    public EnrollmentResponse holdSeat(EnrollmentRequest request, Long authenticatedUserId, String userRole) {
        Long studentId = authenticatedUserId;
        if ("ADMIN".equalsIgnoreCase(userRole) && request.getStudentId() != null) {
            studentId = request.getStudentId();
        }
        if (studentId == null) {
            throw new ForbiddenException("Authentication required to enroll in courses");
        }

        Long courseId = request.getCourseId();

        // 1. Prevent duplicate active enrollments
        Optional<Enrollment> existingActive = enrollmentRepository.findTopByStudentIdAndCourseIdAndStatusIn(
                studentId, courseId, List.of(EnrollmentStatus.SEAT_HELD, EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITLISTED));

        if (existingActive.isPresent()) {
            Enrollment current = existingActive.get();
            if (current.getStatus() == EnrollmentStatus.CONFIRMED) {
                throw new DuplicateEnrollmentException("You are already enrolled and confirmed in this course.");
            }
            if (current.getStatus() == EnrollmentStatus.SEAT_HELD) {
                if (current.getHoldExpiresAt() != null && current.getHoldExpiresAt().isBefore(LocalDateTime.now())) {
                    // Lapsed but not yet swept by the expiry job: the seat is still reserved for this enrollment,
                    // so renew the same hold instead of marking it EXPIRED here (which used to leak the seat).
                    current.setHoldExpiresAt(LocalDateTime.now().plusMinutes(10));
                    current.setUpdatedAt(LocalDateTime.now());
                    current = enrollmentRepository.save(current);
                }
                return toResponse(current);
            } else if (current.getStatus() == EnrollmentStatus.WAITLISTED) {
                throw new DuplicateEnrollmentException("You are currently on the waitlist for this course.");
            }
        }

        // 2. Query Course details & verify deadline
        Map<String, Object> course = courseClient.getCourse(courseId);
        if (course == null || Boolean.TRUE.equals(course.get("deleted"))) {
            throw new ResourceNotFoundException("Course not found with id: " + courseId);
        }

        String deadlineStr = (String) course.get("enrollmentDeadline");
        if (deadlineStr != null) {
            LocalDateTime deadline = LocalDateTime.parse(deadlineStr);
            if (deadline.isBefore(LocalDateTime.now())) {
                throw new DeadlinePassedException("Enrollment deadline has passed for course: " + course.get("code"));
            }
        }

        BigDecimal tuitionFee = BigDecimal.valueOf(1500.00);
        Object feeObj = course.get("tuitionFee");
        if (feeObj instanceof Number n) {
            tuitionFee = BigDecimal.valueOf(n.doubleValue());
        }

        // 3. Atomically reserve seat in CourseService
        courseClient.reserveSeat(courseId);

        // 4. Create enrollment in SEAT_HELD status
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime holdExpiry = now.plusMinutes(10);

        Enrollment enrollment = Enrollment.builder()
                .studentId(studentId)
                .courseId(courseId)
                .status(EnrollmentStatus.SEAT_HELD)
                .holdExpiresAt(holdExpiry)
                .tuitionFee(tuitionFee)
                .enrolledAt(now)
                .updatedAt(now)
                .build();

        Enrollment saved = enrollmentRepository.save(enrollment);

        // 5. Send in-app notification
        sendNotification(studentId, "Seat Held: Pay within 10 minutes",
                "Your seat for " + course.get("code") + " (" + course.get("title") + ") is reserved. Please complete payment within 10 minutes.",
                "SEAT_HELD");

        return toResponse(saved, course);
    }

    /**
     * Join waitlist if course is full.
     */
    @Transactional
    public EnrollmentResponse joinWaitlist(Long courseId, Long authenticatedUserId, String userRole) {
        Long studentId = authenticatedUserId;
        if (studentId == null) {
            throw new ForbiddenException("Authentication required to join waitlist");
        }

        Optional<Enrollment> existingActive = enrollmentRepository.findTopByStudentIdAndCourseIdAndStatusIn(
                studentId, courseId, List.of(EnrollmentStatus.SEAT_HELD, EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITLISTED));

        if (existingActive.isPresent()) {
            throw new DuplicateEnrollmentException("You already have an active enrollment or waitlist entry for this course.");
        }

        Map<String, Object> course = courseClient.getCourse(courseId);
        if (course == null || Boolean.TRUE.equals(course.get("deleted"))) {
            throw new ResourceNotFoundException("Course not found with id: " + courseId);
        }

        long currentWaitlistCount = enrollmentRepository.countByCourseIdAndStatus(courseId, EnrollmentStatus.WAITLISTED);
        int newPosition = (int) currentWaitlistCount + 1;

        BigDecimal tuitionFee = BigDecimal.valueOf(1500.00);
        if (course.get("tuitionFee") instanceof Number n) {
            tuitionFee = BigDecimal.valueOf(n.doubleValue());
        }

        Enrollment waitlisted = Enrollment.builder()
                .studentId(studentId)
                .courseId(courseId)
                .status(EnrollmentStatus.WAITLISTED)
                .waitlistPosition(newPosition)
                .tuitionFee(tuitionFee)
                .enrolledAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Enrollment saved = enrollmentRepository.save(waitlisted);

        sendNotification(studentId, "Joined Waitlist: Position #" + newPosition,
                "You joined the waitlist for " + course.get("code") + " at position #" + newPosition + ". You will be auto-notified if a seat opens up.",
                "WAITLISTED");

        return toResponse(saved, course);
    }

    /**
     * Saga Step 2: Payment Confirmed -> transition to CONFIRMED.
     */
    @Transactional
    public EnrollmentResponse confirmEnrollment(Long enrollmentId, Long paymentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId));

        if (!enrollment.getStatus().canTransitionTo(EnrollmentStatus.CONFIRMED)) {
            throw new InvalidStateTransitionException("Cannot confirm enrollment in status: " + enrollment.getStatus());
        }

        enrollment.setStatus(EnrollmentStatus.CONFIRMED);
        enrollment.setPaymentId(paymentId);
        enrollment.setHoldExpiresAt(null);
        enrollment.setUpdatedAt(LocalDateTime.now());
        Enrollment saved = enrollmentRepository.save(enrollment);

        sendNotification(saved.getStudentId(), "Enrollment Confirmed!",
                "Your tuition payment was processed successfully. You are officially enrolled in " + courseLabel(saved.getCourseId()) + ".",
                "CONFIRMED");

        return toResponse(saved);
    }

    /**
     * Saga Step 2 (Failure): Payment Failed -> Compensating transaction (release seat & promote waitlist).
     */
    @Transactional
    public EnrollmentResponse failEnrollment(Long enrollmentId, String reason) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId));

        if (!enrollment.getStatus().canTransitionTo(EnrollmentStatus.PAYMENT_FAILED)) {
            return toResponse(enrollment);
        }

        enrollment.setStatus(EnrollmentStatus.PAYMENT_FAILED);
        enrollment.setCancellationReason(reason);
        enrollment.setHoldExpiresAt(null);
        enrollment.setUpdatedAt(LocalDateTime.now());
        Enrollment saved = enrollmentRepository.save(enrollment);

        // Compensating transaction: release seat back to course
        try {
            courseClient.releaseSeat(saved.getCourseId());
        } catch (Exception ex) {
            log.error("Failed to release seat for course {}: {}", saved.getCourseId(), ex.getMessage());
        }

        // Auto-promote first waitlisted student
        promoteNextWaitlistedStudent(saved.getCourseId());

        sendNotification(saved.getStudentId(), "Payment Failed: Seat Released",
                "Your payment was unsuccessful (" + reason + "). The held seat has been released.",
                "PAYMENT_FAILED");

        return toResponse(saved);
    }

    /**
     * Student cancels enrollment or drops course.
     */
    @Transactional
    public void cancelEnrollment(Long enrollmentId, Long authenticatedUserId, String userRole) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId));

        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !enrollment.getStudentId().equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot cancel another student's enrollment");
            }
        }

        if (!enrollment.getStatus().canTransitionTo(EnrollmentStatus.CANCELLED)) {
            throw new InvalidStateTransitionException("Enrollment in status " + enrollment.getStatus() + " cannot be cancelled");
        }

        EnrollmentStatus prevStatus = enrollment.getStatus();
        enrollment.setStatus(EnrollmentStatus.CANCELLED);
        enrollment.setCancellationReason("Cancelled by user");
        enrollment.setHoldExpiresAt(null);
        enrollment.setUpdatedAt(LocalDateTime.now());
        enrollmentRepository.save(enrollment);

        if (prevStatus == EnrollmentStatus.SEAT_HELD || prevStatus == EnrollmentStatus.CONFIRMED) {
            try {
                courseClient.releaseSeat(enrollment.getCourseId());
            } catch (Exception ex) {
                log.error("Failed to release seat on cancel: {}", ex.getMessage());
            }
            promoteNextWaitlistedStudent(enrollment.getCourseId());
        }

        sendNotification(enrollment.getStudentId(), "Enrollment Cancelled",
                "Your enrollment in " + courseLabel(enrollment.getCourseId()) + " has been cancelled.",
                "CANCELLED");
    }

    /**
     * Refund enrollment (triggered when Payment is refunded).
     */
    @Transactional
    public void refundEnrollment(Long enrollmentId) {
        Enrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId));

        if (!enrollment.getStatus().canTransitionTo(EnrollmentStatus.REFUNDED)) {
            throw new InvalidStateTransitionException("Cannot refund enrollment in status: " + enrollment.getStatus());
        }

        enrollment.setStatus(EnrollmentStatus.REFUNDED);
        enrollment.setUpdatedAt(LocalDateTime.now());
        enrollmentRepository.save(enrollment);

        try {
            courseClient.releaseSeat(enrollment.getCourseId());
        } catch (Exception ex) {
            log.error("Failed to release seat on refund: {}", ex.getMessage());
        }

        promoteNextWaitlistedStudent(enrollment.getCourseId());

        sendNotification(enrollment.getStudentId(), "Enrollment Refunded",
                "Your enrollment for " + courseLabel(enrollment.getCourseId()) + " has been refunded and the seat has been released.",
                "REFUNDED");
    }

    /**
     * Scheduled Job: Scans for expired seat holds every 10 seconds and executes compensating transaction.
     */
    @Scheduled(fixedDelay = 10000)
    public void expireSeatHolds() {
        LocalDateTime now = LocalDateTime.now();
        List<Enrollment> expiredHolds = enrollmentRepository.findByStatusAndHoldExpiresAtBefore(EnrollmentStatus.SEAT_HELD, now);

        if (!expiredHolds.isEmpty()) {
            log.info("Processing {} expired seat holds", expiredHolds.size());
            for (Enrollment hold : expiredHolds) {
                try {
                    // Both enrollment instances run this job; only the one that wins the claim releases the seat.
                    if (enrollmentRepository.claimExpiredHold(hold.getId(), "Seat hold expired after 10 minutes without payment", now) == 0) {
                        continue;
                    }

                    courseClient.releaseSeat(hold.getCourseId());
                    promoteNextWaitlistedStudent(hold.getCourseId());

                    sendNotification(hold.getStudentId(), "Seat Hold Expired",
                            "Your 10-minute hold for " + courseLabel(hold.getCourseId()) + " has expired. The seat has been released.",
                            "EXPIRED");
                } catch (Exception e) {
                    log.error("Error expiring hold {}: {}", hold.getId(), e.getMessage());
                }
            }
        }
    }

    /**
     * Waitlist promotion helper: automatically promotes first student on the waitlist to SEAT_HELD.
     */
    @Transactional
    public void promoteNextWaitlistedStudent(Long courseId) {
        try {
            List<Enrollment> waitlisted = enrollmentRepository.findByCourseIdAndStatusOrderByEnrolledAtAsc(courseId, EnrollmentStatus.WAITLISTED);
            if (!waitlisted.isEmpty()) {
                Enrollment firstInLine = waitlisted.get(0);
                log.info("Promoting waitlisted student {} to SEAT_HELD for course {}", firstInLine.getStudentId(), courseId);

                // Claim first (single winner across instances), then reserve the freed seat; undo the claim if that fails.
                LocalDateTime now = LocalDateTime.now();
                if (enrollmentRepository.claimWaitlistPromotion(firstInLine.getId(), now.plusMinutes(10), now) == 0) {
                    return;
                }
                try {
                    courseClient.reserveSeat(courseId);
                } catch (Exception reserveFailed) {
                    enrollmentRepository.revertWaitlistPromotion(firstInLine.getId(), LocalDateTime.now());
                    throw reserveFailed;
                }

                // Re-order remaining waitlist entries
                for (int i = 1; i < waitlisted.size(); i++) {
                    Enrollment other = waitlisted.get(i);
                    other.setWaitlistPosition(i);
                    enrollmentRepository.save(other);
                }

                sendNotification(firstInLine.getStudentId(), "Promoted from Waitlist!",
                        "A seat opened up for " + courseLabel(courseId) + "! You have been promoted to a 10-minute seat hold. Please pay to confirm.",
                        "WAITLIST_PROMOTED");
            }
        } catch (Exception ex) {
            log.warn("Waitlist promotion could not be completed for course {}: {}", courseId, ex.getMessage());
        }
    }

    public EnrollmentResponse getEnrollment(Long id, Long authenticatedUserId, String userRole) {
        Enrollment enrollment = enrollmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + id));

        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !enrollment.getStudentId().equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot access another student's enrollment");
            }
        }
        return toResponse(enrollment, courseOrNull(enrollment.getCourseId()));
    }

    public List<EnrollmentResponse> getByStudentId(Long studentId, Long authenticatedUserId, String userRole) {
        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (authenticatedUserId == null || !studentId.equals(authenticatedUserId)) {
                throw new ForbiddenException("You cannot view enrollments for other students");
            }
        }
        // Attach course code/title so "My enrollments" can render without one request per row from the browser.
        Map<Long, Map<String, Object>> courses = new HashMap<>();
        return enrollmentRepository.findByStudentId(studentId).stream()
                .sorted(Comparator.comparing(Enrollment::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(e -> toResponse(e, courses.computeIfAbsent(e.getCourseId(), this::courseOrNull)))
                .toList();
    }

    public List<EnrollmentResponse> getRoster(Long courseId, Long authenticatedUserId, String userRole) {
        Map<String, Object> course = courseClient.getCourse(courseId);
        boolean isAdmin = "ADMIN".equalsIgnoreCase(userRole);
        boolean ownsCourse = "INSTRUCTOR".equalsIgnoreCase(userRole) && course != null && authenticatedUserId != null
                && course.get("instructorId") instanceof Number owner && owner.longValue() == authenticatedUserId;
        if (!isAdmin && !ownsCourse) {
            throw new ForbiddenException("Only administrators or the course's instructor can view its roster");
        }
        return enrollmentRepository.findByCourseId(courseId).stream()
                .filter(e -> e.getStatus() == EnrollmentStatus.CONFIRMED || e.getStatus() == EnrollmentStatus.SEAT_HELD
                        || e.getStatus() == EnrollmentStatus.WAITLISTED)
                .map(e -> toResponse(e, course))
                .toList();
    }

    /** "PHY401 Quantum Mechanics" for notification text, or "course #9" if course-service is unreachable. */
    private String courseLabel(Long courseId) {
        Map<String, Object> course = courseOrNull(courseId);
        return course != null ? course.get("code") + " " + course.get("title") : "course #" + courseId;
    }

    private Map<String, Object> courseOrNull(Long courseId) {
        try {
            return courseClient.getCourse(courseId);
        } catch (Exception ex) {
            log.debug("Course {} unavailable while listing enrollments: {}", courseId, ex.getMessage());
            return null;
        }
    }

    public Page<EnrollmentResponse> searchEnrollments(EnrollmentStatus status, Long courseId, Long studentId, Pageable pageable) {
        return enrollmentRepository.searchEnrollments(status, courseId, studentId, pageable).map(this::toResponse);
    }

    public Map<String, Object> countActiveEnrollments(Long courseId) {
        long count = enrollmentRepository.countByCourseIdAndStatusIn(
                courseId, List.of(EnrollmentStatus.SEAT_HELD, EnrollmentStatus.CONFIRMED));
        return Map.of("courseId", courseId, "activeCount", count);
    }

    public Map<String, Object> getEnrollmentStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalConfirmed", enrollmentRepository.countByStatus(EnrollmentStatus.CONFIRMED));
        stats.put("totalHeld", enrollmentRepository.countByStatus(EnrollmentStatus.SEAT_HELD));
        stats.put("totalWaitlisted", enrollmentRepository.countByStatus(EnrollmentStatus.WAITLISTED));
        stats.put("totalExpired", enrollmentRepository.countByStatus(EnrollmentStatus.EXPIRED));
        stats.put("totalCancelled", enrollmentRepository.countByStatus(EnrollmentStatus.CANCELLED));
        stats.put("totalEnrollments", enrollmentRepository.count());
        return stats;
    }

    private void sendNotification(Long userId, String title, String message, String type) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("userId", userId);
            payload.put("title", title);
            payload.put("message", message);
            payload.put("type", type);
            notificationClient.sendNotification(payload);
        } catch (Exception ex) {
            log.debug("Notification client unavailable: {}", ex.getMessage());
        }
    }

    private EnrollmentResponse toResponse(Enrollment enrollment) {
        return toResponse(enrollment, null);
    }

    private EnrollmentResponse toResponse(Enrollment enrollment, Map<String, Object> courseData) {
        Long secondsRemaining = null;
        if (enrollment.getStatus() == EnrollmentStatus.SEAT_HELD && enrollment.getHoldExpiresAt() != null) {
            long remaining = Duration.between(LocalDateTime.now(), enrollment.getHoldExpiresAt()).getSeconds();
            secondsRemaining = Math.max(0, remaining);
        }

        String courseCode = null;
        String courseTitle = null;
        Integer credits = null;

        if (courseData != null) {
            courseCode = (String) courseData.get("code");
            courseTitle = (String) courseData.get("title");
            if (courseData.get("credits") instanceof Number n) {
                credits = n.intValue();
            }
        }

        return EnrollmentResponse.builder()
                .id(enrollment.getId())
                .studentId(enrollment.getStudentId())
                .courseId(enrollment.getCourseId())
                .status(enrollment.getStatus())
                .holdExpiresAt(enrollment.getHoldExpiresAt())
                .secondsRemaining(secondsRemaining)
                .paymentId(enrollment.getPaymentId())
                .paymentStatus(enrollment.getStatus() == EnrollmentStatus.CONFIRMED ? "SUCCESS" : null)
                .tuitionFee(enrollment.getTuitionFee())
                .waitlistPosition(enrollment.getWaitlistPosition())
                .cancellationReason(enrollment.getCancellationReason())
                .courseCode(courseCode)
                .courseTitle(courseTitle)
                .credits(credits)
                .enrolledAt(enrollment.getEnrolledAt())
                .updatedAt(enrollment.getUpdatedAt())
                .build();
    }

    public EnrollmentResponse fallbackHoldSeat(EnrollmentRequest request, Long authenticatedUserId, String userRole, Exception ex) {
        // Business exceptions should never be swallowed by the fallback
        if (ex instanceof CourseFullException ||
            ex instanceof DuplicateEnrollmentException ||
            ex instanceof DeadlinePassedException ||
            ex instanceof ResourceNotFoundException ||
            ex instanceof ForbiddenException ||
            ex instanceof ConflictException ||
            ex instanceof IllegalArgumentException) {
            if (ex instanceof RuntimeException re) throw re;
            throw new RuntimeException(ex);
        }
        log.error("Circuit breaker triggered for holdSeat: {}", ex.getMessage());
        throw new RuntimeException("Course service is temporarily unavailable. Please try again shortly.");
    }
}
