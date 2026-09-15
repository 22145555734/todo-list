import { memo, useMemo, useState, type FormEvent } from "react";
import { useStore } from "./store";
import { useNow } from "./useNow";
import { formatHms, formatShort } from "./time";
import { getLevelInfo } from "./level";
import type { Todo } from "./types";

type Filter = "all" | "active" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "completed", label: "已完成" },
];

interface TodoItemProps {
  todo: Todo;
  running: boolean;
  elapsedMs: (todoId: string, now: number) => number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onToggleTimer: (id: string) => void;
  onReset: (id: string) => void;
}

const TodoItem = memo(function TodoItem({
  todo,
  running,
  elapsedMs,
  onToggle,
  onDelete,
  onEdit,
  onToggleTimer,
  onReset,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  // 仅当本项正在计时时才每秒 tick，避免整个列表跟着重渲染
  const now = useNow(running);
  const elapsed = elapsedMs(todo.id, now);
  const info = getLevelInfo(elapsed);

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
    <li className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
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
            onClick={() => onDelete(todo.id)}
            className="rounded-md px-2 py-1 text-sm text-red-500 transition hover:bg-red-50 hover:text-red-600"
            aria-label="删除任务"
          >
            删除
          </button>
        </div>
      </div>

      {/* 计时区 */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <div className="flex items-center gap-1.5">
          {running && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          )}
          <span
            className={`font-mono text-sm tabular-nums ${
              running ? "text-green-600" : "text-gray-600"
            }`}
          >
            {formatHms(elapsed)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
          {elapsed > 0 && (
            <button
              onClick={() => onReset(todo.id)}
              className="rounded-md px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
              aria-label="清零计时"
              title="清零计时记录"
            >
              清零
            </button>
          )}
        </div>
      </div>

      {/* 等级 / 称号 */}
      <div className="mt-2 border-t border-gray-100 pt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white">
              Lv.{info.level}
            </span>
            <span className="text-sm font-semibold text-gray-700">
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
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
            style={{ width: `${(info.progress * 100).toFixed(1)}%` }}
          />
        </div>
      </div>
    </li>
  );
});

export default function TodoList() {
  const {
    todos,
    runningTodoId,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    clearCompleted,
    toggleTimer,
    resetTodoTime,
    elapsedMs,
  } = useStore();

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addTodo(input);
    setInput("");
  };

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case "active":
        return todos.filter((t) => !t.completed);
      case "completed":
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  }, [todos, filter]);

  const remaining = todos.filter((t) => !t.completed).length;

  return (
    <div className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">待办事项</h1>
      <p className="mb-4 text-sm text-gray-500">
        每个事项可独立计时，累计你在该领域投入的总时间
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
          visibleTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              running={runningTodoId === todo.id}
              elapsedMs={elapsedMs}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onEdit={editTodo}
              onToggleTimer={toggleTimer}
              onReset={resetTodoTime}
            />
          ))
        )}
      </ul>

      {todos.length > 0 && (
        <footer className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-sm text-gray-500">
          <span>
            剩余 {remaining} / {todos.length} 项
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
    </div>
  );
}
