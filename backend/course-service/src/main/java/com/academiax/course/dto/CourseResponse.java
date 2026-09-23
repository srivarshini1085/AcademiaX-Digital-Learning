package com.academiax.course.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CourseResponse {
    private Long id;
    private String code;
    private String title;
    private String description;
    private Long instructorId;
    private Integer credits;
    private Integer totalSeats;
    private Integer availableSeats;
    private String semester;
    private String academicYear;
    private LocalDateTime enrollmentDeadline;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long version;
}
