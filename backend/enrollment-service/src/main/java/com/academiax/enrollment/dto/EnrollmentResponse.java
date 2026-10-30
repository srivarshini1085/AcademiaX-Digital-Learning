package com.academiax.enrollment.dto;

import com.academiax.enrollment.entity.EnrollmentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EnrollmentResponse {
    private Long id;
    private Long studentId;
    private Long courseId;
    private EnrollmentStatus status;
    private LocalDateTime holdExpiresAt;
    private Long secondsRemaining;
    private Long paymentId;
    private String paymentStatus;
    private BigDecimal tuitionFee;
    private Integer waitlistPosition;
    private String cancellationReason;
    private String courseCode;
    private String courseTitle;
    private Integer credits;
    private LocalDateTime enrolledAt;
    private LocalDateTime updatedAt;
}
