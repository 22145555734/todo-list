package com.todo.session.dto;

/**
 * 一条计时记录。
 *
 * <p>subject / rootSubject / path / plannedMs / planDate 都是开始计时时的快照，
 * 事项后来改名或搬家不影响历史统计。
 *
 * @param path 完整祖先链，从根到叶子，全角 {@code ｜} 分隔；顶层事项计时时为 null
 */
public record SessionDto(
        String id,
        String todoId,
        String subject,
        String rootSubject,
        String path,
        Long plannedMs,
        String planDate,
        long start,
        Long end) {}
