package com.todo.todo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, String> {
    List<Todo> findByUserIdOrderByCreatedAtAsc(Long userId);
}
