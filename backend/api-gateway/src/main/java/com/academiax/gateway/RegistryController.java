package com.academiax.gateway;

import lombok.RequiredArgsConstructor;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.cloud.netflix.eureka.EurekaServiceInstance;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.*;

/**
 * ADMIN-only System Console endpoints (guarded by {@link AdminSecurityWebFilter}).
 * Everything here is read from Eureka or from the live instances, nothing is hardcoded.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class RegistryController {

    private static final Duration INSTANCE_TIMEOUT = Duration.ofSeconds(2);
    private static final ParameterizedTypeReference<List<Map<String, Object>>> HOP_LIST = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<Map<String, Object>> JSON_MAP = new ParameterizedTypeReference<>() {};

    private final DiscoveryClient discoveryClient;
    private final TraceStore traceStore;
    private final WebClient webClient = WebClient.builder().build();

    @GetMapping("/registry")
    public ResponseEntity<Map<String, Object>> getRegistryStatus() {
        List<String> services = discoveryClient.getServices();
        Map<String, List<Map<String, Object>>> registry = new TreeMap<>();

        int totalInstances = 0;

        for (String serviceName : services) {
            List<Map<String, Object>> instanceList = new ArrayList<>();
            for (ServiceInstance instance : discoveryClient.getInstances(serviceName)) {
                Map<String, Object> instData = new LinkedHashMap<>();
                instData.put("instanceId", instance.getInstanceId() != null ? instance.getInstanceId() : instance.getHost() + ":" + instance.getPort());
                instData.put("serviceId", instance.getServiceId());
                instData.put("host", instance.getHost());
                instData.put("port", instance.getPort());
                instData.put("uri", instance.getUri().toString());
                instData.put("status", instance instanceof EurekaServiceInstance eureka
                        ? eureka.getInstanceInfo().getStatus().name() : "UNKNOWN");
                instData.put("lastRenewal", instance instanceof EurekaServiceInstance eureka
                        ? eureka.getInstanceInfo().getLastUpdatedTimestamp() : null);
                instanceList.add(instData);
                totalInstances++;
            }
            registry.put(serviceName, instanceList);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("servicesCount", services.size());
        response.put("totalInstances", totalInstances);
        response.put("services", registry);
        response.put("timestamp", new Date());

        return ResponseEntity.ok(response);
    }

    /** Every hop recorded for one correlation ID: the gateway's own plus each service instance's, in time order. */
    @GetMapping("/trace/{correlationId}")
    public Mono<Map<String, Object>> getTrace(@PathVariable String correlationId) {
        Flux<Map<String, Object>> serviceHops = Flux.fromIterable(allServiceInstances())
                .flatMap(instance -> webClient.get()
                        .uri(instance.getUri() + "/internal/trace/" + correlationId)
                        .retrieve()
                        .bodyToMono(HOP_LIST)
                        .timeout(INSTANCE_TIMEOUT)
                        .onErrorResume(e -> Mono.just(List.of()))
                        .flatMapMany(Flux::fromIterable));

        return Flux.concat(Flux.fromIterable(traceStore.find(correlationId)), serviceHops)
                .collectList()
                .map(hops -> {
                    List<Map<String, Object>> sorted = new ArrayList<>(hops);
                    sorted.sort(Comparator.comparingLong(h -> ((Number) h.get("startedAt")).longValue()));
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("correlationId", correlationId);
                    result.put("hops", sorted);
                    return result;
                });
    }

    /** Resilience4j circuit breaker state from every instance that exposes /actuator/circuitbreakers. */
    @GetMapping("/circuitbreakers")
    public Mono<List<Map<String, Object>>> getCircuitBreakers() {
        return Flux.fromIterable(allServiceInstances())
                .flatMap(instance -> webClient.get()
                        .uri(instance.getUri() + "/actuator/circuitbreakers")
                        .retrieve()
                        .bodyToMono(JSON_MAP)
                        .timeout(INSTANCE_TIMEOUT)
                        .map(body -> {
                            Map<String, Object> entry = new LinkedHashMap<>();
                            entry.put("serviceId", instance.getServiceId());
                            entry.put("instanceId", instance.getInstanceId());
                            entry.put("circuitBreakers", body.getOrDefault("circuitBreakers", Map.of()));
                            return entry;
                        })
                        .onErrorResume(e -> Mono.empty()))
                .collectList();
    }

    private List<ServiceInstance> allServiceInstances() {
        return discoveryClient.getServices().stream()
                .filter(s -> !s.equalsIgnoreCase("api-gateway"))
                .flatMap(s -> discoveryClient.getInstances(s).stream())
                .toList();
    }
}
