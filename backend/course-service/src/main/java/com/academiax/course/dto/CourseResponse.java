package com.academiax.course.dto;

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
public class CourseResponse {
    private Long id;
    private String code;
    private String title;
    private String description;
    private Long instructorId;
    private String department;
    private String level;
    private Integer credits;
    private Integer totalSeats;
    private Integer availableSeats;
    private BigDecimal tuitionFee;
    private String semester;
    private String academicYear;
    private LocalDateTime enrollmentDeadline;
    private Boolean deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long version;
}
