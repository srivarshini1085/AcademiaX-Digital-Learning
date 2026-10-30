package com.academiax.enrollment.config;

import com.academiax.enrollment.exception.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class CustomFeignErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultDecoder = new Default();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Exception decode(String methodKey, Response response) {
        String message = "Downstream service error";
        try {
            if (response.body() != null) {
                try (InputStream bodyIs = response.body().asInputStream()) {
                    String body = new String(bodyIs.readAllBytes(), StandardCharsets.UTF_8);
                    try {
                        JsonNode jsonNode = objectMapper.readTree(body);
                        if (jsonNode.has("message")) {
                            message = jsonNode.get("message").asText();
                        }
                    } catch (Exception ignored) {
                        message = body;
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to read Feign response body", e);
        }

        return switch (response.status()) {
            case 404 -> new ResourceNotFoundException(message);
            case 409 -> {
                if (message.toLowerCase().contains("full") || message.toLowerCase().contains("seat")) {
                    yield new CourseFullException(message);
                }
                yield new ConflictException(message);
            }
            case 422 -> new DeadlinePassedException(message);
            case 403 -> new ForbiddenException(message);
            case 400 -> new IllegalArgumentException(message);
            default -> defaultDecoder.decode(methodKey, response);
        };
    }
}

