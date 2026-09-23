package com.academiax.enrollment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "PAYMENT-SERVICE")
public interface PaymentClient {

    @PostMapping("/payments")
    Map<String, Object> createPayment(@RequestBody Map<String, Object> request);

    @PostMapping("/payments/{id}/confirm")
    Map<String, Object> confirmPayment(Long id);
}
