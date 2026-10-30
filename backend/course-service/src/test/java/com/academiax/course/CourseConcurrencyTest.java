package com.academiax.course;

import com.academiax.course.client.EnrollmentClient;
import com.academiax.course.dto.CourseResponse;
import com.academiax.course.entity.Course;
import com.academiax.course.exception.CourseFullException;
import com.academiax.course.repository.CourseRepository;
import com.academiax.course.service.CourseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:course_concurrency_db;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "eureka.client.enabled=false"
})
public class CourseConcurrencyTest {

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private CourseService courseService;

    @MockBean
    private EnrollmentClient enrollmentClient;

    private Long testCourseId;

    @BeforeEach
    void setup() {
        courseRepository.deleteAll();
        Course course = Course.builder()
                .code("CS301-CONC")
                .title("Concurrent Distributed Systems")
                .description("Testing concurrency")
                .instructorId(10L)
                .department("Computer Science")
                .level("UNDERGRADUATE")
                .credits(4)
                .totalSeats(5)
                .availableSeats(5)
                .tuitionFee(BigDecimal.valueOf(1500.00))
                .semester("Fall 2026")
                .academicYear("2026-2027")
                .enrollmentDeadline(LocalDateTime.now().plusDays(30))
                .deleted(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        Course saved = courseRepository.save(course);
        testCourseId = saved.getId();
    }

    @Test
    @DisplayName("Defect 1: 20 parallel seat reservations on a 5-seat course must result in exactly 5 successes and 15 failures")
    void testConcurrentReservationsNeverOverAllocate() throws InterruptedException {
        int totalThreads = 20;
        ExecutorService executor = Executors.newFixedThreadPool(totalThreads);
        CountDownLatch readyLatch = new CountDownLatch(totalThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(totalThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        List<Throwable> unexpectedExceptions = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < totalThreads; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await(); // wait for simultaneous start
                    courseService.reserveSeat(testCourseId);
                    successCount.incrementAndGet();
                } catch (CourseFullException e) {
                    failureCount.incrementAndGet();
                } catch (Throwable t) {
                    unexpectedExceptions.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Release all 20 threads simultaneously
        boolean finished = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All concurrency threads should finish within timeout");
        assertTrue(unexpectedExceptions.isEmpty(), "Unexpected exceptions encountered: " + unexpectedExceptions);

        assertEquals(5, successCount.get(), "Exactly 5 seat reservations must succeed for a 5-seat course");
        assertEquals(15, failureCount.get(), "Exactly 15 requests must be rejected with CourseFullException");

        Course finalCourse = courseRepository.findById(testCourseId).orElseThrow();
        assertEquals(0, finalCourse.getAvailableSeats(), "Final available seats must be exactly 0 (no over-allocation)");
    }
}

