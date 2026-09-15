package com.todo.todo;

import com.todo.config.Auths;
import com.todo.session.TimeSessionRepository;
import com.todo.todo.dto.TodoCreateRequest;
import com.todo.todo.dto.TodoDto;
import com.todo.todo.dto.TodoUpdateRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TodoService {

    private final TodoRepository todoRepository;
    private final TimeSessionRepository sessionRepository;

    public TodoService(TodoRepository todoRepository, TimeSessionRepository sessionRepository) {
        this.todoRepository = todoRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<TodoDto> list() {
        Long uid = Auths.userId();
        return todoRepository.findByUserIdOrderByCreatedAtAsc(uid).stream().map(this::toDto).toList();
    }

    @Transactional
    public TodoDto create(TodoCreateRequest req) {
        String text = req.text() == null ? "" : req.text().trim();
        if (text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "内容不能为空");
        }
        Long uid = Auths.userId();
        long now = System.currentTimeMillis();
        Todo todo = new Todo(UUID.randomUUID().toString(), uid, text, false, now, now);
        return toDto(todoRepository.save(todo));
    }

    @Transactional
    public TodoDto update(String id, TodoUpdateRequest req) {
        Todo todo = owned(id);
        if (req.text() != null) {
            String text = req.text().trim();
            if (text.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "内容不能为空");
            }
            todo.setText(text);
        }
        if (req.completed() != null) {
            todo.setCompleted(req.completed());
        }
        todo.setUpdatedAt(System.currentTimeMillis());
        return toDto(todoRepository.save(todo));
    }

    @Transactional
    public void delete(String id) {
        Long uid = Auths.userId();
        Todo todo = todoRepository.findById(id)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
        // 结束该事项仍在进行的计时会话（保留历史记录，用于统计）
        sessionRepository.findFirstByUserIdAndTodoIdAndEndIsNull(uid, id).ifPresent(s -> {
            s.setEnd(System.currentTimeMillis());
            sessionRepository.save(s);
        });
        todoRepository.delete(todo);
    }

    @Transactional
    public void clearCompleted() {
        Long uid = Auths.userId();
        for (Todo t : todoRepository.findByUserIdOrderByCreatedAtAsc(uid)) {
            if (t.isCompleted()) {
                delete(t.getId());
            }
        }
    }

    private Todo owned(String id) {
        Long uid = Auths.userId();
        return todoRepository.findById(id)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
    }

    private TodoDto toDto(Todo t) {
        return new TodoDto(t.getId(), t.getText(), t.isCompleted());
    }
}
