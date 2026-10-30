package com.academiax.enrollment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.Map;

@FeignClient(name = "PAYMENT-SERVICE")
public interface PaymentClient {

    @PostMapping("/payments")
    Map<String, Object> createPayment(
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader("X-User-Role") String role
    );

    @PostMapping("/payments/{id}/confirm")
    Map<String, Object> confirmPayment(@PathVariable("id") Long id);

    @PostMapping("/payments/{id}/refund")
    Map<String, Object> refundPayment(@PathVariable("id") Long id);
}
