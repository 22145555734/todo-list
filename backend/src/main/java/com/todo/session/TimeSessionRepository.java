package com.todo.session;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TimeSessionRepository extends JpaRepository<TimeSession, String> {
    List<TimeSession> findByUserIdOrderByStartAsc(Long userId);
    List<TimeSession> findByUserIdAndEndIsNull(Long userId);
    /** 全站仍在计时的会话（预算到点扫描用，不受单个用户约束） */
    List<TimeSession> findByEndIsNull();
    Optional<TimeSession> findFirstByUserIdAndTodoIdAndEndIsNull(Long userId, String todoId);
    List<TimeSession> findByUserIdAndTodoId(Long userId, String todoId);
}
