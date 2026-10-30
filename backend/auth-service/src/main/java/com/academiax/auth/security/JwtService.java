package com.academiax.auth.security;

import com.academiax.auth.entity.User;
import com.academiax.auth.exception.UnauthorizedException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HashMap;
import java.util.UUID;
import java.util.HexFormat;
import java.util.Map;

@Service
public class JwtService {

    @Value("${jwt.secret:}")
    private String jwtSecret;

    // 15 minutes = 900,000 ms
    @Value("${jwt.expiration:900000}")
    private long jwtExpiration;

    // 7 days = 604,800,000 ms
    @Value("${jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    @PostConstruct
    public void validateSecret() {
        if (jwtSecret == null || jwtSecret.trim().isEmpty() || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET environment variable is missing or shorter than 32 bytes (256 bits) required for HMAC-SHA256.");
        }
    }

    public String generateAccessToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", String.valueOf(user.getId()));
        claims.put("email", user.getEmail());
        claims.put("name", user.getName());
        claims.put("role", user.getRole().name());
        claims.put("department", user.getDepartment());
        claims.put("token_type", "ACCESS");

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        return Jwts.builder()
                .claims(claims)
                .id(UUID.randomUUID().toString()) // unique per token: two tokens issued in the same second must never collide
                .subject(user.getEmail())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String generateRefreshToken(User user, String familyId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", String.valueOf(user.getId()));
        claims.put("email", user.getEmail());
        claims.put("familyId", familyId);
        claims.put("token_type", "REFRESH");

        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshExpiration);

        return Jwts.builder()
                .claims(claims)
                .id(UUID.randomUUID().toString()) // unique per token: two tokens issued in the same second must never collide
                .subject(user.getEmail())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims validateToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Invalid or expired JWT: " + e.getMessage());
        }
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm unavailable", e);
        }
    }

    public String extractUsername(String token) {
        return validateToken(token).getSubject();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        Claims claims = validateToken(token);
        String username = claims.getSubject();
        String tokenType = claims.get("token_type", String.class);
        return username.equals(userDetails.getUsername()) &&
               "ACCESS".equalsIgnoreCase(tokenType) &&
               !claims.getExpiration().before(new Date());
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
