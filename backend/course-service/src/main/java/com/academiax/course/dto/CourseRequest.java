package com.academiax.course.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CourseRequest {
    @NotBlank(message = "Course code is required")
    private String code;

    @NotBlank(message = "Course title is required")
    private String title;

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull(message = "Instructor ID is required")
    private Long instructorId;

    @Min(value = 1, message = "Credits must be positive")
    private Integer credits;

    @Min(value = 1, message = "Total seats must be positive")
    private Integer totalSeats;

    @NotBlank(message = "Semester is required")
    private String semester;

    @NotBlank(message = "Academic year is required")
    private String academicYear;

    @NotNull(message = "Enrollment deadline is required")
    private LocalDateTime enrollmentDeadline;
}
