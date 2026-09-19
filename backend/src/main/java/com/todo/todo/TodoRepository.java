package com.todo.todo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, String> {
    /**
     * 列表展示顺序的**唯一**来源：先按手动排的 sortOrder，再按创建时间兜底。
     *
     * <p>createdAt 这个次级排序不是装饰：回填之前所有行的 sortOrder 都是 null，
     * 撞号时也要有个确定的次序，否则列表会随机跳动。
     */
    List<Todo> findByUserIdOrderBySortOrderAscCreatedAtAsc(Long userId);

    List<Todo> findByUserIdAndParentId(Long userId, String parentId);

    /** 尚未回填 sortOrder 的行（只可能是加列前就存在的老数据） */
    List<Todo> findBySortOrderIsNull();

    boolean existsByUserIdAndParentId(Long userId, String parentId);
}
