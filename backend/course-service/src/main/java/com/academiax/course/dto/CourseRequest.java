package com.academiax.course.dto;

import jakarta.validation.constraints.*;
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
public class CourseRequest {
    @NotBlank(message = "Course code is required")
    @Size(min = 2, max = 20, message = "Course code must be between 2 and 20 characters")
    private String code;

    @NotBlank(message = "Course title is required")
    @Size(min = 3, max = 255, message = "Course title must be between 3 and 255 characters")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    private Long instructorId;

    @NotBlank(message = "Department is required")
    private String department;

    private String level; // e.g. UNDERGRADUATE, GRADUATE

    @NotNull(message = "Credits are required")
    @Min(value = 1, message = "Credits must be at least 1")
    @Max(value = 12, message = "Credits cannot exceed 12")
    private Integer credits;

    @NotNull(message = "Total seats are required")
    @Min(value = 1, message = "Total seats must be at least 1")
    private Integer totalSeats;

    @NotNull(message = "Tuition fee is required")
    @DecimalMin(value = "0.0", inclusive = true, message = "Tuition fee cannot be negative")
    private BigDecimal tuitionFee;

    @NotBlank(message = "Semester is required")
    private String semester;

    @NotBlank(message = "Academic year is required")
    private String academicYear;

    @NotNull(message = "Enrollment deadline is required")
    private LocalDateTime enrollmentDeadline;
}
