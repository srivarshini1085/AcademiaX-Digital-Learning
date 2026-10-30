package com.academiax.gateway;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** The gateway's perimeter rules, tested without starting Spring: token checks, header stripping, internal paths. */
class GatewaySecurityTest {

    private static final String SECRET = "test-secret-key-for-unit-tests-must-be-32-bytes-long";
    private final JwtVerifier verifier = new JwtVerifier(SECRET);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(verifier, new TraceStore());

    private static String token(String type, String role, long ttlMillis) {
        return Jwts.builder()
                .claim("userId", "5").claim("role", role).claim("token_type", type)
                .subject("student@academiax.edu")
                .expiration(new Date(System.currentTimeMillis() + ttlMillis))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    /** Runs the filter and returns the request the downstream service would receive (null if rejected). */
    private ServerWebExchange[] run(MockServerHttpRequest request) {
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        AtomicReference<ServerWebExchange> forwarded = new AtomicReference<>();
        GatewayFilterChain chain = ex -> { forwarded.set(ex); return Mono.empty(); };
        filter.filter(exchange, chain).block();
        return new ServerWebExchange[]{exchange, forwarded.get()};
    }

    @Test
    @DisplayName("JWT_SECRET shorter than 32 bytes fails startup")
    void weakSecretFailsFast() {
        assertThrows(IllegalStateException.class, () -> new JwtVerifier("too-short"));
        assertThrows(IllegalStateException.class, () -> new JwtVerifier(""));
    }

    @Test
    @DisplayName("Refresh token cannot be used as an API credential → 401")
    void refreshTokenRejected() {
        ServerWebExchange[] result = run(MockServerHttpRequest.get("/enrollments/my")
                .header("Authorization", "Bearer " + token("REFRESH", "STUDENT", 60_000)).build());
        assertEquals(HttpStatus.UNAUTHORIZED, result[0].getResponse().getStatusCode());
        assertNull(result[1], "request must not be forwarded");
    }

    @Test
    @DisplayName("Expired access token → 401")
    void expiredTokenRejected() {
        ServerWebExchange[] result = run(MockServerHttpRequest.get("/enrollments/my")
                .header("Authorization", "Bearer " + token("ACCESS", "STUDENT", -60_000)).build());
        assertEquals(HttpStatus.UNAUTHORIZED, result[0].getResponse().getStatusCode());
    }

    @Test
    @DisplayName("Client-sent X-User-* headers are replaced by the identity in the JWT")
    void spoofedHeadersStripped() {
        ServerWebExchange[] result = run(MockServerHttpRequest.get("/enrollments/my")
                .header("Authorization", "Bearer " + token("ACCESS", "STUDENT", 60_000))
                .header("X-User-Role", "ADMIN").header("X-User-Id", "1").build());
        assertNotNull(result[1]);
        assertEquals("STUDENT", result[1].getRequest().getHeaders().getFirst("X-User-Role"));
        assertEquals("5", result[1].getRequest().getHeaders().getFirst("X-User-Id"));
        assertNotNull(result[1].getRequest().getHeaders().getFirst("X-Correlation-Id"));
    }

    @Test
    @DisplayName("Saga-internal endpoints are refused at the gateway even with a valid token → 403")
    void internalEndpointsBlocked() {
        String bearer = "Bearer " + token("ACCESS", "STUDENT", 60_000);
        for (MockServerHttpRequest request : new MockServerHttpRequest[]{
                MockServerHttpRequest.put("/enrollments/7/confirm?paymentId=1").header("Authorization", bearer).build(),
                MockServerHttpRequest.put("/courses/3/reserve-seat").header("Authorization", bearer).build(),
                MockServerHttpRequest.put("/courses/3/release-seat").header("Authorization", bearer).build(),
                MockServerHttpRequest.post("/notifications").header("Authorization", bearer).build()}) {
            ServerWebExchange[] result = run(request);
            assertEquals(HttpStatus.FORBIDDEN, result[0].getResponse().getStatusCode(), request.getPath().value());
            assertNull(result[1]);
        }
    }

    @Test
    @DisplayName("Public catalogue reads need no token; writes do")
    void publicReadsOnly() {
        assertNotNull(run(MockServerHttpRequest.get("/courses?page=0").build())[1]);
        ServerWebExchange[] write = run(MockServerHttpRequest.post("/courses").build());
        assertEquals(HttpStatus.UNAUTHORIZED, write[0].getResponse().getStatusCode());
    }
}
