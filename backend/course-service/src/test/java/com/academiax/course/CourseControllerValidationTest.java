package com.academiax.course;

import com.academiax.course.controller.CourseController;
import com.academiax.course.dto.CourseRequest;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.exception.ForbiddenException;
import com.academiax.course.exception.GlobalExceptionHandler;
import com.academiax.course.service.CourseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Controller-level checks: Bean Validation → 400 with fieldErrors, and the shared ApiError shape. */
class CourseControllerValidationTest {

    /** Hand-written stub: Mockito cannot subclass concrete classes on newer JDKs (25+). */
    private static class StubCourseService extends CourseService {
        int calls;
        StubCourseService() { super(null, null); }
        @Override
        public CourseResponse createCourse(CourseRequest request, Long userId, String userRole) {
            calls++;
            if (!"ADMIN".equals(userRole) && !"INSTRUCTOR".equals(userRole)) {
                throw new ForbiddenException("Only instructors and administrators can create courses");
            }
            return CourseResponse.builder().id(1L).code(request.getCode()).build();
        }
    }

    private final StubCourseService courseService = new StubCourseService();
    private MockMvc mvc;

    private static final String VALID = """
            {"code":"CS999","title":"Valid Course","description":"d","department":"Computer Science","level":"Undergraduate",
             "credits":3,"totalSeats":10,"tuitionFee":1000,"semester":"Fall 2026","academicYear":"2026-27",
             "enrollmentDeadline":"2027-01-01T00:00:00"}""";

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new CourseController(courseService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /courses with invalid fields → 400, fieldErrors per field, correlationId echoed")
    void invalidCourseReturns400WithFieldErrors() throws Exception {
        mvc.perform(post("/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Role", "ADMIN").header("X-User-Id", "1")
                        .header("X-Correlation-Id", "test-cid-1")
                        .content("{\"code\":\"\",\"credits\":0,\"totalSeats\":0,\"tuitionFee\":-5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.correlationId").value("test-cid-1"))
                .andExpect(jsonPath("$.fieldErrors.code").exists())
                .andExpect(jsonPath("$.fieldErrors.title").exists())
                .andExpect(jsonPath("$.fieldErrors.credits").exists())
                .andExpect(jsonPath("$.fieldErrors.totalSeats").exists())
                .andExpect(jsonPath("$.fieldErrors.tuitionFee").exists())
                .andExpect(jsonPath("$.fieldErrors.enrollmentDeadline").exists());
        assertEquals(0, courseService.calls, "invalid input must never reach the service");
    }

    @Test
    @DisplayName("POST /courses as STUDENT → 403 in the ApiError format")
    void wrongRoleReturns403() throws Exception {
        mvc.perform(post("/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Role", "STUDENT").header("X-User-Id", "5")
                        .content(VALID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.path").value("/courses"));
    }
}
