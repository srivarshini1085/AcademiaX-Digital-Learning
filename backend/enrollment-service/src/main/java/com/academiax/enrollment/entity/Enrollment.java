package com.academiax.enrollment.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "enrollments", indexes = {
        @Index(name = "idx_enrollment_student_course", columnList = "studentId, courseId"),
        @Index(name = "idx_enrollment_status", columnList = "status"),
        @Index(name = "idx_enrollment_hold_expires", columnList = "holdExpiresAt")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Enrollment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long studentId;

    @Column(nullable = false)
    private Long courseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EnrollmentStatus status;

    private LocalDateTime holdExpiresAt;

    private Long paymentId;

    @Column(precision = 10, scale = 2)
    private BigDecimal tuitionFee;

    private Integer waitlistPosition;

    private String cancellationReason;

    @Column(nullable = false)
    private LocalDateTime enrolledAt;

    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
