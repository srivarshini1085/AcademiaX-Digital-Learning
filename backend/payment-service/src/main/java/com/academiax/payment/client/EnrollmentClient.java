package com.academiax.payment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(name = "ENROLLMENT-SERVICE")
public interface EnrollmentClient {

    @GetMapping("/enrollments/{id}")
    Map<String, Object> getEnrollment(@PathVariable("id") Long id,
                                      @RequestHeader("X-User-Id") Long userId,
                                      @RequestHeader("X-User-Role") String role);

    @PutMapping("/enrollments/{id}/confirm")
    Map<String, Object> confirmEnrollment(@PathVariable("id") Long id, @RequestParam("paymentId") Long paymentId);

    @PutMapping("/enrollments/{id}/fail")
    Map<String, Object> failEnrollment(@PathVariable("id") Long id, @RequestParam("reason") String reason);

    @PutMapping("/enrollments/{id}/refund")
    Map<String, Object> refundEnrollment(@PathVariable("id") Long id);
}
