package com.academiax.course.service;

import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.entity.Course;
import com.academiax.course.repository.CourseRepository;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;

    public List<CourseResponse> getAllCourses(String keyword, String academicYear, String semester, String codeFilter, Boolean availableOnly) {
        List<Course> courses = courseRepository.searchCourses(keyword, academicYear, semester, codeFilter, Boolean.TRUE.equals(availableOnly));
        return courses.stream().map(this::toResponse).toList();
    }

    public CourseResponse getCourseById(Long id) {
        return toResponse(courseRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Course not found")));
    }

    @Transactional
    public CourseResponse createCourse(CourseRequest request) {
        if (courseRepository.findByCode(request.getCode()).isPresent()) {
            throw new IllegalArgumentException("Course code already exists");
        }
        if (request.getEnrollmentDeadline().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Enrollment deadline must be in the future");
        }

        Course course = Course.builder()
                .code(request.getCode())
                .title(request.getTitle())
                .description(request.getDescription())
                .instructorId(request.getInstructorId())
                .credits(request.getCredits())
                .totalSeats(request.getTotalSeats())
                .availableSeats(request.getTotalSeats())
                .semester(request.getSemester())
                .academicYear(request.getAcademicYear())
                .enrollmentDeadline(request.getEnrollmentDeadline())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return toResponse(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse updateCourse(Long id, CourseRequest request) {
        Course course = courseRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Course not found"));
        if (request.getEnrollmentDeadline().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Enrollment deadline must be in the future");
        }

        course.setCode(request.getCode());
        course.setTitle(request.getTitle());
        course.setDescription(request.getDescription());
        course.setCredits(request.getCredits());
        course.setTotalSeats(request.getTotalSeats());
        course.setSemester(request.getSemester());
        course.setAcademicYear(request.getAcademicYear());
        course.setEnrollmentDeadline(request.getEnrollmentDeadline());
        course.setUpdatedAt(LocalDateTime.now());
        if (request.getTotalSeats() < course.getTotalSeats() - course.getAvailableSeats()) {
            throw new IllegalArgumentException("Total seats cannot be less than already enrolled students");
        }
        if (course.getAvailableSeats() == 0 && request.getTotalSeats() > course.getTotalSeats()) {
            course.setAvailableSeats(request.getTotalSeats() - (course.getTotalSeats() - course.getAvailableSeats()));
        }
        course.setAvailableSeats(Math.max(course.getAvailableSeats(), request.getTotalSeats() - (course.getTotalSeats() - course.getAvailableSeats())));
        course.setTotalSeats(request.getTotalSeats());

        return toResponse(courseRepository.saveAndFlush(course));
    }

    @Transactional
    public CourseResponse reserveSeat(Long courseId) {
        Course course = courseRepository.findById(courseId).orElseThrow(() -> new IllegalArgumentException("Course not found"));
        if (course.getAvailableSeats() <= 0) {
            throw new IllegalArgumentException("No seats available");
        }
        if (course.getEnrollmentDeadline().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Enrollment deadline has passed");
        }

        course.setAvailableSeats(course.getAvailableSeats() - 1);
        course.setUpdatedAt(LocalDateTime.now());
        return toResponse(courseRepository.saveAndFlush(course));
    }

    @Transactional
    public CourseResponse releaseSeat(Long courseId) {
        Course course = courseRepository.findById(courseId).orElseThrow(() -> new IllegalArgumentException("Course not found"));
        if (course.getAvailableSeats() >= course.getTotalSeats()) {
            throw new IllegalArgumentException("Available seat count cannot exceed total seats");
        }
        course.setAvailableSeats(course.getAvailableSeats() + 1);
        course.setUpdatedAt(LocalDateTime.now());
        return toResponse(courseRepository.saveAndFlush(course));
    }

    @Transactional
    public void deleteCourse(Long id) {
        Course course = courseRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Course not found"));
        courseRepository.delete(course);
    }

    private CourseResponse toResponse(Course course) {
        return CourseResponse.builder()
                .id(course.getId())
                .code(course.getCode())
                .title(course.getTitle())
                .description(course.getDescription())
                .instructorId(course.getInstructorId())
                .credits(course.getCredits())
                .totalSeats(course.getTotalSeats())
                .availableSeats(course.getAvailableSeats())
                .semester(course.getSemester())
                .academicYear(course.getAcademicYear())
                .enrollmentDeadline(course.getEnrollmentDeadline())
                .createdAt(course.getCreatedAt())
                .updatedAt(course.getUpdatedAt())
                .version(course.getVersion())
                .build();
    }
}
