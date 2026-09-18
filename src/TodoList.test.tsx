import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoList from "./TodoList";
import { StoreProvider } from "./store";
import { __reset } from "./api";
import type { TimeSession, Todo } from "./types";

vi.mock("./api", () => {
  let todos: Todo[] = [];
  let sessions: TimeSession[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  const api = {
    register: vi.fn(),
    login: vi.fn(),
    listTodos: vi.fn(async () => todos),
    createTodo: vi.fn(async (text: string, parentId: string | null = null) => {
      const todo: Todo = { id: nextId("todo"), text, completed: false, parentId };
      todos = [...todos, todo];
      return todo;
    }),
    updateTodo: vi.fn(
      async (id: string, patch: { text?: string; completed?: boolean }) => {
        const updated = { ...todos.find((t) => t.id === id)!, ...patch };
        todos = todos.map((t) => (t.id === id ? updated : t));
        return updated;
      },
    ),
    // 与后端一致：删合集会级联删掉它的子任务
    deleteTodo: vi.fn(async (id: string) => {
      todos = todos.filter((t) => t.id !== id && t.parentId !== id);
    }),
    clearCompleted: vi.fn(async () => {
      const completedIds = new Set(
        todos.filter((t) => t.completed).map((t) => t.id),
      );
      todos = todos.filter(
        (t) =>
          !t.completed &&
          !(t.parentId !== null && completedIds.has(t.parentId)),
      );
    }),
    listSessions: vi.fn(async () => sessions),
    startTimer: vi.fn(async (id: string, start: number) => {
      sessions = sessions.map((s) =>
        s.end === null ? { ...s, end: start } : s,
      );
      const todo = todos.find((t) => t.id === id);
      const session: TimeSession = {
        id: nextId("session"),
        todoId: id,
        subject: todo?.text ?? "",
        rootSubject: todo?.parentId
          ? (todos.find((t) => t.id === todo.parentId)?.text ?? null)
          : null,
        start,
        end: null,
      };
      sessions = [...sessions, session];
      return session;
    }),
    pauseTimer: vi.fn(async (id: string, end: number) => {
      sessions = sessions.map((s) =>
        s.end === null && s.todoId === id ? { ...s, end } : s,
      );
    }),
    adoptTime: vi.fn(async (containerId: string, targetId: string) => {
      const container = todos.find((t) => t.id === containerId);
      const target = todos.find((t) => t.id === targetId);
      sessions = sessions.map((s) =>
        s.todoId === containerId
          ? {
              ...s,
              todoId: targetId,
              subject: target?.text ?? "",
              rootSubject: container?.text ?? null,
            }
          : s,
      );
    }),
  };

  return {
    api,
    __reset: () => {
      todos = [];
      sessions = [];
      seq = 0;
    },
  };
});

function renderTodoList() {
  return render(
    <StoreProvider>
      <TodoList />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  __reset();
});

test("添加任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "学习 React{enter}");

  expect(await screen.findByText("学习 React")).toBeInTheDocument();
});

test("切换完成状态", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务一{enter}");
  expect(await screen.findByText("任务一")).toBeInTheDocument();

  await user.click(screen.getByRole("checkbox"));

  await waitFor(() =>
    expect(screen.getByText("任务一")).toHaveClass("line-through"),
  );
});

test("点删除只弹确认框，确认后才真删", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务{enter}");
  expect(await screen.findByText("任务")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "删除任务" }));

  // 弹窗已弹出，但此时事项还在
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByText("删除后不可恢复。")).toBeInTheDocument();
  expect(screen.getByText("任务")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() =>
    expect(screen.queryByText("任务")).not.toBeInTheDocument(),
  );
});

test("确认框点取消则不删除", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务{enter}");
  expect(await screen.findByText("任务")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "删除任务" }));
  await user.click(screen.getByRole("button", { name: "取消" }));

  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("任务")).toBeInTheDocument();
});

test("编辑任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "旧文本{enter}");
  expect(await screen.findByText("旧文本")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "编辑任务" }));

  const editInput = screen.getByDisplayValue("旧文本");
  await user.clear(editInput);
  await user.type(editInput, "新文本{enter}");

  expect(await screen.findByText("新文本")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText("旧文本")).not.toBeInTheDocument(),
  );
});

test("筛选功能", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "进行中的任务{enter}");
  await user.type(screen.getByPlaceholderText("添加新任务..."), "已完成的任务{enter}");
  expect(await screen.findByText("已完成的任务")).toBeInTheDocument();

  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[1]); // 勾选第二项
  await waitFor(() =>
    expect(screen.getByText("已完成的任务")).toHaveClass("line-through"),
  );

  await user.click(screen.getByRole("button", { name: "进行中" }));
  expect(screen.getByText("进行中的任务")).toBeInTheDocument();
  expect(screen.queryByText("已完成的任务")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "已完成" }));
  expect(screen.getByText("已完成的任务")).toBeInTheDocument();
  expect(screen.queryByText("进行中的任务")).not.toBeInTheDocument();
});

