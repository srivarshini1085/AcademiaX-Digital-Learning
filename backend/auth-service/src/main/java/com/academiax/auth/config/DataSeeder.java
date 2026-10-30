package com.academiax.auth.config;

import com.academiax.auth.entity.User;
import com.academiax.auth.entity.UserRole;
import com.academiax.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
@Profile("!test")
@Order(2)
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 1) {
            log.info("DataSeeder: Database already seeded, skipping.");
            return;
        }

        log.info("DataSeeder: Seeding instructors and students...");

        // 3 Instructors
        String[][] instructors = {
            {"Dr. Sarah Mitchell", "instructor1@academiax.edu", "Instr@123", "Computer Science"},
            {"Prof. James Chen", "instructor2@academiax.edu", "Instr@123", "Mathematics"},
            {"Dr. Maria Rodriguez", "instructor3@academiax.edu", "Instr@123", "Physics"}
        };

        for (String[] data : instructors) {
            if (userRepository.findByEmail(data[1]).isEmpty()) {
                userRepository.save(User.builder()
                        .name(data[0])
                        .email(data[1])
                        .passwordHash(passwordEncoder.encode(data[2]))
                        .role(UserRole.INSTRUCTOR)
                        .department(data[3])
                        .active(true)
                        .failedLoginAttempts(0)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());
                log.info("  Created instructor: {}", data[1]);
            }
        }

        // 10 Students
        String[][] students = {
            {"Alice Johnson", "student1@academiax.edu", "Student@123", "Computer Science"},
            {"Bob Williams", "student2@academiax.edu", "Student@123", "Mathematics"},
            {"Carol Davis", "student3@academiax.edu", "Student@123", "Physics"},
            {"David Brown", "student4@academiax.edu", "Student@123", "Computer Science"},
            {"Eve Wilson", "student5@academiax.edu", "Student@123", "Electrical Engineering"},
            {"Frank Miller", "student6@academiax.edu", "Student@123", "Mathematics"},
            {"Grace Lee", "student7@academiax.edu", "Student@123", "Computer Science"},
            {"Henry Taylor", "student8@academiax.edu", "Student@123", "Physics"},
            {"Isabel Martinez", "student9@academiax.edu", "Student@123", "Mathematics"},
            {"Jack Anderson", "student10@academiax.edu", "Student@123", "Computer Science"}
        };

        for (String[] data : students) {
            if (userRepository.findByEmail(data[1]).isEmpty()) {
                userRepository.save(User.builder()
                        .name(data[0])
                        .email(data[1])
                        .passwordHash(passwordEncoder.encode(data[2]))
                        .role(UserRole.STUDENT)
                        .department(data[3])
                        .active(true)
                        .failedLoginAttempts(0)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());
                log.info("  Created student: {}", data[1]);
            }
        }

        log.info("DataSeeder: Seeding complete. {} total users.", userRepository.count());
    }
}

