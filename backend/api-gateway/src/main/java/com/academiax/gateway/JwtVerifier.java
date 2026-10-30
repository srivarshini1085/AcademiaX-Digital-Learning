package com.academiax.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

/**
 * Single place where the gateway verifies access tokens. Fails application startup if JWT_SECRET is weak or missing.
 */
@Component
public class JwtVerifier {

    private final SecretKey key;

    public JwtVerifier(@Value("${jwt.secret:}") String jwtSecret) {
        if (jwtSecret == null || jwtSecret.isBlank() || jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET environment variable is missing or shorter than 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    /** Parses and verifies an access token. Refresh tokens are rejected so they can never be used as API credentials. */
    public Claims parseAccessToken(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        String tokenType = claims.get("token_type", String.class);
        if (!"ACCESS".equalsIgnoreCase(tokenType)) {
            throw new JwtException("Invalid token type: only access tokens may call the API");
        }
        if (claims.get("userId") == null || claims.get("role") == null) {
            throw new JwtException("Token payload missing required user claims");
        }
        return claims;
    }
}
