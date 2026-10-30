package com.academiax.payment.repository;

import com.academiax.payment.entity.Payment;
import com.academiax.payment.entity.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByStudentId(Long studentId);
    Page<Payment> findByStudentId(Long studentId, Pageable pageable);
    List<Payment> findByEnrollmentId(Long enrollmentId);
    Optional<Payment> findTopByEnrollmentIdOrderByIdDesc(Long enrollmentId);

    @Query("SELECT p FROM Payment p WHERE (:status IS NULL OR p.status = :status) AND (:studentId IS NULL OR p.studentId = :studentId)")
    Page<Payment> searchPayments(@Param("status") PaymentStatus status, @Param("studentId") Long studentId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'SUCCESS'")
    BigDecimal calculateTotalRevenue();

    long countByStatus(PaymentStatus status);
}
