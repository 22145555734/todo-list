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
    createTodo: vi.fn(async (text: string) => {
      const todo = { id: nextId("todo"), text, completed: false };
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
    deleteTodo: vi.fn(async (id: string) => {
      todos = todos.filter((t) => t.id !== id);
    }),
    clearCompleted: vi.fn(async () => {
      todos = todos.filter((t) => !t.completed);
    }),
    listSessions: vi.fn(async () => sessions),
    startTimer: vi.fn(async (id: string, start: number) => {
      sessions = sessions.map((s) =>
        s.end === null ? { ...s, end: start } : s,
      );
      const session: TimeSession = {
        id: nextId("session"),
        todoId: id,
        subject: todos.find((t) => t.id === id)?.text ?? "",
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
    resetTime: vi.fn(async (id: string) => {
      sessions = sessions.filter((s) => s.todoId !== id);
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

test("删除任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务{enter}");
  expect(await screen.findByText("任务")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "删除任务" }));

  await waitFor(() =>
    expect(screen.queryByText("任务")).not.toBeInTheDocument(),
  );
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
  // 有累计时长后出现清零按钮
  expect(
    await screen.findByRole("button", { name: "清零计时" }),
  ).toBeInTheDocument();
});
