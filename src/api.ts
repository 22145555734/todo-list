import { clearSession, getToken } from "./token";
import type { TimeSession, Todo } from "./types";

const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // 非 JSON 响应，忽略
    }
    // 非登录接口的 401 视为会话过期，清空本地凭证
    if (res.status === 401 && !path.startsWith("/auth/")) {
      clearSession();
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface AuthResult {
  token: string;
  username: string;
}

export const api = {
  register(username: string, password: string) {
    return request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  login(username: string, password: string) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  listTodos() {
    return request<Todo[]>("/todos");
  },
  createTodo(text: string, parentId: string | null = null) {
    return request<Todo>("/todos", {
      method: "POST",
      body: JSON.stringify({ text, parentId }),
    });
  },
  updateTodo(id: string, patch: { text?: string; completed?: boolean }) {
    return request<Todo>(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteTodo(id: string) {
    return request<void>(`/todos/${id}`, { method: "DELETE" });
  },
  clearCompleted() {
    return request<void>("/todos/completed", { method: "DELETE" });
  },
  listSessions() {
    return request<TimeSession[]>("/sessions");
  },
  startTimer(id: string, start: number) {
    return request<TimeSession>(`/todos/${id}/start`, {
      method: "POST",
      body: JSON.stringify({ start }),
    });
  },
  pauseTimer(id: string, end: number) {
    return request<void>(`/todos/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({ end }),
    });
  },
  /** 把合集已有的计时记录迁移到它的某个子集 */
  adoptTime(containerId: string, targetId: string) {
    return request<void>(`/todos/${containerId}/adopt-time`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
  },
};
