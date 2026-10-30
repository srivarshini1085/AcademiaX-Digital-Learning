package com.academiax.enrollment.config;

import com.academiax.enrollment.client.CourseClient;
import com.academiax.enrollment.client.PaymentClient;
import com.academiax.enrollment.dto.EnrollmentRequest;
import com.academiax.enrollment.dto.EnrollmentResponse;
import com.academiax.enrollment.repository.EnrollmentRepository;
import com.academiax.enrollment.service.EnrollmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Demo data that goes through the real saga (hold seat -> simulated payment -> confirmed, or waitlist),
 * so seat counts, rosters, revenue and notifications all agree. Nothing is written directly to other services' tables.
 *
 * Users come from auth-service's seeder: admin = 1, instructors = 2-4, students = 5-14.
 * Courses come from course-service's seeder: CS301 has 6 seats (seeded full + waitlist), CS499 has 10 (seeded nearly full).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Profile("!test")
public class EnrollmentDataSeeder {

    private static final String DEMO_CARD = "4242424242424242";
    private static final int MAX_ATTEMPTS = 40;

    private final EnrollmentRepository enrollmentRepository;
    private final EnrollmentService enrollmentService;
    private final CourseClient courseClient;
    private final PaymentClient paymentClient;

    @Value("${SEED_DATA:true}")
    private boolean seedData;

    @EventListener(ApplicationReadyEvent.class)
    public void seedInBackground() {
        if (!seedData) {
            return;
        }
        Thread seeder = new Thread(this::seedWhenDependenciesAreUp, "enrollment-seeder");
        seeder.setDaemon(true);
        seeder.start();
    }

    private void seedWhenDependenciesAreUp() {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (enrollmentRepository.count() > 0) {
                log.info("EnrollmentDataSeeder: enrollments already exist, skipping.");
                return;
            }
            try {
                Map<String, Long> courseIds = Map.of(
                        "CS101", courseId("CS101"), "CS201", courseId("CS201"), "CS301", courseId("CS301"),
                        "CS499", courseId("CS499"), "MATH201", courseId("MATH201"), "PHY101", courseId("PHY101"));
                seed(courseIds);
                log.info("EnrollmentDataSeeder: seeding complete, {} enrollments.", enrollmentRepository.count());
                return;
            } catch (Exception ex) {
                log.info("EnrollmentDataSeeder: dependencies not ready (attempt {}/{}): {}", attempt, MAX_ATTEMPTS, ex.getMessage());
                sleep(5000);
            }
        }
        log.warn("EnrollmentDataSeeder: gave up waiting for course/payment services; no demo enrollments were created.");
    }

    private void seed(Map<String, Long> courses) {
        // CS301 (6 seats): full, with two students on the waitlist
        for (long student = 5; student <= 10; student++) {
            enrollAndPay(student, courses.get("CS301"));
        }
        enrollmentService.joinWaitlist(courses.get("CS301"), 11L, "STUDENT");
        enrollmentService.joinWaitlist(courses.get("CS301"), 12L, "STUDENT");

        // CS499 (10 seats): nearly full, one seat left
        for (long student = 5; student <= 13; student++) {
            enrollAndPay(student, courses.get("CS499"));
        }

        // A few ordinary confirmed enrollments elsewhere
        enrollAndPay(5, courses.get("CS101"));
        enrollAndPay(6, courses.get("CS101"));
        enrollAndPay(7, courses.get("CS101"));
        enrollAndPay(5, courses.get("CS201"));
        enrollAndPay(8, courses.get("CS201"));
        enrollAndPay(6, courses.get("MATH201"));
        enrollAndPay(9, courses.get("MATH201"));
        enrollAndPay(7, courses.get("PHY101"));
        enrollAndPay(12, courses.get("PHY101"));
    }

    private void enrollAndPay(long studentId, Long courseId) {
        EnrollmentResponse held = enrollmentService.holdSeat(new EnrollmentRequest(courseId, null), studentId, "STUDENT");
        paymentClient.createPayment(
                Map.of("enrollmentId", held.getId(), "cardNumber", DEMO_CARD, "cardHolder", "Seeded Student",
                        "expiry", "12/30", "cvv", "123"),
                "seed-" + held.getId(), studentId, "STUDENT");
    }

    @SuppressWarnings("unchecked")
    private Long courseId(String code) {
        Map<String, Object> page = courseClient.searchByCode(code);
        List<Map<String, Object>> content = (List<Map<String, Object>>) page.get("content");
        if (content == null || content.isEmpty()) {
            throw new IllegalStateException("Course " + code + " not found yet");
        }
        return ((Number) content.get(0).get("id")).longValue();
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
