package com.todo.todo;

import com.todo.config.Auths;
import com.todo.session.TimeSessionRepository;
import com.todo.todo.dto.TodoCreateRequest;
import com.todo.todo.dto.TodoDto;
import com.todo.todo.dto.TodoOrderRequest;
import com.todo.todo.dto.TodoUpdateRequest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
        return todoRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).stream()
                .map(this::toDto)
                .toList();
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
            // 任意深度都允许；只校验父事项存在且属于当前用户
            owned(parentId);
            // 有了子事项就不再自己计时：结束它仍在进行的会话（保留历史）
            endRunning(uid, parentId);
        }
        long now = System.currentTimeMillis();
        Todo todo = new Todo(
                UUID.randomUUID().toString(), uid, text, parentId, nextSortOrder(uid, parentId),
                false, req.plannedMs(), req.planDate(), now, now);
        return toDto(todoRepository.save(todo));
    }

    /**
     * 按给定顺序重排一个分组。分组由 (userId, parentId) 界定，parentId 两边同为 null 时算同一组。
     *
     * <p>只接受属于当前用户、且 parentId 与请求一致的事项 —— 防越权，也顺带挡住跨层拖动
     * （前端本来就禁止跨层，这里是后端兜底）。
     *
     * <p>不要求 orderedIds 覆盖整个分组：多设备并发时（另一台正在加事项）严格校验会误报失败，
     * 得不偿失。漏掉的行保留原位次，撞号由 createdAt 兜底。
     */
    @Transactional
    public void reorder(TodoOrderRequest req) {
        Long uid = Auths.userId();
        String parentId = req.parentId();
        List<String> ids = req.orderedIds() == null ? List.of() : req.orderedIds();
        long now = System.currentTimeMillis();
        List<Todo> updated = new ArrayList<>(ids.size());
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < ids.size(); i++) {
            // 重复 id 会让同一个事项先拿 i 再拿 j，跟别人的位次撞号，静默打乱顺序 —— 直接拒掉
            if (!seen.add(ids.get(i))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "排序请求里有重复的事项");
            }
            Todo todo = todoRepository.findById(ids.get(i))
                    .filter(t -> t.getUserId().equals(uid))
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "排序请求里有不属于你的事项"));
            if (!Objects.equals(todo.getParentId(), parentId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "只能在同一层级内排序");
            }
            todo.setSortOrder(i);
            todo.setUpdatedAt(now);
            updated.add(todo);
        }
        todoRepository.saveAll(updated);
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
        // 预算或归属日变了就是新的一轮，提醒标记要清掉，否则新预算用完了也不会再提醒
        if (req.plannedMs() != null && !req.plannedMs().equals(todo.getPlannedMs())) {
            todo.setPlannedMs(req.plannedMs());
            todo.setBudgetNotifiedAt(null);
        }
        if (req.planDate() != null && !req.planDate().equals(todo.getPlanDate())) {
            todo.setPlanDate(req.planDate());
            todo.setBudgetNotifiedAt(null);
        }
        todo.setUpdatedAt(System.currentTimeMillis());
        return toDto(todoRepository.save(todo));
    }

    @Transactional
    public void delete(String id) {
        Long uid = Auths.userId();
        todoRepository.findById(id)
                .filter(t -> t.getUserId().equals(uid))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "事项不存在"));
        // 连同整棵子树一起删除；计时记录照旧保留，用于统计
        deleteSubtree(uid, id);
    }

    /** 自底向上删除，任意深度。计时记录不删，历史统计照常。 */
    private void deleteSubtree(Long uid, String id) {
        for (Todo child : todoRepository.findByUserIdAndParentId(uid, id)) {
            deleteSubtree(uid, child.getId());
        }
        endRunning(uid, id);
        todoRepository.deleteById(id);
    }

    @Transactional
    public void clearCompleted() {
        Long uid = Auths.userId();
        List<Todo> all = todoRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid);
        Set<String> completedIds =
                all.stream().filter(Todo::isCompleted).map(Todo::getId).collect(Collectors.toSet());
        Map<String, String> parentOf = all.stream()
                .filter(t -> t.getParentId() != null)
                .collect(Collectors.toMap(Todo::getId, Todo::getParentId));
        for (Todo t : all) {
            if (!t.isCompleted()) continue;
            // 祖先里已有完成项的，会随祖先的删除一起被清掉，跳过以免重复删除
            if (hasCompletedAncestor(t.getId(), completedIds, parentOf)) continue;
            delete(t.getId());
        }
    }

    private boolean hasCompletedAncestor(
            String id, Set<String> completedIds, Map<String, String> parentOf) {
        String p = parentOf.get(id);
        while (p != null) {
            if (completedIds.contains(p)) return true;
            p = parentOf.get(p);
        }
        return false;
    }

    /**
     * 新事项的位次：所在分组当前最大值 + 1，即排到末尾 —— 与前端「新建的追加到列表尾部」一致。
     *
     * <p>直接复用列表那个查询再在内存里分组：个人待办的量级下不值得为它单独写一个查询，
     * 而按 parentId 过滤恰恰要处理 parentId 为 null（顶层）的情况，派生查询反而更绕。
     */
    private int nextSortOrder(Long uid, String parentId) {
        return todoRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).stream()
                .filter(t -> Objects.equals(t.getParentId(), parentId))
                .map(Todo::getSortOrder)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(-1) + 1;
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
        return new TodoDto(
                t.getId(), t.getText(), t.isCompleted(), t.getParentId(),
                t.getPlannedMs(), t.getPlanDate());
    }
}
