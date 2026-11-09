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

    /**
     * 所属父事项 id；null 表示顶层。
     *
     * <p>允许任意深度嵌套（如 408 → 数据结构 → W01 → 任务）。**只有没有子事项的叶子可以计时**，
     * 这一点由 {@link com.todo.session.TimeSessionService} 把关。
     */
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

    /**
     * 计划时长（毫秒）；null 表示没有预算，计时走正计时。
     *
     * <p>有值时前端按倒计时显示，到 0 停表等用户确认。开始计时那一刻会把它快照进
     * time_sessions，之后改这里不会污染历史统计。
     */
    @Column
    private Long plannedMs;

    /** 这条任务属于哪一天（yyyy-MM-dd）；null 表示不带日期的老数据。 */
    @Column(length = 10)
    private String planDate;

    @Column(nullable = false, updatable = false)
    private Long createdAt;

    @Column(nullable = false)
    private Long updatedAt;

    public Todo() {}

    public Todo(
            String id, Long userId, String text, String parentId, Integer sortOrder,
            boolean completed, Long plannedMs, String planDate, Long createdAt, Long updatedAt) {
        this.id = id;
        this.userId = userId;
        this.text = text;
        this.parentId = parentId;
        this.sortOrder = sortOrder;
        this.completed = completed;
        this.plannedMs = plannedMs;
        this.planDate = planDate;
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
    public Long getPlannedMs() { return plannedMs; }
    public void setPlannedMs(Long plannedMs) { this.plannedMs = plannedMs; }
    public String getPlanDate() { return planDate; }
    public void setPlanDate(String planDate) { this.planDate = planDate; }
    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
    public Long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Long updatedAt) { this.updatedAt = updatedAt; }
}
