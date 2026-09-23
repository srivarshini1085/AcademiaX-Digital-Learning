package com.academiax.course.controller;

import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.service.CourseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<List<CourseResponse>> getAllCourses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String academicYear,
            @RequestParam(required = false) String semester,
            @RequestParam(required = false) String courseCode,
            @RequestParam(required = false, defaultValue = "false") Boolean availableOnly) {
        return ResponseEntity.ok(courseService.getAllCourses(keyword, academicYear, semester, courseCode, availableOnly));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourseResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.getCourseById(id));
    }

    @PostMapping
    public ResponseEntity<CourseResponse> createCourse(@Valid @RequestBody CourseRequest request) {
        return ResponseEntity.ok(courseService.createCourse(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CourseResponse> updateCourse(@PathVariable Long id, @Valid @RequestBody CourseRequest request) {
        return ResponseEntity.ok(courseService.updateCourse(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCourse(@PathVariable Long id) {
        courseService.deleteCourse(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/reserve-seat")
    public ResponseEntity<CourseResponse> reserveSeat(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.reserveSeat(id));
    }

    @PutMapping("/{id}/release-seat")
    public ResponseEntity<CourseResponse> releaseSeat(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.releaseSeat(id));
    }
}
