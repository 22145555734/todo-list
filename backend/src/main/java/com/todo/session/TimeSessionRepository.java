package com.todo.session;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeSessionRepository extends JpaRepository<TimeSession, String> {
    List<TimeSession> findByUserIdOrderByStartAsc(Long userId);
    List<TimeSession> findByUserIdAndEndIsNull(Long userId);
    Optional<TimeSession> findFirstByUserIdAndTodoIdAndEndIsNull(Long userId, String todoId);
    List<TimeSession> findByUserIdAndTodoId(Long userId, String todoId);
}
