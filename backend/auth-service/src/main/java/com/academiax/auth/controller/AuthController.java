package com.academiax.auth.controller;

import com.academiax.auth.dto.*;
import com.academiax.auth.entity.UserRole;
import com.academiax.auth.exception.ForbiddenException;
import com.academiax.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication & User Management", description = "JWT login, token rotation, user management, and security sessions")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register new student account (public, student role only)")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate user with email and password (enforces 5-attempt lockout)")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token and issue new token pair (detects token reuse)")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refresh(request.getRefreshToken()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke current refresh token and terminate its family session")
    public ResponseEntity<Map<String, String>> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        if (request != null && request.getRefreshToken() != null) {
            authService.logout(request.getRefreshToken());
        }
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/logout-all")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Revoke all refresh token sessions across all devices for the current user")
    public ResponseEntity<Map<String, String>> logoutAll(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            Authentication authentication) {
        Long targetId = userId;
        if (targetId == null && authentication != null) {
            UserResponse currentUser = authService.getCurrentUser(authentication);
            targetId = currentUser.getId();
        }
        if (targetId != null) {
            authService.logoutAll(targetId);
        }
        return ResponseEntity.ok(Map.of("message", "All sessions successfully revoked"));
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get current authenticated user profile")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        return ResponseEntity.ok(authService.getCurrentUser(authentication));
    }

    @GetMapping("/profile")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get current user profile (using header or authentication context)")
    public ResponseEntity<UserResponse> getProfile(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            Authentication authentication) {
        if (userId != null) {
            return ResponseEntity.ok(authService.getUserById(userId));
        }
        return ResponseEntity.ok(authService.getCurrentUser(authentication));
    }

    @PutMapping("/profile")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update current user profile (name, department)")
    public ResponseEntity<UserResponse> updateProfile(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @Valid @RequestBody ProfileUpdateRequest request,
            Authentication authentication) {
        Long targetId = userId;
        if (targetId == null && authentication != null) {
            targetId = authService.getCurrentUser(authentication).getId();
        }
        if (targetId == null) {
            throw new ForbiddenException("Authentication required to update profile");
        }
        return ResponseEntity.ok(authService.updateProfile(targetId, request));
    }

    @GetMapping("/sessions")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List active session families for current user")
    public ResponseEntity<List<SessionResponse>> getSessions(
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            Authentication authentication) {
        Long targetId = userId;
        if (targetId == null && authentication != null) {
            targetId = authService.getCurrentUser(authentication).getId();
        }
        if (targetId == null) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(authService.getActiveSessions(targetId));
    }

    @GetMapping("/instructors")
    @Operation(summary = "Public faculty list (id, name, department) so the catalogue can show who teaches each course")
    public ResponseEntity<List<Map<String, Object>>> listInstructors() {
        return ResponseEntity.ok(authService.listInstructors());
    }

    @GetMapping("/directory")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Names for a set of user IDs, for rosters and admin tables (ADMIN or INSTRUCTOR)")
    public ResponseEntity<List<Map<String, Object>>> directory(
            @RequestParam List<Long> ids,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role) && !"INSTRUCTOR".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only staff can look up other users");
        }
        return ResponseEntity.ok(authService.directory(ids));
    }

    // Admin endpoints
    @PostMapping("/users/instructors")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create instructor account (ADMIN only)")
    public ResponseEntity<UserResponse> createInstructor(
            @Valid @RequestBody InstructorCreateRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can create instructor accounts");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.createInstructor(request));
    }

    @GetMapping("/users")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all users with search, role filter, and pagination (ADMIN only)")
    public ResponseEntity<Page<UserResponse>> listUsers(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) UserRole roleFilter,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view the user list");
        }
        PageRequest pageRequest = PageRequest.of(Math.max(0, page), Math.max(1, size), Sort.by(Sort.Direction.DESC, "id"));
        return ResponseEntity.ok(authService.listUsers(keyword, roleFilter, active, pageRequest));
    }

    @GetMapping("/users/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get user by ID (ADMIN only)")
    public ResponseEntity<UserResponse> getUserById(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view user details");
        }
        return ResponseEntity.ok(authService.getUserById(id));
    }

    @PutMapping("/users/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update user details or role (ADMIN only)")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UserUpdateRequest request,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can update users");
        }
        return ResponseEntity.ok(authService.updateUser(id, request));
    }

    @PutMapping("/users/{id}/status")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Activate or deactivate a user account (ADMIN only)")
    public ResponseEntity<UserResponse> toggleUserStatus(
            @PathVariable Long id,
            @RequestParam boolean active,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can activate/deactivate accounts");
        }
        return ResponseEntity.ok(authService.toggleUserStatus(id, active));
    }

    @GetMapping("/users/stats")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get user counts by role (ADMIN only)")
    public ResponseEntity<Map<String, Object>> getUserStats(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Only administrators can view user statistics");
        }
        return ResponseEntity.ok(authService.getUserStats());
    }
}
