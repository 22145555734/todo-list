package com.todo.session.dto;

public record SessionDto(String id, String todoId, String subject, long start, Long end) {}
