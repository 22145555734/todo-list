import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { applyGroupOrder } from "./reorder";
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
  /** 某合集的子任务列表（无子任务时返回稳定的空数组） */
  childrenOf: (parentId: string) => Todo[];
  addTodo: (text: string, parentId?: string | null) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  editTodo: (id: string, text: string) => Promise<void>;
  /** 把同一层级的兄弟事项重排成给定顺序（乐观更新，失败回滚） */
  reorderSiblings: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  clearCompleted: () => Promise<void>;
  toggleTimer: (todoId: string) => Promise<void>;
  adoptTime: (containerId: string, targetId: string) => Promise<void>;
  /** 累计时长：合集为其自身记录与整棵子树之和 */
  elapsedMs: (todoId: string, now: number) => number;
  /** 本项在当前预算周期内的已用时长（按 planDate 过滤；无 planDate 则累计这条任务的全部） */
  budgetSpentMs: (todo: Todo, now: number) => number;
  /** 到点停表：把进行中的会话结束在「预算正好用完」那一刻，而不是现在 */
  finishBudget: (todo: Todo) => Promise<void>;
  /** 设定预算（分钟）；传 null 表示清除 */
  setBudget: (id: string, minutes: number | null) => Promise<void>;
}

const NO_CHILDREN: Todo[] = [];

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

  // 待办和会话一起拉。待办必须跟着会话一起更新：预算按 planDate 归属，
  // 只刷新会话、留着过期的 planDate，就会「正在计时但倒计时不动」（见下面的可见性刷新）。
  const refreshAll = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([api.listTodos(), api.listSessions()]);
      setTodos(t);
      setSessions(s);
    } catch (e) {
      handleError(e);
    }
  }, [handleError]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await refreshAll();
    setLoading(false);
  }, [refreshAll]);

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

  // 页面一直开着，服务端干了什么它是不知道的：每天 04:00 的计划同步会把 planDate 翻到新一天，
  // 预算扫描会把超时的会话停掉。回到页面时补拉一次，倒计时才不会卡在昨天的周期上。
  useEffect(() => {
    if (!token) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [token, refreshAll]);

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

  const runningSession = useMemo(
    () => sessions.find((s) => s.end === null) ?? null,
    [sessions],
  );
  const runningTodoId = runningSession?.todoId ?? null;

  // 预计算每个 todo 已完成会话的累计时长，elapsedMs 改为 O(1) 查询
  const completedMsByTodo = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      if (s.end !== null) {
        m.set(s.todoId, (m.get(s.todoId) ?? 0) + (s.end - s.start));
      }
    }
    return m;
  }, [sessions]);

  // 同一 (事项, 归属日) 下已结束会话的总时长 —— 预算按天结算，不能把昨天的算进来
  const completedMsByTodoPlan = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      if (s.end === null) continue;
      const key = `${s.todoId}|${s.planDate ?? ""}`;
      m.set(key, (m.get(key) ?? 0) + (s.end - s.start));
    }
    return m;
  }, [sessions]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, Todo[]>();
    for (const t of todos) {
      if (!t.parentId) continue;
      const list = m.get(t.parentId);
      if (list) list.push(t);
      else m.set(t.parentId, [t]);
    }
    return m;
  }, [todos]);

  const childrenOf = useCallback(
    (parentId: string) => childrenByParent.get(parentId) ?? NO_CHILDREN,
    [childrenByParent],
  );

  const addTodo = useCallback(
    async (text: string, parentId: string | null = null) => {
      const t = text.trim();
      if (!t) return;
      setError(null);
      try {
        const created = await api.createTodo(t, parentId);
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

  // 先本地重排（拖拽的反馈要跟手），再发请求；失败回滚到拖之前那一份
  const reorderSiblings = useCallback(
    async (parentId: string | null, orderedIds: string[]) => {
      const snapshot = todos;
      setError(null);
      setTodos((cur) => applyGroupOrder(cur, parentId, orderedIds));
      try {
        await api.reorderTodos(parentId, orderedIds);
      } catch (e) {
        setTodos(snapshot);
        handleError(e);
      }
    },
    [todos, handleError],
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await api.deleteTodo(id);
        // 删除合集会级联删掉它的子任务
        setTodos((prev) => prev.filter((x) => x.id !== id && x.parentId !== id));
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
        // 这里连待办一起刷：会话的 planDate 是后端按当下的待办快照的，页面上的待办可能过期，
        // 两边对不上倒计时就会原地不动。点一次开始，正好把页面拉回当前周期。
        await refreshAll();
      } catch (e) {
        handleError(e);
      }
    },
    [runningTodoId, refreshAll, handleError],
  );

  const ownMs = useCallback(
    (todoId: string, now: number) => {
      let total = completedMsByTodo.get(todoId) ?? 0;
      if (runningSession && runningSession.todoId === todoId) {
        total += now - runningSession.start;
      }
      return total;
    },
    [completedMsByTodo, runningSession],
  );

  const adoptTime = useCallback(
    async (containerId: string, targetId: string) => {
      setError(null);
      try {
        await api.adoptTime(containerId, targetId);
        await refreshSessions();
      } catch (e) {
        handleError(e);
      }
    },
    [refreshSessions, handleError],
  );

  // 合集的总时长 = 自身残留记录 + 整棵子树之和。
  //
  // 递归得走 ref：useCallback 里函数还没有自己的名字可用；而如果每次渲染新建一个函数，
  // 传给 memo 过的 TodoItem 的 props 每秒都变，整个列表会跟着秒级重渲染。
  // 所以对外始终暴露同一个函数，内部再指向当下这份实现。
  const elapsedRef = useRef<(todoId: string, now: number) => number>(() => 0);
  elapsedRef.current = (todoId, now) => {
    let total = ownMs(todoId, now);
    for (const c of childrenByParent.get(todoId) ?? NO_CHILDREN) {
      total += elapsedRef.current(c.id, now);
    }
    return total;
  };
  const elapsedMs = useCallback(
    (todoId: string, now: number) => elapsedRef.current(todoId, now),
    [],
  );

  const budgetSpentMs = useCallback(
    (todo: Todo, now: number) => {
      let total = completedMsByTodoPlan.get(`${todo.id}|${todo.planDate ?? ""}`) ?? 0;
      if (
        runningSession &&
        runningSession.todoId === todo.id &&
        (runningSession.planDate ?? "") === (todo.planDate ?? "")
      ) {
        total += now - runningSession.start;
      }
      return total;
    },
    [completedMsByTodoPlan, runningSession],
  );

  // 结束在「预算正好用完」的那一刻，而不是点下去的那一刻 —— 否则扫描/渲染的一两秒误差
  // 会天天累积，统计和预算对不上
  const finishBudget = useCallback(
    async (todo: Todo) => {
      const planned = todo.plannedMs ?? 0;
      const rs = sessions.find((s) => s.end === null && s.todoId === todo.id);
      if (!rs || planned <= 0) return;
      setError(null);
      try {
        // now 传 rs.start，让「进行中那一段」贡献 0，只累计此前已结束的会话
        const before = budgetSpentMs(todo, rs.start);
        const end = Math.min(Date.now(), rs.start + Math.max(0, planned - before));
        await api.pauseTimer(todo.id, end);
        await refreshSessions();
      } catch (e) {
        handleError(e);
      }
    },
    [sessions, budgetSpentMs, refreshSessions, handleError],
  );

  const setBudget = useCallback(
    async (id: string, minutes: number | null) => {
      setError(null);
      try {
        // 0 当作「没有预算」：后端把 null 理解为「这个字段不改」，无法用它来清除
        const updated = await api.updateTodo(id, { plannedMs: Math.max(0, minutes ?? 0) * 60000 });
        setTodos((prev) => prev.map((x) => (x.id === id ? updated : x)));
      } catch (e) {
        handleError(e);
      }
    },
    [handleError],
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
    childrenOf,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    reorderSiblings,
    clearCompleted,
    toggleTimer,
    adoptTime,
    elapsedMs,
    budgetSpentMs,
    finishBudget,
    setBudget,
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
