package com.academiax.course;

import com.academiax.course.client.EnrollmentClient;
import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.exception.*;
import com.academiax.course.service.CourseService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:course_test_db;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "eureka.client.enabled=false"
})
class CourseServiceTest {

    @Autowired
    private CourseService courseService;

    @MockBean
    private EnrollmentClient enrollmentClient;

    private CourseRequest validRequest(String code) {
        CourseRequest r = new CourseRequest();
        r.setCode(code);
        r.setTitle("Test Course " + code);
        r.setDescription("Test description");
        r.setDepartment("Computer Science");
        r.setLevel("UNDERGRADUATE");
        r.setCredits(3);
        r.setTotalSeats(10);
        r.setTuitionFee(BigDecimal.valueOf(1500));
        r.setSemester("Fall 2026");
        r.setAcademicYear("2026-2027");
        r.setEnrollmentDeadline(LocalDateTime.now().plusDays(30));
        return r;
    }

    @Test
    @DisplayName("CRUD: Create course succeeds for INSTRUCTOR role")
    void createCourse_succeedsForInstructor() {
        CourseResponse resp = courseService.createCourse(validRequest("CS001T"), 101L, "INSTRUCTOR");
        assertNotNull(resp.getId());
        assertEquals("CS001T", resp.getCode());
        assertEquals(101L, resp.getInstructorId(), "Instructor ID should be the authenticated user's ID");
    }

    @Test
    @DisplayName("CRUD: Create course fails for STUDENT role")
    void createCourse_failsForStudent() {
        assertThrows(ForbiddenException.class, () ->
                courseService.createCourse(validRequest("CS002T"), 1L, "STUDENT"));
    }

    @Test
    @DisplayName("CRUD: Duplicate course code returns ConflictException")
    void createCourse_duplicateCodeThrowsConflict() {
        courseService.createCourse(validRequest("CS003T"), 101L, "INSTRUCTOR");
        assertThrows(ConflictException.class, () ->
                courseService.createCourse(validRequest("CS003T"), 102L, "INSTRUCTOR"));
    }

    @Test
    @DisplayName("CRUD: Enrollment deadline in past returns DeadlinePassedException")
    void createCourse_pastDeadlineThrowsDeadlinePassed() {
        CourseRequest req = validRequest("CS004T");
        req.setEnrollmentDeadline(LocalDateTime.now().minusDays(1));
        assertThrows(DeadlinePassedException.class, () ->
                courseService.createCourse(req, 101L, "INSTRUCTOR"));
    }

    @Test
    @DisplayName("CRUD: Server-side pagination works")
    void getCoursesPaged_returnsPaginatedResults() {
        for (int i = 0; i < 5; i++) {
            courseService.createCourse(validRequest("PAGED" + i), 101L, "INSTRUCTOR");
        }
        Page<CourseResponse> page = courseService.getCoursesPaged(null, null, null, null, null, null, false, PageRequest.of(0, 2));
        assertEquals(2, page.getContent().size());
        assertTrue(page.getTotalElements() >= 5);
    }

    @Test
    @DisplayName("CRUD: Soft delete prevents course from appearing in search")
    void deleteCourse_softDeleteHidesFromSearch() {
        CourseResponse created = courseService.createCourse(validRequest("CS_DEL1"), 101L, "ADMIN");
        courseService.deleteCourse(created.getId(), "ADMIN");
        assertThrows(ResourceNotFoundException.class, () -> courseService.getCourseById(created.getId()));
    }

    @Test
    @DisplayName("Role: INSTRUCTOR cannot delete a course (only ADMIN can)")
    void deleteCourse_instructorForbidden() {
        CourseResponse created = courseService.createCourse(validRequest("CS_DEL2"), 101L, "INSTRUCTOR");
        assertThrows(ForbiddenException.class, () -> courseService.deleteCourse(created.getId(), "INSTRUCTOR"));
    }

    @Test
    @DisplayName("Ownership: INSTRUCTOR cannot edit another instructor's course")
    void updateCourse_cannotEditAnotherInstructorsCourse() {
        CourseResponse created = courseService.createCourse(validRequest("CS_OWN1"), 101L, "INSTRUCTOR");
        assertThrows(ForbiddenException.class, () ->
                courseService.updateCourse(created.getId(), validRequest("CS_OWN1"), 999L, "INSTRUCTOR"));
    }

    @Test
    @DisplayName("Ownership: ADMIN can edit any course")
    void updateCourse_adminCanEditAnyCourse() {
        CourseResponse created = courseService.createCourse(validRequest("CS_OWN2"), 101L, "INSTRUCTOR");
        CourseRequest update = validRequest("CS_OWN2");
        update.setTitle("Updated by Admin");
        CourseResponse updated = courseService.updateCourse(created.getId(), update, 999L, "ADMIN");
        assertEquals("Updated by Admin", updated.getTitle());
    }
}

