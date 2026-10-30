package com.academiax.course.controller;

import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.service.CourseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/courses")
@RequiredArgsConstructor
@Tag(name = "Courses", description = "Course management, search, and seat allocation")
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    @Operation(summary = "Search courses with pagination, sorting, and department/semester/level filters")
    public ResponseEntity<Page<CourseResponse>> getCourses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) String semester,
            @RequestParam(required = false) String courseCode,
            @RequestParam(required = false, defaultValue = "false") Boolean availableOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id,desc") String sort) {

        String[] sortParts = sort.split(",");
        String sortProp = sortParts[0];
        Sort.Direction direction = (sortParts.length > 1 && sortParts[1].equalsIgnoreCase("asc"))
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(direction, sortProp));
        Page<CourseResponse> result = courseService.getCoursesPaged(
                keyword, department, level, academicYear, semester, courseCode, availableOnly, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/whoami")
    @Operation(summary = "Returns service instance information and invocation count for load balancing proof")
    public ResponseEntity<Map<String, Object>> whoAmI() {
        return ResponseEntity.ok(courseService.getWhoAmI());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get course details by ID")
    public ResponseEntity<CourseResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getCourseById(id));
    }

    @PostMapping
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create a course (ADMIN or INSTRUCTOR)")
    public ResponseEntity<CourseResponse> createCourse(
            @Valid @RequestBody CourseRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        CourseResponse created = courseService.createCourse(request, userId, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update a course (ADMIN or the course instructor)")
    public ResponseEntity<CourseResponse> updateCourse(
            @PathVariable Long id,
            @Valid @RequestBody CourseRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(courseService.updateCourse(id, request, userId, role));
    }

    @DeleteMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Soft delete a course (ADMIN only, blocked if active enrollments exist)")
    public ResponseEntity<Void> deleteCourse(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        courseService.deleteCourse(id, role);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/reserve-seat")
    @Operation(summary = "Atomically reserve a seat in the course")
    public ResponseEntity<CourseResponse> reserveSeat(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.reserveSeat(id));
    }

    @PutMapping("/{id}/release-seat")
    @Operation(summary = "Atomically release a seat in the course")
    public ResponseEntity<CourseResponse> releaseSeat(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.releaseSeat(id));
    }
}
