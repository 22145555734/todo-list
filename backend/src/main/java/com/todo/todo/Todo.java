package com.todo.todo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "todos")
public class Todo {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 500)
    private String text;

    /** 所属合集 id；null 表示顶层事项。只允许一层嵌套，故有 parentId 的事项本身不能再当合集。 */
    @Column(length = 36)
    private String parentId;

    /**
     * 手动排序用的位次，**在同一 (userId, parentId) 分组内**从 0 起连续编号，越小越靠前。
     *
     * <p>刻意可空：加列时 ddl-auto 只会 ADD COLUMN 而不会回填，已有行先是 null，
     * 由启动时的 {@link TodoOrderBackfill} 补上；补完之后新建的事项一律在 create() 里带上值，
     * 不会再出现 null。之所以没有写成 not null，就是为了让这次加列能平滑落在既有数据上。
     */
    @Column
    private Integer sortOrder;

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false, updatable = false)
    private Long createdAt;

    @Column(nullable = false)
    private Long updatedAt;

    public Todo() {}

    public Todo(
            String id, Long userId, String text, String parentId, Integer sortOrder,
            boolean completed, Long createdAt, Long updatedAt) {
        this.id = id;
        this.userId = userId;
        this.text = text;
        this.parentId = parentId;
        this.sortOrder = sortOrder;
        this.completed = completed;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
    public Long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Long updatedAt) { this.updatedAt = updatedAt; }
}
