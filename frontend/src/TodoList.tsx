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
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useStore } from "./store";
import { useNow } from "./useNow";
import { formatHms, formatShort } from "./time";
import { getLevelInfo, levelFont, levelShimmer } from "./level";
import { siblingIds } from "./reorder";
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
  const font = levelFont(info.level);
  // 只有满级是 null（它走整条彩虹的 .rainbow-*），1~499 级都有自己的本档炫动。
  // 所以下面凡是用到 shimmer 的地方都不必再判 isMaxLevel —— 两者互为反面。
  const shimmer = levelShimmer(info.level);

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
            /* select-text 抵消拖拽面继承下来的 user-select:none，否则编辑时选不中已有文字 */
            className="flex-1 select-text rounded border border-blue-400 px-2 py-1 text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
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
                className={`rounded-md px-2 py-0.5 font-bold leading-none text-white ${
                  isMaxLevel ? "rainbow-bg" : "shimmer-bg"
                }`}
                style={{
                  // 徽章刻意不设 font-family：数字和 "Lv." 用艺术字体不好认
                  fontSize: `${font.badgeSize}px`,
                  ...(shimmer
                    ? {
                        backgroundImage: shimmer.badgeImage,
                        animationDuration: `${shimmer.durationS}s`,
                      }
                    : {}),
                }}
              >
                Lv.{info.level}
              </span>
              <span
                className={`font-semibold ${isMaxLevel ? "rainbow-text" : "shimmer-text"}`}
                style={{
                  fontSize: `${font.titleSize}px`,
                  ...(font.titleFamily ? { fontFamily: font.titleFamily } : {}),
                  ...(shimmer
                    ? {
                        backgroundImage: shimmer.titleImage,
                        animationDuration: `${shimmer.durationS}s`,
                      }
                    : {}),
                }}
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
                isMaxLevel ? "rainbow-bg" : "shimmer-bg"
              }`}
              style={{
                width: isMaxLevel ? "100%" : `${(info.progress * 100).toFixed(1)}%`,
                // 与徽章同一套渐变与时长 —— 进度条也是「本等级色」，跟着一起流动
                ...(shimmer
                  ? {
                      backgroundImage: shimmer.badgeImage,
                      animationDuration: `${shimmer.durationS}s`,
                    }
                  : {}),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 一行可拖拽的事项。
 *
 * `setNodeRef` 挂在 `<li>` 上、`listeners` 挂在内层卡片 div 上，**这两者必须分开**：
 *
 * - 测量单位得是整行（卡片 + 它下面的子任务列表），否则邻居的让位距离只按卡片高度算，
 *   带子任务的合集落地时会再跳一截。
 * - `listeners` 若跟着挂到 `<li>`，由于子任务列表在 `<li>` 里面，按子任务会同时命中内外两层
 *   激活器，而 dnd-kit 只保留一个 active —— 结果是「拖子任务变成了拖整个合集」。
 */
function SortableRow({
  id,
  parentId,
  card,
  children,
}: {
  id: string;
  parentId: string | null;
  card: ReactNode;
  children?: ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id, data: { parentId } });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
    >
      {/* 拖拽期间**整行一起隐掉**，不只是卡片：子任务这会儿已经跟着浮层卡飘走了，
          原地再画一份就是重影。
          隐的是外面这一层，`listeners` 仍只挂在卡片那一层 —— 挂到外面来的话，按下子任务
          会同时命中内外两个激活器（dnd-kit 只保留一个 active），变成「拖子任务 = 拖整个合集」。
          这一行在拖拽期间仍然会变矮（子任务那份 `Collapsible` 被强制收起，列表好合上），
          所以还得靠 `<RemeasureWhileCollapsing>` 催 dnd-kit 重测。 */}
      <div className={isDragging ? "opacity-0" : ""}>
        {/* touch-action 只能用 manipulation —— 整卡都是拖拽面，用 none 会让页面彻底划不动 */}
        <div
          {...listeners}
          className="touch-manipulation select-none [-webkit-touch-callout:none]"
        >
          {card}
        </div>
        {children}
      </div>
    </li>
  );
}

/**
 * 浮层里那一份子任务：**挂上时从自然高度收到 0** —— 也就是「边浮边收回」。
 *
 * 只做收起、不做展开：浮层一放下就整个卸载了，没有展开这一回事。
 * 不用 `Collapsible` 是因为它的入场要靠 `open` 从 false 翻到 true，而这里需要的是反过来
 * —— 出生就是展开的，然后收掉；直接在这里当场量高度最省事。
 */
function OverlayFolded({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${el.scrollHeight}px`;
    void el.offsetHeight; // 强制回流，让起点落在自然高度上（否则 auto → 0px 不产生过渡）
    el.style.height = "0px";
  }, []);

  return (
    <div ref={ref} style={{ overflow: "hidden", transition: "height 250ms ease" }}>
      {children}
    </div>
  );
}

