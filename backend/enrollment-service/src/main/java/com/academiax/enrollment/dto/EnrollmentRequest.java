package com.academiax.enrollment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EnrollmentRequest {
    @NotNull(message = "Course ID is required")
    private Long courseId;

    // Optional: will be taken from X-User-Id header for security, unless caller is ADMIN
    private Long studentId;
}
