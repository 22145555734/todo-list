package com.todo.todo.dto;

/**
 * 部分更新：为 null 的字段保持不变。
 *
 * <p>plannedMs / planDate 用包装类型，才能区分「没传」和「显式清空」——
 * 不过当前实现里显式清空不常用，两者行为一致（null 视为不改）。
 */
public record TodoUpdateRequest(
        String text, Boolean completed, Long plannedMs, String planDate) {}
