import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoList from "./TodoList";
import { StoreProvider } from "./store";

function renderTodoList() {
  return render(
    <StoreProvider>
      <TodoList />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

test("添加任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "学习 React{enter}");

  expect(screen.getByText("学习 React")).toBeInTheDocument();
});

test("切换完成状态", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务一{enter}");
  await user.click(screen.getByRole("checkbox"));

  expect(screen.getByText("任务一")).toHaveClass("line-through");
});

test("删除任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "任务{enter}");
  await user.click(screen.getByRole("button", { name: "删除任务" }));

  expect(screen.queryByText("任务")).not.toBeInTheDocument();
});

test("编辑任务", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "旧文本{enter}");
  await user.click(screen.getByRole("button", { name: "编辑任务" }));

  const editInput = screen.getByDisplayValue("旧文本");
  await user.clear(editInput);
  await user.type(editInput, "新文本{enter}");

  expect(screen.getByText("新文本")).toBeInTheDocument();
  expect(screen.queryByText("旧文本")).not.toBeInTheDocument();
});

test("筛选功能", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "进行中的任务{enter}");
  await user.type(screen.getByPlaceholderText("添加新任务..."), "已完成的任务{enter}");

  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[1]); // 勾选第二项

  await user.click(screen.getByRole("button", { name: "进行中" }));
  expect(screen.getByText("进行中的任务")).toBeInTheDocument();
  expect(screen.queryByText("已完成的任务")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "已完成" }));
  expect(screen.getByText("已完成的任务")).toBeInTheDocument();
  expect(screen.queryByText("进行中的任务")).not.toBeInTheDocument();
});

test("持久化到 localStorage", async () => {
  const user = userEvent.setup();
  const { unmount } = renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "持久化{enter}");
  expect(localStorage.getItem("todo-list")).toContain("持久化");

  unmount();
  renderTodoList();
  expect(screen.getByText("持久化")).toBeInTheDocument();
});

test("开始计时并持久化会话", async () => {
  const user = userEvent.setup();
  renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "数学{enter}");
  await user.click(screen.getByRole("button", { name: "开始计时" }));

  expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
  expect(localStorage.getItem("todo-time-sessions")).toContain("数学");
});

test("暂停计时写入结束时间", async () => {
  const user = userEvent.setup();
  const { unmount } = renderTodoList();

  await user.type(screen.getByPlaceholderText("添加新任务..."), "英语{enter}");
  await user.click(screen.getByRole("button", { name: "开始计时" }));
  await user.click(screen.getByRole("button", { name: "暂停" }));

  const sessions = JSON.parse(
    localStorage.getItem("todo-time-sessions") ?? "[]",
  ) as { end: number | null }[];
  expect(sessions).toHaveLength(1);
  expect(sessions[0].end).not.toBeNull();

  // 重新打开后记录仍在
  unmount();
  renderTodoList();
  expect(screen.getByRole("button", { name: "开始计时" })).toBeInTheDocument();
  expect(localStorage.getItem("todo-time-sessions")).toContain("英语");
});
