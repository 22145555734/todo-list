package com.todo.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** 从当前请求的安全上下文中取已认证用户 id。 */
public final class Auths {
    private Auths() {}

    public static Long userId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long id)) {
            throw new IllegalStateException("未认证");
        }
        return id;
    }
}
