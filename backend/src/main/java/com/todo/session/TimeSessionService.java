package com.todo.session;

import com.todo.config.Auths;
import com.todo.session.dto.AdoptTimeRequest;
import com.todo.session.dto.PauseRequest;
import com.todo.session.dto.SessionDto;
import com.todo.session.dto.StartRequest;
import com.todo.todo.Todo;
import com.todo.todo.TodoRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TimeSessionService {

    /** 祖先链分隔符：全角竖线，避开事项名里本来就有的斜杠。 */
    private static final String PATH_SEPARATOR = "｜";

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
        // 有子事项的节点由子事项分别计时，自己不单独计时（任意层级，不只是顶层）
        if (todoRepository.existsByUserIdAndParentId(uid, todoId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "有子任务的事项不能直接计时");
        }
        // 快照祖先链：统计页按 path 逐层归并，rootSubject 保留给旧的合并视图
        List<String> ancestors = ancestorNames(uid, todo);
        String rootSubject = ancestors.isEmpty() ? null : ancestors.get(0);
        String path = ancestors.isEmpty() ? null : String.join(PATH_SEPARATOR, ancestors);
        long start = req.start();
        // 关闭其它仍在进行的会话（同一时刻只允许一个计时器运行）
        for (TimeSession s : sessionRepository.findByUserIdAndEndIsNull(uid)) {
            s.setEnd(start);
            sessionRepository.save(s);
        }
        TimeSession ns = new TimeSession(
                UUID.randomUUID().toString(), uid, todoId, todo.getText(), rootSubject,
                path, todo.getPlannedMs(), todo.getPlanDate(), start, null);
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
        // 迁移后这些记录就属于 target 了，祖先链和预算快照跟着一起换
        List<String> chain = ancestorNames(uid, container);
        chain.add(container.getText());
        for (TimeSession s : sessionRepository.findByUserIdAndTodoId(uid, containerId)) {
            s.setTodoId(target.getId());
            s.setSubject(target.getText());
            s.setRootSubject(chain.get(0));
            s.setPath(String.join(PATH_SEPARATOR, chain));
            s.setPlannedMs(target.getPlannedMs());
            s.setPlanDate(target.getPlanDate());
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

    /** 从该事项向上收集祖先名称，根在前、不含自身。seen 兼作防环。 */
    private List<String> ancestorNames(Long uid, Todo todo) {
        List<String> names = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String cur = todo.getParentId();
        while (cur != null && seen.add(cur)) {
            Todo parent = todoRepository.findById(cur)
                    .filter(t -> t.getUserId().equals(uid))
                    .orElse(null);
            if (parent == null) break;
            names.add(0, parent.getText());
            cur = parent.getParentId();
        }
        return names;
    }

    private SessionDto toDto(TimeSession s) {
        return new SessionDto(
                s.getId(), s.getTodoId(), s.getSubject(), s.getRootSubject(),
                s.getPath(), s.getPlannedMs(), s.getPlanDate(), s.getStart(), s.getEnd());
    }
}
