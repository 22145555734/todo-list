import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { TimeSession, Todo } from "./types";

const TODO_KEY = "todo-list";
const SESSION_KEY = "todo-time-sessions";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface StoreValue {
  todos: Todo[];
  sessions: TimeSession[];
  /** 当前正在计时的待办 id，没有则为 null */
  runningTodoId: string | null;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  editTodo: (id: string, text: string) => void;
  clearCompleted: () => void;
  /** 开始/暂停某事项的计时；开始时会自动暂停其它正在运行的计时器 */
  toggleTimer: (todoId: string) => void;
  resetTodoTime: (todoId: string) => void;
  /** 某事项累计时长（毫秒），now 用于把进行中的会话算到当前时刻 */
  elapsedMs: (todoId: string, now: number) => number;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>(() => load<Todo[]>(TODO_KEY, []));
  const [sessions, setSessions] = useState<TimeSession[]>(() =>
    load<TimeSession[]>(SESSION_KEY, []),
  );

  useEffect(() => {
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const runningTodoId =
    sessions.find((s) => s.end === null)?.todoId ?? null;

  const addTodo = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: t, completed: false },
    ]);
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    // 删除事项时保留其历史计时记录，只结束仍进行中的会话
    setSessions((prev) => {
      const running = prev.find((s) => s.end === null);
      if (running && running.todoId === id) {
        return prev.map((s) =>
          s.id === running.id ? { ...s, end: Date.now() } : s,
        );
      }
      return prev;
    });
  };

  const editTodo = (id: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, text: t } : todo)),
    );
  };

  const clearCompleted = () => {
    setTodos((prev) => prev.filter((t) => !t.completed));
  };

  const toggleTimer = (todoId: string) => {
    const subject = todos.find((t) => t.id === todoId)?.text ?? "已删除事项";
    setSessions((prev) => {
      const running = prev.find((s) => s.end === null);
      // 暂停当前正在运行的这个计时器
      if (running && running.todoId === todoId) {
        return prev.map((s) =>
          s.id === running.id ? { ...s, end: Date.now() } : s,
        );
      }
      // 先暂停其它正在运行的计时器，再开启新的
      const now = Date.now();
      const paused = running
        ? prev.map((s) => (s.id === running.id ? { ...s, end: now } : s))
        : prev;
      return [
        ...paused,
        { id: crypto.randomUUID(), todoId, subject, start: now, end: null },
      ];
    });
  };

  const resetTodoTime = (todoId: string) => {
    setSessions((prev) => prev.filter((s) => s.todoId !== todoId));
  };

  const elapsedMs = (todoId: string, now: number) =>
    sessions
      .filter((s) => s.todoId === todoId)
      .reduce((sum, s) => sum + ((s.end ?? now) - s.start), 0);

  const value: StoreValue = {
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
