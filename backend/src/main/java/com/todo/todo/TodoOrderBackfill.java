package com.todo.todo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 一次性回填：把 sortOrder 还是 null 的事项，按所在分组内的创建顺序编号。
 *
 * <p>加列时 ddl-auto 只 ADD COLUMN、不会给已有行填值，而 MySQL 的 ORDER BY 把 NULL 排在最前 ——
 * 不回填的话整个列表顺序会乱。回填是幂等的：补完之后新事项一律在 {@code TodoService.create()}
 * 里带上位次，再启动这个方法就是空转（第一行的查询直接返回空）。
 */
@Component
public class TodoOrderBackfill implements ApplicationRunner {

    private final TodoRepository todoRepository;

    public TodoOrderBackfill(TodoRepository todoRepository) {
        this.todoRepository = todoRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Todo> orphans = todoRepository.findBySortOrderIsNull();
        if (orphans.isEmpty()) return;

        // 位次要按 (userId, parentId) 分组连续编号，不能全局编，也不能跨用户编
        Set<Long> userIds = orphans.stream().map(Todo::getUserId).collect(Collectors.toSet());
        List<Todo> touched = new ArrayList<>();
        for (Long uid : userIds) {
            Map<String, List<Todo>> groups =
                    todoRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid).stream()
                            // 顶层事项的 parentId 是 null，也要成一组；归一成一个键才好分组
                            .collect(Collectors.groupingBy(t -> Objects.toString(t.getParentId(), "")));
            for (List<Todo> group : groups.values()) {
                // 从该组已有位次之后接着编：万一有事项在「容器启动」到「回填执行」之间新落了位次，
                // 也不会跟它撞号
                int next = group.stream()
                        .map(Todo::getSortOrder)
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .max()
                        .orElse(-1) + 1;
                List<Todo> pending = group.stream()
                        .filter(t -> t.getSortOrder() == null)
                        .sorted(Comparator.comparing(Todo::getCreatedAt))
                        .toList();
                for (Todo t : pending) {
                    t.setSortOrder(next++);
                    touched.add(t);
                }
            }
        }
        todoRepository.saveAll(touched);
    }
}
