package com.academiax.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRequest {
    @NotNull(message = "Enrollment ID is required")
    private Long enrollmentId;

    private Long studentId;

    // Ignored by the server: tuition is taken from the enrollment. Kept so older clients still deserialize.
    private BigDecimal amount;

    // Simulated card fields
    @NotBlank(message = "Card number is required")
    @Pattern(regexp = "^[0-9 ]{12,23}$", message = "Card number must be 12-19 digits")
    private String cardNumber;
    @NotBlank(message = "Cardholder name is required")
    private String cardHolder;
    @Pattern(regexp = "^(0[1-9]|1[0-2])/([0-9]{2}|[0-9]{4})$", message = "Expiry must be MM/YY")
    private String expiry;
    @Pattern(regexp = "^[0-9]{3,4}$", message = "CVV must be 3 or 4 digits")
    private String cvv;
}