/**
 * 拖拽期间被拖那一行的子任务正在收起，节点在逐帧变矮 —— 而 dnd-kit **只在「拖拽开始」
 * 和「droppable 增删」时重测各行矩形**（`useDroppableMeasuring`），它不认节点变矮。
 * 不催它的话，邻居的让位距离会一直按「还没收起」的旧矩形算，比不收起还歪。
 *
 * 三个前提都查过库的产物，不是猜的：
 * - `droppable.measure` 是 `getTransformAgnosticClientRect`（`ignoreTransform: true`），
 *   会**扣掉元素自身的位移 transform** —— 所以反复重测是收敛的，不会把让位的
 *   transform 叠加进去
 * - `frequency` 默认是字符串 `'optimized'`，而定时重测那个 effect 有
 *   `typeof frequency !== 'number'` 的早退 —— 库自己**没有任何周期性重测**，
 *   `MeasuringStrategy` 的三个值都只影响「什么时候允许测」，不影响「多久测一次」
 * - 传**空数组**给 `measureDroppableContainers()` 才会全量重测（传了 id 就是「只测队列里的、
 *   其余复用缓存」）。类型声明把这个参数写成必填（`store/types.d.ts:81`），而实现里有
 *   `ids === void 0 → []` 的兜底 —— 两者对不上，所以这里显式传 `[]`
 *
 * **只跑收起动画那么长，不是整个拖拽过程**：每测一次都要重渲染整个列表，全程 60fps
 * 地跑在低端机上会掉帧。
 */
