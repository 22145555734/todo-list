package com.todo.session;

import com.todo.config.Auths;
import com.todo.session.dto.PauseRequest;
import com.todo.session.dto.SessionDto;
import com.todo.session.dto.StartRequest;
import com.todo.todo.Todo;
import com.todo.todo.TodoRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TimeSessionService {

    private final TimeSessionRepository sessionRepository;
    private final TodoRepository todoRepository;

    public TimeSessionService(TimeSessionRepository sessionRepository, TodoRepository todoRepository) {
        this.sessionRepository = sessionRepository;
        this.todoRepository = todoRepository;
    }

    public List<SessionDto> list() {
        Long uid = Auths.userId();
        return sessionRepository.findByUserIdOrderByStartAsc(uid).stream().map(this::toDto).toList();
    }

    @Transactional
    public SessionDto start(String todoId, StartRequest req) {
        Long uid = Auths.userId();
        Todo todo = todoRepository.findById(todoId)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
        long start = req.start();
        // 关闭其它仍在进行的会话（同一时刻只允许一个计时器运行）
        for (TimeSession s : sessionRepository.findByUserIdAndEndIsNull(uid)) {
            s.setEnd(start);
            sessionRepository.save(s);
        }
        TimeSession ns = new TimeSession(UUID.randomUUID().toString(), uid, todoId, todo.getText(), start, null);
        return toDto(sessionRepository.save(ns));
    }

    @Transactional
    public void pause(String todoId, PauseRequest req) {
        Long uid = Auths.userId();
        sessionRepository.findFirstByUserIdAndTodoIdAndEndIsNull(uid, todoId).ifPresent(s -> {
            s.setEnd(req.end());
            sessionRepository.save(s);
        });
    }

    @Transactional
    public void reset(String todoId) {
        Long uid = Auths.userId();
        sessionRepository.deleteByUserIdAndTodoId(uid, todoId);
    }

    private SessionDto toDto(TimeSession s) {
        return new SessionDto(s.getId(), s.getTodoId(), s.getSubject(), s.getStart(), s.getEnd());
    }
}
