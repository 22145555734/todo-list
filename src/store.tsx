import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { clearSession, getToken, getUsername, setSession } from "./token";
import type { TimeSession, Todo } from "./types";

interface StoreValue {
  token: string | null;
  username: string | null;
  authReady: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  todos: Todo[];
  sessions: TimeSession[];
  runningTodoId: string | null;
  addTodo: (text: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  editTodo: (id: string, text: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  toggleTimer: (todoId: string) => Promise<void>;
  resetTodoTime: (todoId: string) => Promise<void>;
  elapsedMs: (todoId: string, now: number) => number;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string | null>(() => getUsername());
  const [authReady, setAuthReady] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    // token 因 401 被清空时，回到未登录态
    if (!getToken()) {
      setToken(null);
      setUsername(null);
      setTodos([]);
      setSessions([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([api.listTodos(), api.listSessions()]);
      setTodos(t);
      setSessions(s);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions());
    } catch (e) {
      handleError(e);
    }
  }, [handleError]);

  useEffect(() => {
    if (token) {
      loadData().finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, [token, loadData]);

  const login = useCallback(
    async (u: string, p: string) => {
      setError(null);
      try {
        const res = await api.login(u, p);
        setSession(res.token, res.username);
        setToken(res.token);
        setUsername(res.username);
        await loadData();
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [loadData, handleError],
  );

  const register = useCallback(
    async (u: string, p: string) => {
      setError(null);
      try {
        const res = await api.register(u, p);
        setSession(res.token, res.username);
        setToken(res.token);
        setUsername(res.username);
        await loadData();
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [loadData, handleError],
  );

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUsername(null);
    setTodos([]);
    setSessions([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const runningTodoId =
    sessions.find((s) => s.end === null)?.todoId ?? null;

  const addTodo = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      setError(null);
      try {
        const created = await api.createTodo(t);
        setTodos((prev) => [...prev, created]);
      } catch (e) {
        handleError(e);
      }
    },
    [handleError],
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const todo = todos.find((x) => x.id === id);
      if (!todo) return;
      setError(null);
      try {
        const updated = await api.updateTodo(id, { completed: !todo.completed });
        setTodos((prev) => prev.map((x) => (x.id === id ? updated : x)));
      } catch (e) {
        handleError(e);
      }
    },
    [todos, handleError],
  );

  const editTodo = useCallback(
    async (id: string, text: string) => {
      const t = text.trim();
      if (!t) return;
      setError(null);
      try {
        const updated = await api.updateTodo(id, { text: t });
        setTodos((prev) => prev.map((x) => (x.id === id ? updated : x)));
      } catch (e) {
        handleError(e);
      }
    },
    [handleError],
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await api.deleteTodo(id);
        setTodos((prev) => prev.filter((x) => x.id !== id));
        await refreshSessions();
      } catch (e) {
        handleError(e);
      }
    },
    [refreshSessions, handleError],
  );

  const clearCompleted = useCallback(async () => {
    setError(null);
    try {
      await api.clearCompleted();
      await loadData();
    } catch (e) {
      handleError(e);
    }
  }, [loadData, handleError]);

  const toggleTimer = useCallback(
    async (todoId: string) => {
      setError(null);
      try {
        if (runningTodoId === todoId) {
          await api.pauseTimer(todoId, Date.now());
        } else {
          await api.startTimer(todoId, Date.now());
        }
        await refreshSessions();
      } catch (e) {
        handleError(e);
      }
    },
    [runningTodoId, refreshSessions, handleError],
  );

  const resetTodoTime = useCallback(
    async (todoId: string) => {
      setError(null);
      try {
        await api.resetTime(todoId);
        await refreshSessions();
      } catch (e) {
        handleError(e);
      }
    },
    [refreshSessions, handleError],
  );

  const elapsedMs = useCallback(
    (todoId: string, now: number) =>
      sessions
        .filter((s) => s.todoId === todoId)
        .reduce((sum, s) => sum + ((s.end ?? now) - s.start), 0),
    [sessions],
  );

  const value: StoreValue = {
    token,
    username,
    authReady,
    loading,
    error,
    clearError,
    login,
    register,
    logout,
    todos,
    sessions,
    runningTodoId,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    clearCompleted,
    toggleTimer,
    resetTodoTime,
    elapsedMs,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}
