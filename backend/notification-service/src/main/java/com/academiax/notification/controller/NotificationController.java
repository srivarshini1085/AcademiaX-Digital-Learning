package com.academiax.notification.controller;

import com.academiax.notification.dto.NotificationRequest;
import com.academiax.notification.dto.NotificationResponse;
import com.academiax.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "In-app notifications for seat holds, confirmations, and waitlist promotion")
public class NotificationController {

    private final NotificationService notificationService;

    @PostMapping
    @Operation(summary = "Create an in-app notification (Internal Feign endpoint)")
    public ResponseEntity<NotificationResponse> createNotification(@Valid @RequestBody NotificationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notificationService.createNotification(request));
    }

    @GetMapping("/my")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get in-app notifications for the logged-in user")
    public ResponseEntity<List<NotificationResponse>> getMyNotifications(
            @RequestHeader(value = "X-User-Id", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(notificationService.getMyNotifications(userId));
    }

    @GetMapping("/unread-count")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get unread notifications count for the bell badge")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader(value = "X-User-Id", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.ok(Map.of("unreadCount", 0L));
        }
        return ResponseEntity.ok(Map.of("unreadCount", notificationService.getUnreadCount(userId)));
    }

    @PutMapping("/{id}/read")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Mark a single notification as read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId) {
        if (userId != null) {
            notificationService.markAsRead(id, userId);
        }
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Mark all notifications as read for current user")
    public ResponseEntity<Void> markAllAsRead(
            @RequestHeader(value = "X-User-Id", required = false) Long userId) {
        if (userId != null) {
            notificationService.markAllAsRead(userId);
        }
        return ResponseEntity.noContent().build();
    }
}

