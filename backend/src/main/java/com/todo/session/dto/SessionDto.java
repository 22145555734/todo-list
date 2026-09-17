package com.todo.session.dto;

public record SessionDto(
        String id, String todoId, String subject, String rootSubject, long start, Long end) {}
