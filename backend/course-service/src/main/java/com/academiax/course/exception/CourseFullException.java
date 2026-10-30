package com.academiax.course.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class CourseFullException extends RuntimeException {
    public CourseFullException(String message) {
        super(message);
    }
}

