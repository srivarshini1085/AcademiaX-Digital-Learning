package com.academiax.course.service;

import com.academiax.course.client.EnrollmentClient;
import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.entity.Course;
import com.academiax.course.exception.*;
import com.academiax.course.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class CourseService {

    private final CourseRepository courseRepository;
    private final EnrollmentClient enrollmentClient;

    @Value("${spring.application.name:course-service}")
    private String applicationName;

    @Value("${server.port:8082}")
    private String serverPort;

    @Value("${eureka.instance.instance-id:${spring.application.name}:${server.port:8082}}")
    private String instanceId;

    private final AtomicLong requestCounter = new AtomicLong(0);

    public Page<CourseResponse> getCoursesPaged(String keyword, String department, String level,
                                               String academicYear, String semester, String codeFilter,
                                               Boolean availableOnly, Pageable pageable) {
        Page<Course> page = courseRepository.searchCoursesPaged(
                keyword, department, level, academicYear, semester, codeFilter,
                Boolean.TRUE.equals(availableOnly), pageable);
        return page.map(this::toResponse);
    }

    public List<CourseResponse> getAllCourses(String keyword, String academicYear, String semester, String codeFilter, Boolean availableOnly) {
        List<Course> courses = courseRepository.searchCourses(keyword, academicYear, semester, codeFilter, Boolean.TRUE.equals(availableOnly));
        return courses.stream().map(this::toResponse).toList();
    }

    public CourseResponse getCourseById(Long id) {
        Course course = courseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + id));
        return toResponse(course);
    }

    @Transactional
    public CourseResponse createCourse(CourseRequest request, Long userId, String userRole) {
        if (!"ADMIN".equalsIgnoreCase(userRole) && !"INSTRUCTOR".equalsIgnoreCase(userRole)) {
            throw new ForbiddenException("Only instructors and administrators can create courses");
        }

        if (courseRepository.findByCodeAndDeletedFalse(request.getCode()).isPresent()) {
            throw new ConflictException("Course with code " + request.getCode() + " already exists");
        }

        if (request.getEnrollmentDeadline() != null && request.getEnrollmentDeadline().isBefore(LocalDateTime.now())) {
            throw new DeadlinePassedException("Enrollment deadline must be in the future");
        }

        Long instructorId = request.getInstructorId();
        if ("INSTRUCTOR".equalsIgnoreCase(userRole) || instructorId == null) {
            instructorId = userId;
        }

        Course course = Course.builder()
                .code(request.getCode())
                .title(request.getTitle())
                .description(request.getDescription())
                .instructorId(instructorId)
                .department(request.getDepartment())
                .level(request.getLevel() != null ? request.getLevel().toUpperCase() : "UNDERGRADUATE")
                .credits(request.getCredits())
                .totalSeats(request.getTotalSeats())
                .availableSeats(request.getTotalSeats())
                .tuitionFee(request.getTuitionFee() != null ? request.getTuitionFee() : java.math.BigDecimal.valueOf(1500.00))
                .semester(request.getSemester())
                .academicYear(request.getAcademicYear())
                .enrollmentDeadline(request.getEnrollmentDeadline())
                .deleted(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return toResponse(courseRepository.save(course));
    }

    @Transactional
    public CourseResponse updateCourse(Long id, CourseRequest request, Long userId, String userRole) {
        Course course = courseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + id));

        // Enforce ownership: ADMIN can edit any course, INSTRUCTOR can edit only their own
        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            if (!"INSTRUCTOR".equalsIgnoreCase(userRole) || course.getInstructorId() == null || !course.getInstructorId().equals(userId)) {
                throw new ForbiddenException("You do not have permission to update this course");
            }
        }

        if (request.getEnrollmentDeadline() != null && request.getEnrollmentDeadline().isBefore(LocalDateTime.now())) {
            throw new DeadlinePassedException("Enrollment deadline must be in the future");
        }

        int enrolledCount = course.getTotalSeats() - course.getAvailableSeats();
        if (request.getTotalSeats() < enrolledCount) {
            throw new IllegalArgumentException("Total seats (" + request.getTotalSeats() + ") cannot be less than currently enrolled students (" + enrolledCount + ")");
        }

        course.setCode(request.getCode());
        course.setTitle(request.getTitle());
        course.setDescription(request.getDescription());
        if (request.getDepartment() != null) {
            course.setDepartment(request.getDepartment());
        }
        if (request.getLevel() != null) {
            course.setLevel(request.getLevel().toUpperCase());
        }
        if (request.getTuitionFee() != null) {
            course.setTuitionFee(request.getTuitionFee());
        }
        course.setCredits(request.getCredits());
        course.setSemester(request.getSemester());
        course.setAcademicYear(request.getAcademicYear());
        course.setEnrollmentDeadline(request.getEnrollmentDeadline());

        int seatDiff = request.getTotalSeats() - course.getTotalSeats();
        course.setTotalSeats(request.getTotalSeats());
        course.setAvailableSeats(Math.max(0, course.getAvailableSeats() + seatDiff));
        course.setUpdatedAt(LocalDateTime.now());

        return toResponse(courseRepository.saveAndFlush(course));
    }

    @Transactional
    public void deleteCourse(Long id, String userRole) {
        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            throw new ForbiddenException("Only administrators can delete courses");
        }

        Course course = courseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + id));

        // Verify active enrollments before allowing deletion
        try {
            Map<String, Object> countResp = enrollmentClient.countActiveEnrollments(id);
            if (countResp != null && countResp.get("activeCount") instanceof Number count && count.intValue() > 0) {
                throw new ConflictException("Cannot delete course " + course.getCode() + " because it has " + count.intValue() + " active enrollment(s)");
            }
        } catch (ConflictException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Could not check active enrollments via enrollmentClient: {}", ex.getMessage());
        }

        course.setDeleted(true);
        course.setUpdatedAt(LocalDateTime.now());
        courseRepository.save(course);
    }

    @Transactional
    public CourseResponse reserveSeat(Long courseId) {
        Course course = courseRepository.findByIdAndDeletedFalse(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + courseId));

        LocalDateTime now = LocalDateTime.now();
        if (course.getEnrollmentDeadline() != null && course.getEnrollmentDeadline().isBefore(now)) {
            throw new DeadlinePassedException("Enrollment deadline has passed for course: " + course.getCode());
        }

        // Atomic conditional decrement
        int updatedRows = courseRepository.decrementAvailableSeat(courseId, now);
        if (updatedRows == 0) {
            // Re-fetch to distinguish between full and deadline passed
            Course current = courseRepository.findById(courseId).orElse(course);
            if (current.getEnrollmentDeadline() != null && current.getEnrollmentDeadline().isBefore(now)) {
                throw new DeadlinePassedException("Enrollment deadline has passed for course: " + current.getCode());
            }
            throw new CourseFullException("Course " + current.getCode() + " is full. No available seats.");
        }

        Course updated = courseRepository.findById(courseId).orElseThrow();
        return toResponse(updated);
    }

    @Transactional
    public CourseResponse releaseSeat(Long courseId) {
        Course course = courseRepository.findByIdAndDeletedFalse(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + courseId));

        int updatedRows = courseRepository.incrementAvailableSeat(courseId, LocalDateTime.now());
        if (updatedRows == 0) {
            log.warn("Attempted to release seat for course {} but already at max capacity", courseId);
        }

        Course updated = courseRepository.findById(courseId).orElseThrow();
        return toResponse(updated);
    }

    public Map<String, Object> getWhoAmI() {
        long currentCount = requestCounter.incrementAndGet();
        String host = "localhost";
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException ignored) {
        }

        Map<String, Object> info = new HashMap<>();
        info.put("service", applicationName);
        info.put("instanceId", instanceId != null ? instanceId : applicationName + ":" + serverPort);
        info.put("port", Integer.parseInt(serverPort));
        info.put("hostname", host);
        info.put("requestCount", currentCount);
        info.put("timestamp", LocalDateTime.now().toString());
        return info;
    }

    public CourseResponse toResponse(Course course) {
        return CourseResponse.builder()
                .id(course.getId())
                .code(course.getCode())
                .title(course.getTitle())
                .description(course.getDescription())
                .instructorId(course.getInstructorId())
                .department(course.getDepartment())
                .level(course.getLevel())
                .credits(course.getCredits())
                .totalSeats(course.getTotalSeats())
                .availableSeats(course.getAvailableSeats())
                .tuitionFee(course.getTuitionFee())
                .semester(course.getSemester())
                .academicYear(course.getAcademicYear())
                .enrollmentDeadline(course.getEnrollmentDeadline())
                .deleted(course.getDeleted())
                .createdAt(course.getCreatedAt())
                .updatedAt(course.getUpdatedAt())
                .version(course.getVersion())
                .build();
    }
}
