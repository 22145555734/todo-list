import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stats from "./Stats";
import { StoreProvider } from "./store";
import { __seed } from "./api";
import type { TimeSession } from "./types";

// jsdom 没有 ResizeObserver，Stats 的宽度观察需要它
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverMock;

vi.mock("./api", () => {
  let sessions: TimeSession[] = [];
  return {
    api: {
      listTodos: vi.fn(async () => []),
      listSessions: vi.fn(async () => sessions),
    },
    __seed: (_todos: unknown, seededSessions: TimeSession[]) => {
      sessions = seededSessions;
    },
  };
});

const todayAt = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

const dayKey = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const session = (
  id: string,
  subject: string,
  start: number,
  end: number | null,
): TimeSession => ({
  id,
  todoId: `todo-${id}`,
  subject,
  rootSubject: null,
  start,
  end,
});

beforeEach(() => {
  localStorage.clear();
});

test("默认展开今天，显示时间段、事项与时长", async () => {
  const start = todayAt(9, 30);
  __seed([], [session("s1", "数学", start, start + 45 * 60_000)]);
  localStorage.setItem("todo-token", "test-token");

  render(
    <StoreProvider>
      <Stats />
    </StoreProvider>,
  );

  // “数学”在图表、表格里也会出现，这里只取时间明细里的那一行
  const row = (await screen.findAllByText("数学"))
    .map((el) => el.closest("li"))
    .find((el) => el !== null);
  expect(row).toBeTruthy();
  expect(within(row!).getByText(/09:30/)).toBeInTheDocument();
  expect(within(row!).getByText("45分")).toBeInTheDocument();
});

test("点击日期标题可收起明细", async () => {
  const user = userEvent.setup();
  const start = todayAt(9, 30);
  __seed([], [session("s1", "数学", start, start + 45 * 60_000)]);
  localStorage.setItem("todo-token", "test-token");

  render(
    <StoreProvider>
      <Stats />
    </StoreProvider>,
  );

  await screen.findAllByText("数学");
  expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);

  await user.click(
    screen.getByRole("button", { name: new RegExp(dayKey(start)) }),
  );
  // 收起后时间明细的条目全部消失（图表与表格里的“数学”不受影响）
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});
