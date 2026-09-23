package com.academiax.course.repository;

import com.academiax.course.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {
    Optional<Course> findByCode(String code);

    @Query("SELECT c FROM Course c WHERE (:keyword IS NULL OR LOWER(c.title) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(c.code) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
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
