package com.academiax.enrollment.repository;

import com.academiax.enrollment.entity.Enrollment;
import com.academiax.enrollment.entity.EnrollmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    List<Enrollment> findByStudentId(Long studentId);

    Page<Enrollment> findByStudentId(Long studentId, Pageable pageable);

    List<Enrollment> findByCourseId(Long courseId);

    Optional<Enrollment> findByStudentIdAndCourseId(Long studentId, Long courseId);

    Optional<Enrollment> findTopByStudentIdAndCourseIdAndStatusIn(Long studentId, Long courseId, Collection<EnrollmentStatus> statuses);

    List<Enrollment> findByStatus(EnrollmentStatus status);

    List<Enrollment> findByStatusAndHoldExpiresAtBefore(EnrollmentStatus status, LocalDateTime threshold);

    List<Enrollment> findByCourseIdAndStatusOrderByEnrolledAtAsc(Long courseId, EnrollmentStatus status);

    long countByCourseIdAndStatusIn(Long courseId, Collection<EnrollmentStatus> statuses);

    long countByCourseIdAndStatus(Long courseId, EnrollmentStatus status);

    long countByStatus(EnrollmentStatus status);

    /**
     * Claims an expired hold for this instance. Two enrollment-service instances run the expiry job; only the one
     * whose UPDATE affects the row (returns 1) may release the seat, so a seat is never released twice.
     */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Enrollment e SET e.status = com.academiax.enrollment.entity.EnrollmentStatus.EXPIRED, " +
           "e.cancellationReason = :reason, e.holdExpiresAt = null, e.updatedAt = :now, e.version = e.version + 1 " +
           "WHERE e.id = :id AND e.status = com.academiax.enrollment.entity.EnrollmentStatus.SEAT_HELD AND e.holdExpiresAt < :now")
    int claimExpiredHold(@Param("id") Long id, @Param("reason") String reason, @Param("now") LocalDateTime now);

    /** Claims a waitlist entry for promotion (same single-winner rule as {@link #claimExpiredHold}). */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Enrollment e SET e.status = com.academiax.enrollment.entity.EnrollmentStatus.SEAT_HELD, " +
           "e.holdExpiresAt = :expiresAt, e.waitlistPosition = null, e.updatedAt = :now, e.version = e.version + 1 " +
           "WHERE e.id = :id AND e.status = com.academiax.enrollment.entity.EnrollmentStatus.WAITLISTED")
    int claimWaitlistPromotion(@Param("id") Long id, @Param("expiresAt") LocalDateTime expiresAt, @Param("now") LocalDateTime now);

    /** Undoes a promotion claim when the seat could not be reserved after all. */
    @Transactional
    @Modifying(clearAutomatically = true)
    @Query("UPDATE Enrollment e SET e.status = com.academiax.enrollment.entity.EnrollmentStatus.WAITLISTED, " +
           "e.holdExpiresAt = null, e.updatedAt = :now, e.version = e.version + 1 " +
           "WHERE e.id = :id AND e.status = com.academiax.enrollment.entity.EnrollmentStatus.SEAT_HELD")
    int revertWaitlistPromotion(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Query("SELECT e FROM Enrollment e WHERE " +
           "(:status IS NULL OR e.status = :status) AND " +
           "(:courseId IS NULL OR e.courseId = :courseId) AND " +
           "(:studentId IS NULL OR e.studentId = :studentId)")
    Page<Enrollment> searchEnrollments(@Param("status") EnrollmentStatus status,
                                       @Param("courseId") Long courseId,
                                       @Param("studentId") Long studentId,
                                       Pageable pageable);
}
