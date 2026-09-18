package com.todo.todo.dto;

/** parentId 非空表示创建的是某个合集的子任务。 */
public record TodoCreateRequest(String text, String parentId) {}
