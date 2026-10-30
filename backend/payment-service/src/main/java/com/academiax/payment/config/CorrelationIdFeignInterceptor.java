package com.academiax.payment.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

/** Forwards the caller's X-Correlation-Id on every Feign call so one request can be traced across services. */
@Component
public class CorrelationIdFeignInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        String correlationId = MDC.get("correlationId");
        if (correlationId != null && !template.headers().containsKey("X-Correlation-Id")) {
            template.header("X-Correlation-Id", correlationId);
        }
    }
}
