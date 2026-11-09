package com.todo.todo.dto;

/**
 * 新建待办。
 *
 * <p>parentId 非空表示挂在某个事项下，层级不限；只有叶子可以计时。
 * plannedMs / planDate 可空，空表示没有预算、不按天归属。
 */
public record TodoCreateRequest(String text, String parentId, Long plannedMs, String planDate) {}