test("清除已完成", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "保留项{enter}");
  await user.type(screen.getByPlaceholderText("添加新任务..."), "完成项{enter}");
  expect(await screen.findByText("完成项")).toBeInTheDocument();

  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[1]);
  await waitFor(() =>
    expect(screen.getByText("完成项")).toHaveClass("line-through"),
  );

  await user.click(screen.getByRole("button", { name: "清除已完成" }));

  await waitFor(() =>
    expect(screen.queryByText("完成项")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("保留项")).toBeInTheDocument();
});

test("开始计时", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "数学{enter}");
  expect(await screen.findByText("数学")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "开始计时" }));

  expect(await screen.findByRole("button", { name: "暂停" })).toBeInTheDocument();
});

test("暂停计时", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "英语{enter}");
  expect(await screen.findByText("英语")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "开始计时" }));
  await screen.findByRole("button", { name: "暂停" });

  await user.click(screen.getByRole("button", { name: "暂停" }));

  expect(
    await screen.findByRole("button", { name: "开始计时" }),
  ).toBeInTheDocument();
});

/** 建一个合集「408」，内含子任务「操作系统」 */
async function makeContainer(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.type(screen.getByPlaceholderText("添加新任务..."), "408{enter}");
  expect(await screen.findByText("408")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "添加子任务" }));
  await user.type(screen.getByPlaceholderText("添加子任务..."), "操作系统{enter}");
  expect(await screen.findByText("操作系统")).toBeInTheDocument();
}

test("加了子任务的事项变成合集，自身不再有计时功能", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "408{enter}");
  // 未加子任务前和普通事项一样可以计时
  expect(await screen.findByRole("button", { name: "开始计时" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "添加子任务" }));
  await user.type(screen.getByPlaceholderText("添加子任务..."), "操作系统{enter}");
  expect(await screen.findByText("操作系统")).toBeInTheDocument();

  // 计时按钮只剩子任务那一个
  const timerButtons = await screen.findAllByRole("button", {
    name: "开始计时",
  });
  expect(timerButtons).toHaveLength(1);
  expect(screen.getByText("1 个子任务")).toBeInTheDocument();
});

test("子任务没有等级系统，合集保留等级", async () => {
  const user = userEvent.setup();
  renderTodoList();
  await makeContainer(user);

  // 只有合集有等级卡片，子任务没有
  expect(screen.getAllByText("Lv.1")).toHaveLength(1);
});

test("子任务可收起 / 展开，默认展开", async () => {
  const user = userEvent.setup();
  renderTodoList();
  await makeContainer(user);

  expect(screen.getByText("操作系统")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "收起" }));

  // 子任务收起有退出动画，等它结束（visibility 隐藏）后再断言消失
  await waitFor(() =>
    expect(screen.queryByText("操作系统")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("408")).toBeInTheDocument();
  expect(screen.getByText("1 个子任务")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "展开" }));
  expect(screen.getByText("操作系统")).toBeInTheDocument();
});

test("收起状态下点「+ 子任务」会自动展开", async () => {
  const user = userEvent.setup();
  renderTodoList();
  await makeContainer(user);

  await user.click(screen.getByRole("button", { name: "收起" }));
  await waitFor(() =>
    expect(screen.queryByText("操作系统")).not.toBeInTheDocument(),
  );

  // 不自动展开的话，刚加的子任务会看不见
  await user.click(screen.getByRole("button", { name: "添加子任务" }));
  expect(screen.getByText("操作系统")).toBeInTheDocument();
});

test("删除合集会连子任务一起删掉", async () => {
  const user = userEvent.setup();
  renderTodoList();
  await makeContainer(user);

  // 第一个删除按钮属于合集本身（合集渲染在子任务之前）
  await user.click(screen.getAllByRole("button", { name: "删除任务" })[0]);

  expect(screen.getByRole("alertdialog")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() =>
    expect(screen.queryByText("408")).not.toBeInTheDocument(),
  );
  expect(screen.queryByText("操作系统")).not.toBeInTheDocument();
});

test("加子任务时提示迁移合集已有的计时", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "408{enter}");
  expect(await screen.findByText("408")).toBeInTheDocument();

  // 先攒一点时长，再把它变成合集
  await user.click(screen.getByRole("button", { name: "开始计时" }));
  await screen.findByRole("button", { name: "暂停" });
  await new Promise((r) => setTimeout(r, 20));
  await user.click(screen.getByRole("button", { name: "暂停" }));

  await user.click(await screen.findByRole("button", { name: "添加子任务" }));
  await user.type(screen.getByPlaceholderText("添加子任务..."), "操作系统{enter}");
  // 子任务本身与迁移提示的按钮同名，故用 findAllByText
  expect(await screen.findAllByText("操作系统")).not.toHaveLength(0);

  expect(await screen.findByText("暂不迁移")).toBeInTheDocument();

  await user.click(screen.getByText("暂不迁移"));
  await waitFor(() =>
    expect(screen.queryByText("暂不迁移")).not.toBeInTheDocument(),
  );
});
