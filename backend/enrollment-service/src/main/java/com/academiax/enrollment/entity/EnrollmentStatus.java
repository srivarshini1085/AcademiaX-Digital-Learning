package com.academiax.enrollment.entity;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum EnrollmentStatus {
    SEAT_HELD,
    CONFIRMED,
    CANCELLED,
    EXPIRED,
    PAYMENT_FAILED,
    WAITLISTED,
    REFUNDED;

    private static final Map<EnrollmentStatus, Set<EnrollmentStatus>> ALLOWED_TRANSITIONS = Map.of(
            SEAT_HELD, EnumSet.of(CONFIRMED, PAYMENT_FAILED, EXPIRED, CANCELLED),
            WAITLISTED, EnumSet.of(SEAT_HELD, CANCELLED),
            CONFIRMED, EnumSet.of(CANCELLED, REFUNDED),
            PAYMENT_FAILED, EnumSet.of(SEAT_HELD, CANCELLED),
            EXPIRED, EnumSet.of(SEAT_HELD, CANCELLED),
            CANCELLED, EnumSet.noneOf(EnrollmentStatus.class),
            REFUNDED, EnumSet.noneOf(EnrollmentStatus.class)
    );

    public boolean canTransitionTo(EnrollmentStatus target) {
        if (this == target) return true;
        Set<EnrollmentStatus> validNext = ALLOWED_TRANSITIONS.get(this);
        return validNext != null && validNext.contains(target);
    }
}
