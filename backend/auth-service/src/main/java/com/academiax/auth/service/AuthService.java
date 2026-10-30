package com.academiax.auth.service;

import com.academiax.auth.dto.*;
import com.academiax.auth.entity.RefreshToken;
import com.academiax.auth.entity.User;
import com.academiax.auth.entity.UserRole;
import com.academiax.auth.exception.*;
import com.academiax.auth.repository.RefreshTokenRepository;
import com.academiax.auth.repository.UserRepository;
import com.academiax.auth.security.JwtService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("An account with email " + request.getEmail() + " already exists");
        }

        // Enforce privilege: public registration is strictly for STUDENT role
        User user = User.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(UserRole.STUDENT)
                .department(request.getDepartment().trim())
                .active(true)
                .failedLoginAttempts(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    @Transactional(noRollbackFor = {BadCredentialsException.class, AccountLockedException.class})
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        // Check if account is locked
        if (user.getLockoutUntil() != null && user.getLockoutUntil().isAfter(LocalDateTime.now())) {
            long remainingSeconds = Duration.between(LocalDateTime.now(), user.getLockoutUntil()).getSeconds();
            long remainingMinutes = (remainingSeconds / 60) + 1;
            throw new AccountLockedException("Account is temporarily locked due to 5 consecutive failed login attempts. Please try again in " + remainingMinutes + " minute(s).");
        }

        // Check if account is active
        if (Boolean.FALSE.equals(user.getActive())) {
            throw new UnauthorizedException("Your account has been deactivated. Please contact the administrator.");
        }

        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int failed = (user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts()) + 1;
            user.setFailedLoginAttempts(failed);
            if (failed >= 5) {
                user.setLockoutUntil(LocalDateTime.now().plusMinutes(15));
                userRepository.save(user);
                throw new AccountLockedException("Account locked: 5 consecutive failed login attempts reached. Locked for 15 minutes.");
            }
            userRepository.save(user);
            int attemptsLeft = 5 - failed;
            throw new BadCredentialsException("Invalid email or password. " + attemptsLeft + " attempt(s) remaining before account lockout.");
        }

        // Login success: reset lockout
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Generate tokens and create token family
        String familyId = UUID.randomUUID().toString();
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user, familyId);

        RefreshToken tokenEntity = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(jwtService.hashToken(refreshToken))
                .familyId(familyId)
                .revoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        refreshTokenRepository.save(tokenEntity);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .department(user.getDepartment())
                .build();
    }

    // Revocations (reuse detection, expiry) must be committed even though we then throw 401.
    @Transactional(noRollbackFor = UnauthorizedException.class)
    public AuthResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalArgumentException("Refresh token is required");
        }

        Claims claims;
        try {
            claims = jwtService.validateToken(refreshToken);
        } catch (Exception ex) {
            throw new UnauthorizedException("Invalid or expired refresh token: " + ex.getMessage());
        }

        String tokenType = claims.get("token_type", String.class);
        if (!"REFRESH".equalsIgnoreCase(tokenType)) {
            throw new UnauthorizedException("Invalid token type. An access token cannot be used to refresh sessions.");
        }

        String familyId = claims.get("familyId", String.class);
        String email = claims.getSubject();
        String tokenHash = jwtService.hashToken(refreshToken);

        Optional<RefreshToken> storedTokenOpt;
        try {
            storedTokenOpt = refreshTokenRepository.findByTokenHash(tokenHash);
        } catch (org.springframework.dao.IncorrectResultSizeDataAccessException ex) {
            // Multiple records with same hash — reuse detected, revoke family
            log.warn("Multiple records found for token hash in family {}. Revoking family.", familyId);
            if (familyId != null) {
                refreshTokenRepository.revokeFamily(familyId);
            }
            throw new UnauthorizedException("Security violation: Token reuse detected. Sessions revoked.");
        }
        if (storedTokenOpt.isEmpty()) {
            if (familyId != null) {
                log.warn("Unknown refresh token presented for family {}. Revoking family.", familyId);
                refreshTokenRepository.revokeFamily(familyId);
            }
            throw new UnauthorizedException("Invalid refresh token. Session terminated.");
        }

        RefreshToken storedToken = storedTokenOpt.get();

        // Detect reuse: if token is already marked revoked, revoke the ENTIRE family!
        if (Boolean.TRUE.equals(storedToken.getRevoked())) {
            log.warn("Security Alert: Refresh token reuse detected for user {} family {}. Revoking family.", email, storedToken.getFamilyId());
            refreshTokenRepository.revokeFamily(storedToken.getFamilyId());
            throw new UnauthorizedException("Security violation: Refresh token reuse detected. All sessions in this chain have been revoked.");
        }

        // Check expiration
        if (storedToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new UnauthorizedException("Refresh token expired. Please log in again.");
        }

        // Rotate: revoke the current token
        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (Boolean.FALSE.equals(user.getActive())) {
            throw new UnauthorizedException("User account is deactivated.");
        }

        // Issue new access token and new refresh token in the same family
        String newAccessToken = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user, storedToken.getFamilyId());

        RefreshToken nextToken = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(jwtService.hashToken(newRefreshToken))
                .familyId(storedToken.getFamilyId())
                .revoked(false)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        refreshTokenRepository.save(nextToken);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .department(user.getDepartment())
                .build();
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            String hash = jwtService.hashToken(refreshToken);
            refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
                token.setRevoked(true);
                refreshTokenRepository.save(token);
                refreshTokenRepository.revokeFamily(token.getFamilyId());
            });
        }
    }

    @Transactional
    public void logoutAll(Long userId) {
        refreshTokenRepository.revokeAllForUser(userId);
    }

    public List<SessionResponse> getActiveSessions(Long userId) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findByUserIdAndRevokedFalse(userId);
        Map<String, SessionResponse> familyMap = new HashMap<>();

        for (RefreshToken t : activeTokens) {
            if (!t.getExpiresAt().isBefore(LocalDateTime.now())) {
                familyMap.putIfAbsent(t.getFamilyId(), SessionResponse.builder()
                        .familyId(t.getFamilyId())
                        .createdAt(t.getCreatedAt())
                        .expiresAt(t.getExpiresAt())
                        .active(true)
                        .build());
            }
        }
        return new ArrayList<>(familyMap.values());
    }

    public UserResponse getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));
        return toUserResponse(user);
    }

    public List<Map<String, Object>> listInstructors() {
        return userRepository.findByRole(UserRole.INSTRUCTOR).stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName(),
                        "department", u.getDepartment() != null ? u.getDepartment() : ""))
                .toList();
    }

    public List<Map<String, Object>> directory(List<Long> ids) {
        return userRepository.findAllById(ids.stream().limit(200).toList()).stream()
                .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getName(), "email", u.getEmail(),
                        "role", u.getRole().name(), "department", u.getDepartment() != null ? u.getDepartment() : ""))
                .toList();
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return toUserResponse(user);
    }

    @Transactional
    public UserResponse updateProfile(Long userId, ProfileUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        user.setName(request.getName().trim());
        user.setDepartment(request.getDepartment().trim());
        user.setUpdatedAt(LocalDateTime.now());
        return toUserResponse(userRepository.save(user));
    }

    // Admin operations
    @Transactional
    public UserResponse createInstructor(InstructorCreateRequest request) {
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new ConflictException("User already exists with email: " + request.getEmail());
        }

        User instructor = User.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(UserRole.INSTRUCTOR)
                .department(request.getDepartment().trim())
                .active(true)
                .failedLoginAttempts(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return toUserResponse(userRepository.save(instructor));
    }

    public Page<UserResponse> listUsers(String keyword, UserRole role, Boolean active, Pageable pageable) {
        return userRepository.searchUsers(keyword, role, active, pageable).map(this::toUserResponse);
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        user.setName(request.getName().trim());
        user.setDepartment(request.getDepartment().trim());
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }
        user.setUpdatedAt(LocalDateTime.now());
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse toggleUserStatus(Long id, boolean active) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        user.setActive(active);
        user.setUpdatedAt(LocalDateTime.now());
        return toUserResponse(userRepository.save(user));
    }

    public Map<String, Object> getUserStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalStudents", userRepository.countByRole(UserRole.STUDENT));
        stats.put("totalInstructors", userRepository.countByRole(UserRole.INSTRUCTOR));
        stats.put("totalAdmins", userRepository.countByRole(UserRole.ADMIN));
        stats.put("totalUsers", userRepository.count());
        return stats;
    }

    public UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .department(user.getDepartment())
                .active(user.getActive())
                .failedLoginAttempts(user.getFailedLoginAttempts())
                .lockoutUntil(user.getLockoutUntil())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
