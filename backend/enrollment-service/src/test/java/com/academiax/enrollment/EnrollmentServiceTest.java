package com.academiax.enrollment;

import com.academiax.enrollment.client.CourseClient;
import com.academiax.enrollment.client.NotificationClient;
import com.academiax.enrollment.dto.EnrollmentRequest;
import com.academiax.enrollment.dto.EnrollmentResponse;
import com.academiax.enrollment.entity.Enrollment;
import com.academiax.enrollment.entity.EnrollmentStatus;
import com.academiax.enrollment.exception.*;
import com.academiax.enrollment.repository.EnrollmentRepository;
import com.academiax.enrollment.service.EnrollmentService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EnrollmentServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private CourseClient courseClient;

    @Mock
    private NotificationClient notificationClient;

    @InjectMocks
    private EnrollmentService enrollmentService;

    private static final Long STUDENT_ID = 42L;
    private static final Long COURSE_ID = 10L;
    private static final Long ENROLLMENT_ID = 1L;

    // ─── Helpers ────────────────────────────────────────────────────────

    private Map<String, Object> mockCourseAvailable() {
        Map<String, Object> course = new HashMap<>();
        course.put("id", COURSE_ID);
        course.put("title", "Test Course");
        course.put("code", "CS101");
        course.put("availableSeats", 5);
        course.put("totalSeats", 30);
        course.put("tuitionFee", 2500.00);
        course.put("enrollmentDeadline", LocalDateTime.now().plusDays(7).toString());
        course.put("deleted", false);
        course.put("instructorId", 99L);
        return course;
    }

    private Enrollment buildHeldEnrollment() {
        Enrollment e = new Enrollment();
        e.setId(ENROLLMENT_ID);
        e.setStudentId(STUDENT_ID);
        e.setCourseId(COURSE_ID);
        e.setStatus(EnrollmentStatus.SEAT_HELD);
        e.setHoldExpiresAt(LocalDateTime.now().plusMinutes(10));
        e.setTuitionFee(new BigDecimal("2500.00"));
        e.setEnrolledAt(LocalDateTime.now());
        e.setUpdatedAt(LocalDateTime.now());
        return e;
    }

    private Enrollment buildConfirmedEnrollment() {
        Enrollment e = buildHeldEnrollment();
        e.setStatus(EnrollmentStatus.CONFIRMED);
        return e;
    }

    // ─── holdSeat ────────────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("holdSeat: creates SEAT_HELD enrollment for available course")
    void holdSeat_CreatesHeldEnrollment() {
        EnrollmentRequest req = new EnrollmentRequest();
        req.setCourseId(COURSE_ID);

        when(enrollmentRepository.findTopByStudentIdAndCourseIdAndStatusIn(
                eq(STUDENT_ID), eq(COURSE_ID), anyList()))
                .thenReturn(Optional.empty());

        when(courseClient.getCourse(COURSE_ID)).thenReturn(mockCourseAvailable());

        Map<String, Object> reserveResult = new HashMap<>();
        reserveResult.put("rowsAffected", 1);
        reserveResult.put("availableSeats", 4);
        when(courseClient.reserveSeat(COURSE_ID)).thenReturn(reserveResult);

        Enrollment saved = buildHeldEnrollment();
        when(enrollmentRepository.save(any(Enrollment.class))).thenReturn(saved);

        // sendNotification returns a Map (not void)
        when(notificationClient.sendNotification(any())).thenReturn(Map.of("status", "ok"));

        EnrollmentResponse response = enrollmentService.holdSeat(req, STUDENT_ID, "STUDENT");

        assertNotNull(response);
        assertEquals(EnrollmentStatus.SEAT_HELD, response.getStatus());
        verify(enrollmentRepository).save(any(Enrollment.class));
    }

    @Test
    @Order(2)
    @DisplayName("holdSeat: past deadline throws DeadlinePassedException (422)")
    void holdSeat_PastDeadlineThrows() {
        EnrollmentRequest req = new EnrollmentRequest();
        req.setCourseId(COURSE_ID);

        when(enrollmentRepository.findTopByStudentIdAndCourseIdAndStatusIn(
                eq(STUDENT_ID), eq(COURSE_ID), anyList()))
                .thenReturn(Optional.empty());

        Map<String, Object> course = mockCourseAvailable();
        course.put("enrollmentDeadline", LocalDateTime.now().minusDays(1).toString());
        when(courseClient.getCourse(COURSE_ID)).thenReturn(course);

        assertThrows(DeadlinePassedException.class,
                () -> enrollmentService.holdSeat(req, STUDENT_ID, "STUDENT"));
    }

    @Test
    @Order(3)
    @DisplayName("holdSeat: duplicate CONFIRMED enrollment throws DuplicateEnrollmentException")
    void holdSeat_DuplicateConfirmedThrows() {
        EnrollmentRequest req = new EnrollmentRequest();
        req.setCourseId(COURSE_ID);

        Enrollment existing = buildConfirmedEnrollment();
        when(enrollmentRepository.findTopByStudentIdAndCourseIdAndStatusIn(
                eq(STUDENT_ID), eq(COURSE_ID), anyList()))
                .thenReturn(Optional.of(existing));

        assertThrows(DuplicateEnrollmentException.class,
                () -> enrollmentService.holdSeat(req, STUDENT_ID, "STUDENT"));
    }

    // ─── State Machine ─────────────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("confirmEnrollment: SEAT_HELD transitions to CONFIRMED")
    void confirmEnrollment_TransitionsToConfirmed() {
        Enrollment held = buildHeldEnrollment();
        when(enrollmentRepository.findById(ENROLLMENT_ID)).thenReturn(Optional.of(held));
        when(enrollmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(notificationClient.sendNotification(any())).thenReturn(Map.of("status", "ok"));

        EnrollmentResponse resp = enrollmentService.confirmEnrollment(ENROLLMENT_ID, 99L);

        assertEquals(EnrollmentStatus.CONFIRMED, resp.getStatus());
    }

    @Test
    @Order(5)
    @DisplayName("failEnrollment: releases seat and transitions to PAYMENT_FAILED")
    void failEnrollment_ReleasesAndTransitions() {
        Enrollment held = buildHeldEnrollment();
        when(enrollmentRepository.findById(ENROLLMENT_ID)).thenReturn(Optional.of(held));
        when(enrollmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> releaseResult = new HashMap<>();
        releaseResult.put("availableSeats", 5);
        when(courseClient.releaseSeat(COURSE_ID)).thenReturn(releaseResult);

        // No waitlisted students
        when(enrollmentRepository.findByCourseIdAndStatusOrderByEnrolledAtAsc(
                eq(COURSE_ID), eq(EnrollmentStatus.WAITLISTED))).thenReturn(List.of());

        when(notificationClient.sendNotification(any())).thenReturn(Map.of("status", "ok"));

        EnrollmentResponse resp = enrollmentService.failEnrollment(ENROLLMENT_ID, "Card declined");

        assertEquals(EnrollmentStatus.PAYMENT_FAILED, resp.getStatus());
        verify(courseClient).releaseSeat(COURSE_ID);
    }

    // ─── IDOR ─────────────────────────────────────────────────────────

    @Test
    @Order(6)
    @DisplayName("cancelEnrollment: student A cannot cancel student B's enrollment")
    void cancelEnrollment_IDORPrevented() {
        Long otherStudentId = 999L;
        Enrollment enrollment = buildHeldEnrollment();

        when(enrollmentRepository.findById(ENROLLMENT_ID)).thenReturn(Optional.of(enrollment));

        assertThrows(ForbiddenException.class,
                () -> enrollmentService.cancelEnrollment(ENROLLMENT_ID, otherStudentId, "STUDENT"));
    }

    @Test
    @Order(7)
    @DisplayName("getByStudentId: student can only access own enrollments")
    void getByStudentId_ReturnsOnlyOwn() {
        Enrollment e1 = buildHeldEnrollment();
        when(enrollmentRepository.findByStudentId(STUDENT_ID))
                .thenReturn(List.of(e1));

        List<EnrollmentResponse> result = enrollmentService.getByStudentId(STUDENT_ID, STUDENT_ID, "STUDENT");

        assertEquals(1, result.size());
        verify(enrollmentRepository).findByStudentId(STUDENT_ID);
    }

    @Test
    @Order(8)
    @DisplayName("getByStudentId: student B cannot view student A's enrollments (IDOR)")
    void getByStudentId_OtherStudentIDORBlocked() {
        Long otherStudentId = 999L;
        assertThrows(ForbiddenException.class,
                () -> enrollmentService.getByStudentId(STUDENT_ID, otherStudentId, "STUDENT"));
    }

    // ─── State Machine transitions ──────────────────────────────────────

    @Test
    @Order(9)
    @DisplayName("State machine: SEAT_HELD can transition to CONFIRMED, CANCELLED, EXPIRED, PAYMENT_FAILED")
    void stateMachine_AllowedTransitions() {
        assertTrue(EnrollmentStatus.SEAT_HELD.canTransitionTo(EnrollmentStatus.CONFIRMED));
        assertTrue(EnrollmentStatus.SEAT_HELD.canTransitionTo(EnrollmentStatus.CANCELLED));
        assertTrue(EnrollmentStatus.SEAT_HELD.canTransitionTo(EnrollmentStatus.EXPIRED));
        assertTrue(EnrollmentStatus.SEAT_HELD.canTransitionTo(EnrollmentStatus.PAYMENT_FAILED));
        assertFalse(EnrollmentStatus.CANCELLED.canTransitionTo(EnrollmentStatus.CONFIRMED));
        assertFalse(EnrollmentStatus.REFUNDED.canTransitionTo(EnrollmentStatus.CONFIRMED));
    }

    // ─── Saga: hold expiry and waitlist promotion ─────────────────────

    private Enrollment buildWaitlisted(long id, long studentId, int position) {
        Enrollment e = new Enrollment();
        e.setId(id);
        e.setStudentId(studentId);
        e.setCourseId(COURSE_ID);
        e.setStatus(EnrollmentStatus.WAITLISTED);
        e.setWaitlistPosition(position);
        e.setEnrolledAt(LocalDateTime.now().minusMinutes(30 - position));
        return e;
    }

    @Test
    @Order(10)
    @DisplayName("expireSeatHolds: an expired hold is claimed and its seat released")
    void expireSeatHolds_ReleasesSeat() {
        Enrollment expired = buildHeldEnrollment();
        expired.setHoldExpiresAt(LocalDateTime.now().minusSeconds(5));
        when(enrollmentRepository.findByStatusAndHoldExpiresAtBefore(eq(EnrollmentStatus.SEAT_HELD), any()))
                .thenReturn(List.of(expired));
        when(enrollmentRepository.claimExpiredHold(eq(ENROLLMENT_ID), anyString(), any())).thenReturn(1);
        when(enrollmentRepository.findByCourseIdAndStatusOrderByEnrolledAtAsc(COURSE_ID, EnrollmentStatus.WAITLISTED))
                .thenReturn(List.of());

        enrollmentService.expireSeatHolds();

        verify(courseClient, times(1)).releaseSeat(COURSE_ID);
    }

    @Test
    @Order(11)
    @DisplayName("expireSeatHolds: the instance that loses the claim does not release the seat again")
    void expireSeatHolds_LosingInstanceDoesNotDoubleRelease() {
        Enrollment expired = buildHeldEnrollment();
        expired.setHoldExpiresAt(LocalDateTime.now().minusSeconds(5));
        when(enrollmentRepository.findByStatusAndHoldExpiresAtBefore(eq(EnrollmentStatus.SEAT_HELD), any()))
                .thenReturn(List.of(expired));
        when(enrollmentRepository.claimExpiredHold(eq(ENROLLMENT_ID), anyString(), any())).thenReturn(0);

        enrollmentService.expireSeatHolds();

        verify(courseClient, never()).releaseSeat(any());
    }

    @Test
    @Order(12)
    @DisplayName("payment failure promotes the first waitlisted student into the freed seat")
    void failEnrollment_PromotesFirstWaitlisted() {
        Enrollment held = buildHeldEnrollment();
        Enrollment first = buildWaitlisted(2L, 100L, 1);
        Enrollment second = buildWaitlisted(3L, 101L, 2);
        when(enrollmentRepository.findById(ENROLLMENT_ID)).thenReturn(Optional.of(held));
        when(enrollmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrollmentRepository.findByCourseIdAndStatusOrderByEnrolledAtAsc(COURSE_ID, EnrollmentStatus.WAITLISTED))
                .thenReturn(List.of(first, second));
        when(enrollmentRepository.claimWaitlistPromotion(eq(2L), any(), any())).thenReturn(1);

        enrollmentService.failEnrollment(ENROLLMENT_ID, "Card declined");

        verify(courseClient).releaseSeat(COURSE_ID);
        verify(courseClient).reserveSeat(COURSE_ID);
        assertEquals(1, second.getWaitlistPosition(), "remaining waitlist moves up");
        verify(notificationClient).sendNotification(argThat(p -> "WAITLIST_PROMOTED".equals(p.get("type")) && Long.valueOf(100L).equals(p.get("userId"))));
    }

    @Test
    @Order(13)
    @DisplayName("waitlist promotion is undone if the seat cannot be reserved")
    void promotion_RevertedWhenReserveFails() {
        Enrollment first = buildWaitlisted(2L, 100L, 1);
        when(enrollmentRepository.findByCourseIdAndStatusOrderByEnrolledAtAsc(COURSE_ID, EnrollmentStatus.WAITLISTED))
                .thenReturn(List.of(first));
        when(enrollmentRepository.claimWaitlistPromotion(eq(2L), any(), any())).thenReturn(1);
        when(courseClient.reserveSeat(COURSE_ID)).thenThrow(new CourseFullException("full"));

        enrollmentService.promoteNextWaitlistedStudent(COURSE_ID);

        verify(enrollmentRepository).revertWaitlistPromotion(eq(2L), any());
    }
}
