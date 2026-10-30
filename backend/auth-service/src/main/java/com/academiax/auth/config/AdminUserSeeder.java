package com.academiax.auth.config;

import com.academiax.auth.entity.User;
import com.academiax.auth.entity.UserRole;
import com.academiax.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
@Order(1) // Runs before DataSeeder so the admin is user 1 and the instructors are users 2-4 (course seed data relies on it)
public class AdminUserSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_EMAIL:admin@academiax.edu}")
    private String adminEmail;

    @Value("${ADMIN_PASSWORD:Admin@123}")
    private String adminPassword;

    @Value("${ADMIN_NAME:System Administrator}")
    private String adminName;

    @Value("${ADMIN_DEPARTMENT:Administration}")
    private String adminDepartment;

    @Override
    public void run(String... args) {
        if (userRepository.findByEmail(adminEmail).isEmpty()) {
            log.info("Seeding initial administrator account: {}", adminEmail);
            User admin = User.builder()
                    .name(adminName)
                    .email(adminEmail)
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .role(UserRole.ADMIN)
                    .department(adminDepartment)
                    .active(true)
                    .failedLoginAttempts(0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            userRepository.save(admin);
            log.info("Administrator account seeded successfully.");
        }
    }
}

