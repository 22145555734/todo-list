package com.todo.session.dto;

/** 把合集已有的计时记录迁移到某个子任务。 */
public record AdoptTimeRequest(String targetId) {}
