package com.academiax.gateway;

import org.springframework.stereotype.Component;

import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Keeps the gateway's own hops for recent correlation IDs so the System Console can draw a request trace. */
@Component
public class TraceStore {

    private static final int MAX_HOPS = 2000;
    private final Deque<Map<String, Object>> hops = new ConcurrentLinkedDeque<>();

    public void record(String correlationId, String method, String path, int status, long startedAt, long durationMs, String target) {
        Map<String, Object> hop = new LinkedHashMap<>();
        hop.put("correlationId", correlationId);
        hop.put("service", "api-gateway");
        hop.put("instanceId", "api-gateway");
        hop.put("method", method);
        hop.put("path", path);
        hop.put("status", status);
        hop.put("startedAt", startedAt);
        hop.put("durationMs", durationMs);
        hop.put("target", target);
        hops.addLast(hop);
        while (hops.size() > MAX_HOPS) {
            hops.pollFirst();
        }
    }

    public List<Map<String, Object>> find(String correlationId) {
        return hops.stream().filter(h -> correlationId.equals(h.get("correlationId"))).toList();
    }
}
