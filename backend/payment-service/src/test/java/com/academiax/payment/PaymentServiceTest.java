package com.academiax.payment;

import com.academiax.payment.client.EnrollmentClient;
import com.academiax.payment.dto.PaymentRequest;
import com.academiax.payment.dto.PaymentResponse;
import com.academiax.payment.entity.IdempotencyRecord;
import com.academiax.payment.entity.Payment;
import com.academiax.payment.entity.PaymentStatus;
import com.academiax.payment.exception.ConflictException;
import com.academiax.payment.exception.ForbiddenException;
import com.academiax.payment.repository.IdempotencyRecordRepository;
import com.academiax.payment.repository.PaymentRepository;
import com.academiax.payment.service.PaymentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @Mock
    private EnrollmentClient enrollmentClient;

    // Real ObjectMapper: Mockito cannot spy Jackson classes on newer JDKs, and nothing here needs stubbing.
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(paymentRepository, idempotencyRecordRepository, enrollmentClient, objectMapper);
    }

    private static final Long STUDENT_ID = 42L;
    private static final Long ENROLLMENT_ID = 10L;

    // ─── Helpers ────────────────────────────────────────────────────────

    private PaymentRequest buildRequest(String cardNumber) {
        PaymentRequest req = new PaymentRequest();
        req.setEnrollmentId(ENROLLMENT_ID);
        req.setStudentId(STUDENT_ID);
        req.setAmount(new BigDecimal("2500.00"));
        req.setCardNumber(cardNumber);
        req.setCardHolder("Test Student");
        req.setExpiry("12/2028");
        req.setCvv("123");
        return req;
    }

    private Map<String, Object> heldEnrollment() {
        return Map.of("id", ENROLLMENT_ID, "studentId", STUDENT_ID, "status", "SEAT_HELD", "tuitionFee", 2500.00);
    }

    private Payment savedPayment(PaymentStatus status, String cardLast4) {
        return Payment.builder()
                .id(1L)
                .enrollmentId(ENROLLMENT_ID)
                .studentId(STUDENT_ID)
                .amount(new BigDecimal("2500.00"))
                .status(status)
                .transactionRef("TXN-ABC12345")
                .cardLast4(cardLast4)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ─── Card simulation ────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("processPayment: good card (4111...1111) succeeds with SUCCESS status")
    void processPayment_GoodCardSucceeds() {
        when(idempotencyRecordRepository.findByIdempotencyKey(anyString()))
                .thenReturn(Optional.empty());

        Payment successPayment = savedPayment(PaymentStatus.SUCCESS, "1111");
        successPayment.setPaidAt(LocalDateTime.now());
        when(paymentRepository.save(any(Payment.class))).thenReturn(successPayment);
        when(idempotencyRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, STUDENT_ID, "STUDENT")).thenReturn(heldEnrollment());
        // confirmEnrollment returns Map, not void
        when(enrollmentClient.confirmEnrollment(eq(ENROLLMENT_ID), anyLong()))
                .thenReturn(Map.of("status", "CONFIRMED"));

        PaymentResponse response = paymentService.processPayment(
                buildRequest("4111111111111111"), UUID.randomUUID().toString(), STUDENT_ID, "STUDENT");

        assertNotNull(response);
        assertEquals(PaymentStatus.SUCCESS, response.getStatus());
        verify(enrollmentClient).confirmEnrollment(eq(ENROLLMENT_ID), anyLong());
    }

    @Test
    @Order(2)
    @DisplayName("processPayment: failure card (4000...0002) results in FAILED status")
    void processPayment_FailureCardFails() {
        when(idempotencyRecordRepository.findByIdempotencyKey(anyString()))
                .thenReturn(Optional.empty());

        Payment failedPayment = savedPayment(PaymentStatus.FAILED, "0002");
        failedPayment.setFailureReason("Transaction declined: Simulated test failure card");
        when(paymentRepository.save(any(Payment.class))).thenReturn(failedPayment);
        when(idempotencyRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, STUDENT_ID, "STUDENT")).thenReturn(heldEnrollment());
        // failEnrollment returns Map, not void
        when(enrollmentClient.failEnrollment(eq(ENROLLMENT_ID), anyString()))
                .thenReturn(Map.of("status", "PAYMENT_FAILED"));

        PaymentResponse response = paymentService.processPayment(
                buildRequest("4000000000000002"), UUID.randomUUID().toString(), STUDENT_ID, "STUDENT");

        assertNotNull(response);
        assertEquals(PaymentStatus.FAILED, response.getStatus());
        assertNotNull(response.getFailureReason());
        verify(enrollmentClient).failEnrollment(eq(ENROLLMENT_ID), anyString());
        verify(enrollmentClient, never()).confirmEnrollment(any(), any());
    }

    // ─── Idempotency ────────────────────────────────────────────────────

    @Test
    @Order(3)
    @DisplayName("processPayment: same idempotency key returns cached response without re-charging")
    void processPayment_IdempotencyKeyReturnsCached() throws Exception {
        PaymentResponse cached = PaymentResponse.builder()
                .id(1L)
                .enrollmentId(ENROLLMENT_ID)
                .studentId(STUDENT_ID)
                .amount(new BigDecimal("2500.00"))
                .status(PaymentStatus.SUCCESS)
                .transactionRef("TXN-CACHED")
                .cardLast4("1111")
                .createdAt(LocalDateTime.now())
                .build();

        String responseJson = objectMapper.writeValueAsString(cached);
        IdempotencyRecord record = IdempotencyRecord.builder()
                .idempotencyKey("idem-key-123")
                .responseJson(responseJson)
                .createdAt(LocalDateTime.now())
                .build();

        when(idempotencyRecordRepository.findByIdempotencyKey("idem-key-123"))
                .thenReturn(Optional.of(record));

        PaymentResponse response = paymentService.processPayment(
                buildRequest("4111111111111111"), "idem-key-123", STUDENT_ID, "STUDENT");

        assertNotNull(response);
        assertEquals("TXN-CACHED", response.getTransactionRef());
        verify(paymentRepository, never()).save(any());
        verify(enrollmentClient, never()).confirmEnrollment(any(), any());
    }

    // ─── Refund ──────────────────────────────────────────────────────────

    @Test
    @Order(4)
    @DisplayName("refundPayment: successful payment can be refunded")
    void refundPayment_SuccessfulPaymentRefunded() {
        Payment successPayment = savedPayment(PaymentStatus.SUCCESS, "1111");
        successPayment.setPaidAt(LocalDateTime.now());
        successPayment.setEnrollmentId(ENROLLMENT_ID);

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(successPayment));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // refundEnrollment returns Map, not void
        when(enrollmentClient.refundEnrollment(eq(ENROLLMENT_ID)))
                .thenReturn(Map.of("status", "REFUNDED"));

        PaymentResponse response = paymentService.refundPayment(1L, STUDENT_ID, "STUDENT");

        assertEquals(PaymentStatus.REFUNDED, response.getStatus());
        verify(enrollmentClient).refundEnrollment(ENROLLMENT_ID);
    }

    @Test
    @Order(5)
    @DisplayName("refundPayment: already-failed payment throws ConflictException")
    void refundPayment_FailedPaymentThrowsConflict() {
        Payment failedPayment = savedPayment(PaymentStatus.FAILED, "0002");
        failedPayment.setFailureReason("Card declined");

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(failedPayment));

        assertThrows(ConflictException.class,
                () -> paymentService.refundPayment(1L, STUDENT_ID, "STUDENT"));
    }

    @Test
    @Order(6)
    @DisplayName("refundPayment: student B cannot refund student A's payment (IDOR)")
    void refundPayment_IDORPrevented() {
        Payment payment = savedPayment(PaymentStatus.SUCCESS, "1111");
        payment.setPaidAt(LocalDateTime.now());
        payment.setStudentId(STUDENT_ID); // belongs to student 42

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        Long otherStudent = 999L;
        assertThrows(ForbiddenException.class,
                () -> paymentService.refundPayment(1L, otherStudent, "STUDENT"));
    }

    // ─── Server-side trust (defects 4 and 6) ────────────────────────────

    @Test
    @Order(7)
    @DisplayName("processPayment: amount comes from the enrollment's tuition, not the client body")
    void processPayment_UsesEnrollmentTuitionNotClientAmount() {
        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, STUDENT_ID, "STUDENT")).thenReturn(heldEnrollment());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentRequest tampered = buildRequest("4111111111111111");
        tampered.setAmount(new BigDecimal("1.00"));

        PaymentResponse response = paymentService.processPayment(tampered, null, STUDENT_ID, "STUDENT");

        assertEquals(0, new BigDecimal("2500.00").compareTo(response.getAmount()));
    }

    @Test
    @Order(8)
    @DisplayName("processPayment: paying for another student's enrollment returns 403")
    void processPayment_OtherStudentsEnrollmentForbidden() {
        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, 999L, "STUDENT"))
                .thenThrow(new feign.FeignException.Forbidden("forbidden",
                        feign.Request.create(feign.Request.HttpMethod.GET, "/enrollments/10", Map.of(), null, null, null),
                        null, Map.of()));

        assertThrows(ForbiddenException.class,
                () -> paymentService.processPayment(buildRequest("4111111111111111"), null, 999L, "STUDENT"));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    @Order(9)
    @DisplayName("processPayment: enrollment not in SEAT_HELD (e.g. expired) returns 409")
    void processPayment_NotHeldConflict() {
        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, STUDENT_ID, "STUDENT"))
                .thenReturn(Map.of("id", ENROLLMENT_ID, "studentId", STUDENT_ID, "status", "EXPIRED", "tuitionFee", 2500.00));

        assertThrows(ConflictException.class,
                () -> paymentService.processPayment(buildRequest("4111111111111111"), null, STUDENT_ID, "STUDENT"));
        verify(paymentRepository, never()).save(any());
    }

    @Test
    @Order(10)
    @DisplayName("processPayment: if confirmation fails after charging, the payment is auto-refunded")
    void processPayment_ConfirmFailureAutoRefunds() {
        when(enrollmentClient.getEnrollment(ENROLLMENT_ID, STUDENT_ID, "STUDENT")).thenReturn(heldEnrollment());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(enrollmentClient.confirmEnrollment(eq(ENROLLMENT_ID), any())).thenThrow(new RuntimeException("409 hold expired"));

        PaymentResponse response = paymentService.processPayment(buildRequest("4111111111111111"), null, STUDENT_ID, "STUDENT");

        assertEquals(PaymentStatus.REFUNDED, response.getStatus());
    }
}
