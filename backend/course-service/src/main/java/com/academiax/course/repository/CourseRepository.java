package com.academiax.course.repository;

import com.academiax.course.entity.Course;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {

    Optional<Course> findByCodeAndDeletedFalse(String code);

    Optional<Course> findByIdAndDeletedFalse(Long id);

    List<Course> findByInstructorIdAndDeletedFalse(Long instructorId);

    @Modifying
    @Query("UPDATE Course c SET c.availableSeats = c.availableSeats - 1, c.updatedAt = :now, c.version = c.version + 1 " +
           "WHERE c.id = :id AND c.availableSeats > 0 AND (c.enrollmentDeadline IS NULL OR c.enrollmentDeadline > :now) AND c.deleted = false")
    int decrementAvailableSeat(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE Course c SET c.availableSeats = c.availableSeats + 1, c.updatedAt = :now, c.version = c.version + 1 " +
           "WHERE c.id = :id AND c.availableSeats < c.totalSeats AND c.deleted = false")
    int incrementAvailableSeat(@Param("id") Long id, @Param("now") LocalDateTime now);

    @Query("SELECT c FROM Course c WHERE c.deleted = false " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(c.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(c.code) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(c.description) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:department IS NULL OR :department = '' OR LOWER(c.department) = LOWER(:department)) " +
           "AND (:level IS NULL OR :level = '' OR LOWER(c.level) = LOWER(:level)) " +
           "AND (:academicYear IS NULL OR :academicYear = '' OR c.academicYear = :academicYear) " +
           "AND (:semester IS NULL OR :semester = '' OR c.semester = :semester) " +
           "AND (:codeFilter IS NULL OR :codeFilter = '' OR c.code = :codeFilter) " +
           "AND (:availableOnly = false OR c.availableSeats > 0)")
    Page<Course> searchCoursesPaged(@Param("keyword") String keyword,
                                   @Param("department") String department,
                                   @Param("level") String level,
                                   @Param("academicYear") String academicYear,
                                   @Param("semester") String semester,
                                   @Param("codeFilter") String codeFilter,
                                   @Param("availableOnly") boolean availableOnly,
                                   Pageable pageable);

    @Query("SELECT c FROM Course c WHERE c.deleted = false " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(c.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(c.code) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:academicYear IS NULL OR c.academicYear = :academicYear) " +
           "AND (:semester IS NULL OR c.semester = :semester) " +
           "AND (:codeFilter IS NULL OR c.code = :codeFilter) " +
           "AND (:availableOnly = false OR c.availableSeats > 0)")
    List<Course> searchCourses(@Param("keyword") String keyword,
                               @Param("academicYear") String academicYear,
                               @Param("semester") String semester,
                               @Param("codeFilter") String codeFilter,
                               @Param("availableOnly") boolean availableOnly);
}
