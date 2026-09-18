import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useStore } from "./store";
import { useNow } from "./useNow";
import { formatHms, formatShort } from "./time";
import { getLevelInfo, levelColor, levelColorText } from "./level";
import type { Todo } from "./types";

type Filter = "all" | "active" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "completed", label: "已完成" },
];

interface TodoItemProps {
  todo: Todo;
  /** 本项自身正在计时 */
  running: boolean;
  /** 子任务数量，> 0 表示为合集（自身不再计时） */
  childCount: number;
  /** 合集中正在计时的子任务名，无则为 null */
  childRunningName: string | null;
  elapsedMs: (todoId: string, now: number) => number;
  onToggle: (id: string) => void;
  /** 请求删除：不直接删，先弹二次确认 */
  onRequestDelete: (todo: Todo) => void;
  onEdit: (id: string, text: string) => void;
  onToggleTimer: (id: string) => void;
  onAddChild: (id: string) => void;
  /** 子任务列表是否已收起（只对合集有意义） */
  collapsed: boolean;
  onToggleCollapse: (id: string) => void;
}

const TodoItem = memo(function TodoItem({
  todo,
  running,
  childCount,
  childRunningName,
  elapsedMs,
  onToggle,
  onRequestDelete,
  onEdit,
  onToggleTimer,
  onAddChild,
  collapsed,
  onToggleCollapse,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const isContainer = childCount > 0;
  const isChild = todo.parentId !== null;
  const ticking = running || childRunningName !== null;

  // 仅当本项（或其子任务）正在计时时才每秒 tick，避免整个列表跟着重渲染
  const now = useNow(ticking);
  const elapsed = elapsedMs(todo.id, now);
  const info = getLevelInfo(elapsed);
  const isMaxLevel = info.nextLevel === null;
  const badgeColor = isMaxLevel ? "" : levelColor(info.level);
  const titleColor = isMaxLevel ? "" : levelColorText(info.level);

  const startEdit = () => {
    setEditing(true);
    setText(todo.text);
  };

  const commitEdit = () => {
    const t = text.trim();
    if (t) onEdit(todo.id, t);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          className="h-5 w-5 cursor-pointer accent-blue-500"
        />

        {editing ? (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            autoFocus
            className="flex-1 rounded border border-blue-400 px-2 py-1 text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            title="双击编辑"
            className={`flex-1 cursor-text break-all ${
              todo.completed
                ? "text-gray-400 line-through"
                : "text-gray-700"
            }`}
          >
            {todo.text}
          </span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={startEdit}
            className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
            aria-label="编辑任务"
          >
            编辑
          </button>
          <button
            onClick={() => onRequestDelete(todo)}
            className="rounded-md px-2 py-1 text-sm text-red-500 transition hover:bg-red-50 hover:text-red-600"
            aria-label="删除任务"
          >
            删除
          </button>
        </div>
      </div>

      {/* 计时区 */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {ticking && (
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
          )}
          <span
            className={`font-mono text-sm tabular-nums ${
              ticking ? "text-green-600" : "text-gray-600"
            }`}
          >
            {formatHms(elapsed)}
          </span>
          {isContainer && (
            <span className="truncate text-xs text-gray-500">
              {childRunningName
                ? `正在计时：${childRunningName}`
                : `${childCount} 个子任务`}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isContainer && (
            <button
              onClick={() => onToggleTimer(todo.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium text-white transition ${
                running
                  ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700"
                  : "bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
              }`}
            >
              {running ? "暂停" : "开始计时"}
            </button>
          )}
          {!isChild && (
            <button
              onClick={() => onAddChild(todo.id)}
              className="rounded-md px-2 py-1 text-sm text-blue-500 transition hover:bg-blue-50 hover:text-blue-600"
              aria-label="添加子任务"
              title="把这项变成一个合集，给它的子任务分别计时"
            >
              + 子任务
            </button>
          )}
          {/* 子任务多起来会把列表撑得很长，留给用户一个收起来的开关 */}
          {isContainer && (
            <button
              onClick={() => onToggleCollapse(todo.id)}
              aria-expanded={!collapsed}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
            >
              {collapsed ? "展开" : "收起"}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  collapsed ? "-rotate-90" : ""
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 等级 / 称号：合集按各子任务累加的总时长计算，子任务没有；颜色随等级渐变，满级炫彩 */}
      {!isChild && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold leading-none text-white ${
                  isMaxLevel ? "rainbow-bg" : ""
                }`}
                style={isMaxLevel ? undefined : { backgroundColor: badgeColor }}
              >
                Lv.{info.level}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isMaxLevel ? "rainbow-text" : ""
                }`}
                style={isMaxLevel ? undefined : { color: titleColor }}
              >
                {info.title}
              </span>
            </span>
            <span className="text-xs tabular-nums text-gray-500">
              {info.nextLevel
                ? `距 Lv.${info.nextLevel} 还需 ${formatShort(info.remainingMs)}`
                : "已满级"}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 ring-1 ring-inset ring-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                isMaxLevel ? "rainbow-bg" : ""
              }`}
              style={
                isMaxLevel
                  ? { width: "100%" }
                  : {
                      width: `${(info.progress * 100).toFixed(1)}%`,
                      background: badgeColor,
                    }
              }
            />
          </div>
        </div>
      )}
    </div>
  );
});

/** 可展开/收起容器：展开时做高度入场动画，收起时高度归零、动画结束后卸载内容 */
function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const first = useRef(true);

  // 展开：挂载内容（卸载推迟到收起动画结束，见下）
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // 入场动画：内容刚挂载后（此时才能测到自然高度）从 0 过渡到自然高度
  useEffect(() => {
    if (!mounted) return;
    if (first.current) {
      first.current = false;
      return; // 首次渲染直接落位，不做动画
    }
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    void el.offsetHeight; // 强制回流，让起点 0 生效
    el.style.height = `${el.scrollHeight}px`;
    const finish = () => {
      el.style.height = "auto";
    };
    const timer = window.setTimeout(finish, 300);
    el.addEventListener("transitionend", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", finish);
    };
  }, [mounted]);

  // 退场动画：高度归零，动画结束后卸载内容（否则元素留在 DOM 里仍可被聚焦）
  useEffect(() => {
    if (open || first.current) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = `${el.scrollHeight}px`;
    void el.offsetHeight;
    el.style.height = "0px";
    const finish = () => setMounted(false);
    const timer = window.setTimeout(finish, 300);
    el.addEventListener("transitionend", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("transitionend", finish);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ overflow: "hidden", transition: "height 250ms ease" }}
    >
      {mounted ? children : null}
    </div>
  );
}

/**
 * 删除二次确认弹窗。
 * 只问「删不删」——事项名、子任务数这些点按钮时本来就知道，不占版面。
 */
function DeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    // 点遮罩等同取消
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <h2
          id="delete-confirm-title"
          className="text-base font-bold text-gray-800"
        >
          确定删除吗？
        </h2>
        <p id="delete-confirm-desc" className="mt-2 text-sm text-gray-600">
          删除后不可恢复。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          {/* 默认焦点给「取消」，避免一路回车误删 */}
          <button
            autoFocus
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 active:bg-red-700"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

/** 新建子任务后，若合集本身还留着计时记录，提示迁到某个子任务下 */
interface MigrateHint {
  containerId: string;
  ms: number;
}

export default function TodoList() {
  const {
    todos,
    runningTodoId,
    childrenOf,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    clearCompleted,
    toggleTimer,
    adoptTime,
    elapsedMs,
  } = useStore();

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [childInput, setChildInput] = useState("");
  const [migrate, setMigrate] = useState<MigrateHint | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // 已收起的合集 id。默认全展开——加子任务本就是为了给它们计时，不该被折叠挡住
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addTodo(input);
    setInput("");
  };

  const openAddChild = useCallback((id: string) => {
    setAddingChildFor(id);
    setChildInput("");
    // 收起状态下点「+ 子任务」要自动展开，否则刚加的子任务看不见
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 删除走二次确认：先记住待删 id，确认后才真正调用 deleteTodo
  const requestDelete = useCallback((todo: Todo) => {
    setPendingDeleteId(todo.id);
  }, []);

  const cancelDelete = useCallback(() => setPendingDeleteId(null), []);

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) deleteTodo(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, deleteTodo]);

  const submitChild = async (e: FormEvent, parent: Todo) => {
    e.preventDefault();
    const text = childInput.trim();
    if (!text) return;
    const before = elapsedMs(parent.id, Date.now());
    const isFirst = childrenOf(parent.id).length === 0;
    // 转成合集后它自己不再计时，先停掉正在跑的计时器
    if (runningTodoId === parent.id) await toggleTimer(parent.id);
    await addTodo(text, parent.id);
    setChildInput("");
    setAddingChildFor(null);
    if (isFirst && before > 0) {
      setMigrate({ containerId: parent.id, ms: before });
    }
  };

  const roots = useMemo(() => todos.filter((t) => t.parentId === null), [todos]);

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case "active":
        return roots.filter((t) => !t.completed);
      case "completed":
        return roots.filter((t) => t.completed);
      default:
        return roots;
    }
  }, [roots, filter]);

  const remaining = roots.filter((t) => !t.completed).length;

  return (
    <div className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">待办事项</h1>
      <p className="mb-4 text-sm text-gray-500">
        每个事项可独立计时；给事项加上子任务后，它的时长由各子任务累加
      </p>

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="添加新任务..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-600 active:bg-blue-700"
        >
          添加
        </button>
      </form>

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === value
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visibleTodos.length === 0 ? (
          <li className="py-6 text-center text-gray-400">
            {todos.length === 0 ? "暂无任务，添加一条吧" : "该筛选条件下无任务"}
          </li>
        ) : (
          visibleTodos.map((todo) => {
            const children = childrenOf(todo.id);
            const runningChild =
              children.find((c) => c.id === runningTodoId) ?? null;
            return (
              <li key={todo.id}>
                <TodoItem
                  todo={todo}
                  running={runningTodoId === todo.id}
                  childCount={children.length}
                  childRunningName={runningChild?.text ?? null}
                  elapsedMs={elapsedMs}
                  onToggle={toggleTodo}
                  onRequestDelete={requestDelete}
                  onEdit={editTodo}
                  onToggleTimer={toggleTimer}
                  onAddChild={openAddChild}
                  collapsed={collapsedIds.has(todo.id)}
                  onToggleCollapse={toggleCollapse}
                />

                {children.length > 0 && (
                  <Collapsible open={!collapsedIds.has(todo.id)}>
                    <ul className="ml-3 mt-2 space-y-2 border-l-2 border-blue-100 pl-3">
                      {children.map((c) => (
                        <li key={c.id}>
                          <TodoItem
                            todo={c}
                            running={runningTodoId === c.id}
                            childCount={0}
                            childRunningName={null}
                            elapsedMs={elapsedMs}
                            onToggle={toggleTodo}
                            onRequestDelete={requestDelete}
                            onEdit={editTodo}
                            onToggleTimer={toggleTimer}
                            onAddChild={openAddChild}
                            collapsed={false}
                            onToggleCollapse={toggleCollapse}
                          />
                        </li>
                      ))}
                    </ul>
                  </Collapsible>
                )}

                {addingChildFor === todo.id && (
                  <form
                    onSubmit={(e) => submitChild(e, todo)}
                    className="mt-2 flex gap-2 pl-3"
                  >
                    <input
                      type="text"
                      value={childInput}
                      onChange={(e) => setChildInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setAddingChildFor(null);
                      }}
                      placeholder="添加子任务..."
                      autoFocus
                      className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600"
                    >
                      添加
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingChildFor(null)}
                      className="rounded-lg px-2 py-1.5 text-sm text-gray-500 transition hover:text-gray-700"
                    >
                      取消
                    </button>
                  </form>
                )}

                {migrate?.containerId === todo.id && children.length > 0 && (
                  <div className="ml-3 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="mb-2 text-xs text-amber-800">
                      「{todo.text}」原有 {formatShort(migrate.ms)} 记录，
                      迁到哪个子任务？
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            adoptTime(todo.id, c.id);
                            setMigrate(null);
                          }}
                          className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-600"
                        >
                          {c.text}
                        </button>
                      ))}
                      <button
                        onClick={() => setMigrate(null)}
                        className="rounded-md px-2.5 py-1 text-xs text-amber-700 transition hover:bg-amber-100"
                      >
                        暂不迁移
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>

      {roots.length > 0 && (
        <footer className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
          <span>
            剩余 {remaining} / {roots.length} 项
          </span>
          {todos.some((t) => t.completed) && (
            <button
              onClick={clearCompleted}
              className="text-blue-500 transition hover:text-blue-600"
            >
              清除已完成
            </button>
          )}
        </footer>
      )}

      {pendingDeleteId && (
        <DeleteConfirm onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </div>
  );
}
