package com.academiax.enrollment.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;

import java.util.Map;

@FeignClient(name = "COURSE-SERVICE")
public interface CourseClient {

    @GetMapping("/courses/{id}")
    Map<String, Object> getCourse(@PathVariable("id") Long id);

    @PutMapping("/courses/{id}/reserve-seat")
    Map<String, Object> reserveSeat(@PathVariable("id") Long id);

    @PutMapping("/courses/{id}/release-seat")
    Map<String, Object> releaseSeat(@PathVariable("id") Long id);
}
