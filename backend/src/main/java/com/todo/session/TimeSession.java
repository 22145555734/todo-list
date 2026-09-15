package com.todo.session;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "time_sessions")
public class TimeSession {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private Long userId;

    /** 归属的待办 id（无外键约束，删除待办后保留历史，用于统计）。 */
    @Column(nullable = false, length = 36)
    private String todoId;

    /** 开始计时时快照的事项名称，用于统计按科目聚合。 */
    @Column(nullable = false, length = 500)
    private String subject;

    /** 开始时间戳（毫秒）。 */
    @Column(nullable = false)
    private long start;

    /** 结束时间戳（毫秒），null 表示仍在计时。 */
    private Long end;

    public TimeSession() {}

    public TimeSession(String id, Long userId, String todoId, String subject, long start, Long end) {
        this.id = id;
        this.userId = userId;
        this.todoId = todoId;
        this.subject = subject;
        this.start = start;
        this.end = end;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getTodoId() { return todoId; }
    public void setTodoId(String todoId) { this.todoId = todoId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public long getStart() { return start; }
    public void setStart(long start) { this.start = start; }
    public Long getEnd() { return end; }
    public void setEnd(Long end) { this.end = end; }
}
