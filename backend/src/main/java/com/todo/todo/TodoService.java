package com.todo.todo;

import com.todo.config.Auths;
import com.todo.session.TimeSessionRepository;
import com.todo.todo.dto.TodoCreateRequest;
import com.todo.todo.dto.TodoDto;
import com.todo.todo.dto.TodoUpdateRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
        String parentId = req.parentId();
        if (parentId != null) {
            Todo parent = owned(parentId);
            if (parent.getParentId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "子集下不能再加子集");
            }
            // 合集由子集分别计时，本身不再计时：结束它仍在进行的会话（保留历史）
            endRunning(uid, parentId);
        }
        long now = System.currentTimeMillis();
        Todo todo = new Todo(UUID.randomUUID().toString(), uid, text, parentId, false, now, now);
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
        // 合集连同子集一起删除；计时记录照旧保留，用于统计
        for (Todo child : todoRepository.findByUserIdAndParentId(uid, id)) {
            endRunning(uid, child.getId());
            todoRepository.delete(child);
        }
        endRunning(uid, id);
        todoRepository.delete(todo);
    }

    @Transactional
    public void clearCompleted() {
        Long uid = Auths.userId();
        List<Todo> all = todoRepository.findByUserIdOrderByCreatedAtAsc(uid);
        Set<String> completedIds =
                all.stream().filter(Todo::isCompleted).map(Todo::getId).collect(Collectors.toSet());
        for (Todo t : all) {
            if (!t.isCompleted()) continue;
            // 合集已完成时其子集会被一并删除，跳过以免重复删除
            if (t.getParentId() != null && completedIds.contains(t.getParentId())) continue;
            delete(t.getId());
        }
    }

    /** 结束某事项仍在进行的计时会话（保留历史记录，用于统计） */
    private void endRunning(Long uid, String todoId) {
        sessionRepository.findFirstByUserIdAndTodoIdAndEndIsNull(uid, todoId).ifPresent(s -> {
            s.setEnd(System.currentTimeMillis());
            sessionRepository.save(s);
        });
    }

    private Todo owned(String id) {
        Long uid = Auths.userId();
        return todoRepository.findById(id)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
    }

    private TodoDto toDto(Todo t) {
        return new TodoDto(t.getId(), t.getText(), t.isCompleted(), t.getParentId());
    }
}
