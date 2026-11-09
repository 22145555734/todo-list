package com.todo.todo.dto;

/**
 * 待办事项。
 *
 * @param plannedMs 计划时长（毫秒），null 表示没有预算、走正计时
 * @param planDate  归属日期（yyyy-MM-dd），null 表示不按天归属
 * @param completedAt 勾上完成的时间戳（毫秒），取消勾选或从没完成过则为 null
 */
public record TodoDto(
        String id, String text, boolean completed, String parentId,
        Long plannedMs, String planDate, Long completedAt) {}
