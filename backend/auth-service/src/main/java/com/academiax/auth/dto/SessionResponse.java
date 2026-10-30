package com.academiax.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionResponse {
    private String familyId;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private boolean active;
}

