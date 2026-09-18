package com.todo.session;

import com.todo.config.Auths;
import com.todo.session.dto.AdoptTimeRequest;
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
        Todo todo = owned(uid, todoId);
        // 合集的时间来自各子任务，本身不单独计时
        if (todo.getParentId() == null && todoRepository.existsByUserIdAndParentId(uid, todoId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "合集请分别给子任务计时");
        }
        // 子任务：快照合集名，统计页合并视图据此归并
        String rootSubject = null;
        if (todo.getParentId() != null) {
            rootSubject = todoRepository.findById(todo.getParentId())
                    .filter(p -> p.getUserId().equals(uid))
                    .map(Todo::getText)
                    .orElse(null);
        }
        long start = req.start();
        // 关闭其它仍在进行的会话（同一时刻只允许一个计时器运行）
        for (TimeSession s : sessionRepository.findByUserIdAndEndIsNull(uid)) {
            s.setEnd(start);
            sessionRepository.save(s);
        }
        TimeSession ns = new TimeSession(
                UUID.randomUUID().toString(), uid, todoId, todo.getText(), rootSubject, start, null);
        return toDto(sessionRepository.save(ns));
    }

    /** 把合集已有的计时记录整体迁移到它的某个子任务下（迁移后按该子任务统计）。 */
    @Transactional
    public void adoptTime(String containerId, AdoptTimeRequest req) {
        Long uid = Auths.userId();
        Todo container = owned(uid, containerId);
        Todo target = owned(uid, req.targetId());
        if (!containerId.equals(target.getParentId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "目标事项不是该合集的子任务");
        }
        for (TimeSession s : sessionRepository.findByUserIdAndTodoId(uid, containerId)) {
            s.setTodoId(target.getId());
            s.setSubject(target.getText());
            s.setRootSubject(container.getText());
            sessionRepository.save(s);
        }
    }

    @Transactional
    public void pause(String todoId, PauseRequest req) {
        Long uid = Auths.userId();
        sessionRepository.findFirstByUserIdAndTodoIdAndEndIsNull(uid, todoId).ifPresent(s -> {
            s.setEnd(req.end());
            sessionRepository.save(s);
        });
    }

    private Todo owned(Long uid, String id) {
        return todoRepository.findById(id)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
    }

    private SessionDto toDto(TimeSession s) {
        return new SessionDto(
                s.getId(), s.getTodoId(), s.getSubject(), s.getRootSubject(), s.getStart(), s.getEnd());
    }
}
