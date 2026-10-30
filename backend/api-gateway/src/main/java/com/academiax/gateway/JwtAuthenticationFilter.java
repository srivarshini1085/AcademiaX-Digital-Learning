package com.academiax.gateway;

import io.jsonwebtoken.Claims;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    /**
     * Service-to-service saga endpoints. Feign calls reach them directly through Eureka, never through the gateway,
     * so any request for them arriving here is a client trying to skip a step (e.g. confirm without paying).
     */
    private static final List<Pattern> INTERNAL_ONLY = List.of(
            Pattern.compile("^/courses/\\d+/(reserve|release)-seat$"),
            Pattern.compile("^/enrollments/\\d+/(confirm|fail|refund)$"),
            Pattern.compile("^/enrollments/count$"),
            Pattern.compile("^/payments/\\d+/(confirm|fail)$")
    );

    private final JwtVerifier jwtVerifier;
    private final TraceStore traceStore;

    public JwtAuthenticationFilter(JwtVerifier jwtVerifier, TraceStore traceStore) {
        this.jwtVerifier = jwtVerifier;
        this.traceStore = traceStore;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();
        HttpMethod method = request.getMethod();

        // 1. Ensure correlation ID is present and propagated
        String incomingId = request.getHeaders().getFirst("X-Correlation-Id");
        String correlationId = (incomingId == null || incomingId.isBlank()) ? UUID.randomUUID().toString() : incomingId;
        exchange.getResponse().getHeaders().set("X-Correlation-Id", correlationId);

        if (isInternalOnly(path, method)) {
            return reject(exchange, HttpStatus.FORBIDDEN, "This endpoint is internal to the saga and cannot be called directly", path, correlationId);
        }

        // 2. Strip any client-supplied X-User-* headers to prevent header spoofing
        ServerHttpRequest.Builder requestBuilder = request.mutate()
                .headers(httpHeaders -> {
                    httpHeaders.remove("X-User-Id");
                    httpHeaders.remove("X-User-Role");
                    httpHeaders.remove("X-User-Email");
                    httpHeaders.remove("X-User-Name");
                    httpHeaders.remove("X-User-Department");
                })
                .header("X-Correlation-Id", correlationId);

        // 3. Check public endpoints
        boolean isPublic = isPublicPath(path, method);
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            if (isPublic) {
                return forward(exchange, chain, requestBuilder, correlationId);
            }
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Authentication token is missing or malformed", path, correlationId);
        }

        try {
            Claims claims = jwtVerifier.parseAccessToken(authHeader.substring(7).trim());
            requestBuilder.header("X-User-Id", String.valueOf(claims.get("userId")))
                    .header("X-User-Role", claims.get("role", String.class));

            String email = claims.get("email", String.class);
            String name = claims.get("name", String.class);
            String department = claims.get("department", String.class);
            if (email != null) requestBuilder.header("X-User-Email", email);
            if (name != null) requestBuilder.header("X-User-Name", name);
            if (department != null) requestBuilder.header("X-User-Department", department);

            return forward(exchange, chain, requestBuilder, correlationId);
        } catch (Exception e) {
            if (isPublic) {
                // If it's a public endpoint with an expired/invalid token, still allow public access
                return forward(exchange, chain, requestBuilder, correlationId);
            }
            return reject(exchange, HttpStatus.UNAUTHORIZED, "Invalid or expired JWT", path, correlationId);
        }
    }

    private Mono<Void> forward(ServerWebExchange exchange, GatewayFilterChain chain,
                               ServerHttpRequest.Builder requestBuilder, String correlationId) {
        ServerWebExchange mutated = exchange.mutate().request(requestBuilder.build()).build();
        long startedAt = System.currentTimeMillis();
        return chain.filter(mutated).doFinally(signal -> {
            URI target = mutated.getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR);
            HttpStatusCode status = mutated.getResponse().getStatusCode();
            traceStore.record(correlationId, String.valueOf(exchange.getRequest().getMethod()),
                    exchange.getRequest().getPath().value(), status != null ? status.value() : 0,
                    startedAt, System.currentTimeMillis() - startedAt,
                    target != null ? target.getHost() + ":" + target.getPort() : null);
        });
    }

    private boolean isInternalOnly(String path, HttpMethod method) {
        if (path.equals("/notifications") && HttpMethod.POST.equals(method)) {
            return true;
        }
        return INTERNAL_ONLY.stream().anyMatch(p -> p.matcher(path).matches());
    }

    private boolean isPublicPath(String path, HttpMethod method) {
        if (path.startsWith("/auth/register") ||
            path.startsWith("/auth/login") ||
            path.startsWith("/auth/refresh") ||
            path.equals("/auth/logout") ||
            (path.equals("/auth/instructors") && HttpMethod.GET.equals(method)) ||
            path.startsWith("/swagger-ui") ||
            path.startsWith("/v3/api-docs")) {
            return true;
        }
        // Public read-only access to the course catalogue (includes /courses/whoami for the load-balancing demo)
        return path.startsWith("/courses") && HttpMethod.GET.equals(method);
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status, String message, String path, String correlationId) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String json = String.format(
                "{\"timestamp\":\"%s\",\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"path\":\"%s\",\"correlationId\":\"%s\"}",
                LocalDateTime.now(), status.value(), status.getReasonPhrase(), message.replace("\"", "\\\""), path, correlationId
        );

        DataBuffer buffer = response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
