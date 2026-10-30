package com.academiax.course.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Tags every response with X-Served-By (load-balancing proof), carries X-Correlation-Id into the logs (MDC),
 * and remembers recent hops so the gateway can assemble a request trace from GET /internal/trace/{id}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ResponseHeaderFilter implements Filter {

    private static final int MAX_HOPS = 1000;
    private static final String TRACE_PREFIX = "/internal/trace/";

    private final Deque<String> hops = new ConcurrentLinkedDeque<>();

    @Value("${spring.application.name:course-service}")
    private String applicationName;

    @Value("${eureka.instance.instance-id:course-service}")
    private String instanceId;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest) || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }

        httpResponse.setHeader("X-Served-By", instanceId);

        String uri = httpRequest.getRequestURI();
        if (uri.startsWith(TRACE_PREFIX)) {
            writeTrace(uri.substring(TRACE_PREFIX.length()), httpResponse);
            return;
        }

        String correlationId = httpRequest.getHeader("X-Correlation-Id");
        if (correlationId == null || correlationId.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        httpResponse.setHeader("X-Correlation-Id", correlationId);
        MDC.put("correlationId", correlationId);
        long startedAt = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove("correlationId");
            recordHop(correlationId, httpRequest.getMethod(), uri, httpResponse.getStatus(), startedAt);
        }
    }

    private void recordHop(String correlationId, String method, String path, int status, long startedAt) {
        String json = String.format(
                "{\"correlationId\":\"%s\",\"service\":\"%s\",\"instanceId\":\"%s\",\"method\":\"%s\",\"path\":\"%s\",\"status\":%d,\"startedAt\":%d,\"durationMs\":%d}",
                escape(correlationId), applicationName, instanceId, method, escape(path), status, startedAt,
                System.currentTimeMillis() - startedAt);
        hops.addLast(json);
        while (hops.size() > MAX_HOPS) {
            hops.pollFirst();
        }
    }

    private void writeTrace(String correlationId, HttpServletResponse response) throws IOException {
        String needle = "\"correlationId\":\"" + escape(correlationId) + "\"";
        StringBuilder body = new StringBuilder("[");
        for (String hop : hops) {
            if (hop.contains(needle)) {
                if (body.length() > 1) body.append(',');
                body.append(hop);
            }
        }
        body.append(']');
        response.setContentType("application/json");
        response.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String escape(String value) {
        return value.replace("\\", "").replace("\"", "");
    }
}