function RemeasureWhileCollapsing({ active }: { active: boolean }) {
  const { measureDroppableContainers } = useDndContext();

  useEffect(() => {
    if (!active) return;
    let raf = requestAnimationFrame(function tick() {
      measureDroppableContainers([]);
      raf = requestAnimationFrame(tick);
    });
    // 与 Collapsible 的收起等长：250ms 高度过渡 + 300ms 兜底定时
    const timer = window.setTimeout(() => cancelAnimationFrame(raf), 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [active, measureDroppableContainers]);

  return null;
}

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
  //
  // 依赖里**必须带上 `open`**，不能只看 `mounted`。收起动画走到一半又被展开时
  // （拖拽尤其容易：按下、浮起、随手一放，前后不到 250ms），`mounted` 从头到尾都是
  // true，只盯它的 effect 根本不会重跑 —— 于是行内 height 停在退场动画设的 `0px` 上，
  // 子任务再也回不来，且没有任何报错。（手点「收起」后立刻再点「展开」也会踩到。）
  useEffect(() => {
    if (!open) return; // 只在「开」的方向跑；「关」由下面那个 effect 负责
    if (!mounted) return; // 内容还没挂上，量不到高度，等 mounted 变了会再跑一次
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
  }, [open, mounted]);

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
    reorderSiblings,
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

  // 电脑靠鼠标、手机靠触摸，天然分流，正好对上「PC 直接拖 / 手机长按 1 秒」：
  // - MouseSensor 用 distance：鼠标移动 4px 才算拖，纯点击（勾选、双击编辑）不触发。
  //   这里**不能**给 tolerance —— 在 distance 约束下 tolerance 是「超过即取消」，
  //   鼠标一甩超过 8px 反而永远拖不起来。
  // - TouchSensor 用 delay：按住 1 秒才算，期间手指移动超过 10px 就中止激活 —— 这是列表
  //   还能正常滑动的关键。tolerance 在这个约束下是**必填**，缺了会在库内部解构 undefined 崩掉。
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 1000, tolerance: 10 },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  const parentIdOf = useCallback(
    (id: string) => todos.find((t) => t.id === id)?.parentId ?? null,
    [todos],
  );

  // 只把同分组的项当候选，跨层自然落空。顺带规避多容器下 closestCenter 的碰撞闪烁
  // （等距时在两个容器间来回跳，dnd-kit#1213）。
  const collisionDetection = useCallback<CollisionDetection>(
    ({ droppableContainers, active, ...args }) => {
      const parentId = parentIdOf(String(active.id));
      return closestCenter({
        ...args,
        active,
        droppableContainers: droppableContainers.filter(
          (c) =>
            (c.data.current as { parentId?: string | null } | undefined)
              ?.parentId === parentId,
        ),
      });
    },
    [parentIdOf],
  );

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    // 长按成功的触感反馈。部分 WebView（如百度 App）会屏蔽它 —— 所以浮起动画才是主反馈，
    // 拿不到就算了，不能依赖这一下震动。
    navigator.vibrate?.(10);
  }, []);

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over || active.id === over.id) return;
      const parentId = parentIdOf(String(active.id));
      // 兜底：碰撞过滤万一放行了跨层候选，这里再挡一次
      if (parentIdOf(String(over.id)) !== parentId) return;

      // 下标必须在**完整**兄弟列表上算。dnd-kit 给的是可见子集的下标，
      // 在「进行中 / 已完成」筛选下拿它去 arrayMove 完整列表，算出来的位置是错的。
      const ids = siblingIds(todos, parentId);
      reorderSiblings(
        parentId,
        arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))),
      );
    },
    [todos, parentIdOf, reorderSiblings],
  );

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) ?? null : null;
  const overlayChildren = activeTodo ? childrenOf(activeTodo.id) : [];

  // 拖的这一行确实有子任务、而且当前是展开的 —— 只有这种情况才会有收起动画，
  // 也才需要逐帧重测
  const collapsing =
    activeId !== null &&
    !collapsedIds.has(activeId) &&
    childrenOf(activeId).length > 0;

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

  // 卡片本体抽出来给列表和拖拽浮层共用，免得两处 props 写歪
  const renderCard = (todo: Todo) => {
    const children = childrenOf(todo.id);
    const runningChild = children.find((c) => c.id === runningTodoId) ?? null;
    return (
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
    );
  };

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

      {/* 一级与子任务共用同一个 DndContext，各自套一个 SortableContext。
          嵌套 SortableContext 是官方支持的（两边 id 不能重 —— 我们的是 UUID，天然不重）；
          嵌套 DndContext 则不行，内层会和外层同时收到同一批事件。 */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <RemeasureWhileCollapsing active={collapsing} />
        <SortableContext
          items={visibleTodos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {visibleTodos.length === 0 ? (
              <li className="py-6 text-center text-gray-400">
                {todos.length === 0
                  ? "暂无任务，添加一条吧"
                  : "该筛选条件下无任务"}
              </li>
            ) : (
              visibleTodos.map((todo) => {
                const children = childrenOf(todo.id);
                return (
                  <SortableRow
                    key={todo.id}
                    id={todo.id}
                    parentId={null}
                    card={renderCard(todo)}
                  >
                    {/* 拖这一行时把它的子任务收起来，落地再展开 —— 走 Collapsible 正常的
                        收起/展开动画，和手点「收起」看起来一样。
                        本来就没展开的行 open 本来就是 false，不受影响。
                        收起动画期间要靠 <RemeasureWhileCollapsing> 催 dnd-kit 重测，原因见那边。 */}
                    {children.length > 0 && (
                      <Collapsible
                        open={!collapsedIds.has(todo.id) && activeId !== todo.id}
                      >
                        <SortableContext
                          items={children.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="ml-3 mt-2 space-y-2 border-l-2 border-blue-100 pl-3">
                            {children.map((c) => (
                              <SortableRow
                                key={c.id}
                                id={c.id}
                                parentId={todo.id}
                                card={renderCard(c)}
                              />
                            ))}
                          </ul>
                        </SortableContext>
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
                  </SortableRow>
                );
              })
            )}
          </ul>
        </SortableContext>

        {/* DragOverlay 默认不走 portal，渲染在它所在的位置 —— 与 <ul> 平级才不会被
            Collapsible 的 overflow:hidden 裁掉。它必须常驻挂载、只让内容随 activeId 变：
            整个卸载掉，放下时的下落动画就不会播。 */}
        <DragOverlay>
          {activeTodo ? (
            <div className="pointer-events-none">
              {/* `drag-lift`（放大 + 上移 + 阴影）**必须挂在每个框自己身上，不能挂在这层外壳上**：
                  外壳把卡片之间的空隙也包进去，阴影会从缝里透出来连成一整块，看着像一块大白板
                  浮起来，而不是几个框浮起来。
                  子任务那一份不带列表里的缩进和左边那条蓝线（`border-l-2 border-blue-100`）——
                  那是列表的装饰，跟着浮起来就露馅了。本来就收起的合集不带这一份子任务。 */}
              <div className="drag-lift">{renderCard(activeTodo)}</div>
              {!collapsedIds.has(activeTodo.id) &&
                overlayChildren.length > 0 && (
                  <OverlayFolded>
                    <ul className="mt-2 space-y-2">
                      {overlayChildren.map((c) => (
                        <li key={c.id} className="drag-lift">
                          {renderCard(c)}
                        </li>
                      ))}
                    </ul>
                  </OverlayFolded>
                )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
