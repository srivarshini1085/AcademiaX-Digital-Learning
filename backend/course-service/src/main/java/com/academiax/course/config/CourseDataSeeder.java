package com.academiax.course.config;

import com.academiax.course.entity.Course;
import com.academiax.course.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
@Profile("!test")
public class CourseDataSeeder implements CommandLineRunner {

    private final CourseRepository courseRepository;

    @Value("${SEED_DATA:true}")
    private boolean seedData;

    @Override
    public void run(String... args) {
        if (!seedData || courseRepository.count() > 0) {
            log.info("CourseDataSeeder: Courses already exist, skipping.");
            return;
        }

        log.info("CourseDataSeeder: Seeding 12 courses...");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime futureDeadline = now.plusMonths(3);
        LocalDateTime pastDeadline = now.minusDays(1);
        String acYear = "2026-27";

        Course[] courses = {
            Course.builder().code("CS101").title("Introduction to Computer Science").description("Fundamentals of programming, algorithms and data structures.").department("Computer Science").semester("Fall 2026").academicYear(acYear).credits(4).level("UNDERGRADUATE").totalSeats(40).availableSeats(35).tuitionFee(new BigDecimal("2500.00")).instructorId(2L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("CS201").title("Data Structures & Algorithms").description("Advanced data structures, sorting, searching and graph algorithms.").department("Computer Science").semester("Fall 2026").academicYear(acYear).credits(4).level("UNDERGRADUATE").totalSeats(35).availableSeats(28).tuitionFee(new BigDecimal("2500.00")).instructorId(2L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("CS301").title("Operating Systems").description("Process management, memory, file systems and concurrency. Small seminar section: fills fast.").department("Computer Science").semester("Fall 2026").academicYear(acYear).credits(3).level("UNDERGRADUATE").totalSeats(6).availableSeats(6).tuitionFee(new BigDecimal("2000.00")).instructorId(2L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("MATH201").title("Linear Algebra").description("Vectors, matrices, eigenvalues and linear transformations.").department("Mathematics").semester("Fall 2026").academicYear(acYear).credits(3).level("UNDERGRADUATE").totalSeats(45).availableSeats(38).tuitionFee(new BigDecimal("1800.00")).instructorId(3L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("MATH301").title("Probability & Statistics").description("Random variables, distributions, hypothesis testing and regression.").department("Mathematics").semester("Fall 2026").academicYear(acYear).credits(3).level("UNDERGRADUATE").totalSeats(40).availableSeats(30).tuitionFee(new BigDecimal("1800.00")).instructorId(3L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("MATH401").title("Abstract Algebra").description("Groups, rings, fields and advanced algebraic structures.").department("Mathematics").semester("Fall 2026").academicYear(acYear).credits(3).level("GRADUATE").totalSeats(25).availableSeats(20).tuitionFee(new BigDecimal("3000.00")).instructorId(3L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("PHY101").title("Classical Mechanics").description("Newton's laws, kinematics, energy, rotational motion.").department("Physics").semester("Fall 2026").academicYear(acYear).credits(4).level("UNDERGRADUATE").totalSeats(50).availableSeats(42).tuitionFee(new BigDecimal("2200.00")).instructorId(4L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("PHY201").title("Electromagnetism").description("Electric and magnetic fields, Maxwell's equations, EM waves.").department("Physics").semester("Fall 2026").academicYear(acYear).credits(4).level("UNDERGRADUATE").totalSeats(40).availableSeats(32).tuitionFee(new BigDecimal("2200.00")).instructorId(4L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("PHY401").title("Quantum Mechanics").description("Wave functions, Schrödinger equation, operators and spin.").department("Physics").semester("Fall 2026").academicYear(acYear).credits(3).level("GRADUATE").totalSeats(20).availableSeats(15).tuitionFee(new BigDecimal("3500.00")).instructorId(4L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("CS450").title("Machine Learning").description("Supervised and unsupervised learning, neural networks, evaluation.").department("Computer Science").semester("Fall 2026").academicYear(acYear).credits(3).level("GRADUATE").totalSeats(30).availableSeats(25).tuitionFee(new BigDecimal("3200.00")).instructorId(2L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("CS499").title("Capstone: Software Engineering").description("Team-based software project with industry mentors.").department("Computer Science").semester("Fall 2026").academicYear(acYear).credits(4).level("UNDERGRADUATE").totalSeats(10).availableSeats(1).tuitionFee(new BigDecimal("2800.00")).instructorId(2L).enrollmentDeadline(futureDeadline).deleted(false).createdAt(now).updatedAt(now).build(),
            Course.builder().code("MATH101").title("Calculus I (Closed)").description("Limits, derivatives and integrals. Enrollment closed.").department("Mathematics").semester("Spring 2026").academicYear("2025-26").credits(4).level("UNDERGRADUATE").totalSeats(50).availableSeats(10).tuitionFee(new BigDecimal("1500.00")).instructorId(3L).enrollmentDeadline(pastDeadline).deleted(false).createdAt(now).updatedAt(now).build()
        };

        for (Course course : courses) {
            // Every course starts empty: seats are only taken by real enrollments created by the enrollment-service seeder.
            course.setAvailableSeats(course.getTotalSeats());
            courseRepository.save(course);
            log.info("  Created course: {} — {}", course.getCode(), course.getTitle());
        }

        log.info("CourseDataSeeder: Seeding complete. {} total courses.", courseRepository.count());
    }
}

