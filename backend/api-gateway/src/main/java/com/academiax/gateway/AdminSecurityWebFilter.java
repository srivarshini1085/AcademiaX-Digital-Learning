package com.academiax.gateway;

import io.jsonwebtoken.Claims;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Protects the gateway's own /admin/** endpoints. They are served by local controllers, so the route-level
 * GlobalFilter never sees them; without this filter they would be public.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AdminSecurityWebFilter implements WebFilter {

    private final JwtVerifier jwtVerifier;

    public AdminSecurityWebFilter(JwtVerifier jwtVerifier) {
        this.jwtVerifier = jwtVerifier;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (!path.startsWith("/admin") || HttpMethod.OPTIONS.equals(exchange.getRequest().getMethod())) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Authentication token is missing or malformed");
        }
        try {
            Claims claims = jwtVerifier.parseAccessToken(authHeader.substring(7).trim());
            if (!"ADMIN".equalsIgnoreCase(claims.get("role", String.class))) {
                return reject(exchange, HttpStatus.FORBIDDEN, "System Console is restricted to administrators");
            }
        } catch (Exception e) {
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Invalid or expired JWT");
        }
        return chain.filter(exchange);
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String json = String.format(
                "{\"timestamp\":\"%s\",\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"path\":\"%s\"}",
                LocalDateTime.now(), status.value(), status.getReasonPhrase(), message, exchange.getRequest().getPath().value());
        return response.writeWith(Mono.just(response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8))));
    }
}
