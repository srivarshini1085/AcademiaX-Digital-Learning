package com.academiax.course.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

@FeignClient(name = "ENROLLMENT-SERVICE")
public interface EnrollmentClient {

    @GetMapping("/enrollments/count")
    Map<String, Object> countActiveEnrollments(@RequestParam("courseId") Long courseId);
}

