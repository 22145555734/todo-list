import { formatClock, groupSessionsByDay } from "./time";
import type { TimeSession } from "./types";

/** 本地时间构造时间戳，避免测试受时区影响 */
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 10, day, hour, minute).getTime();

const s = (
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

describe("formatClock", () => {
  test("补零到 HH:mm", () => {
    expect(formatClock(at(8, 9, 5))).toBe("09:05");
    expect(formatClock(at(8, 14, 40))).toBe("14:40");
  });
});

describe("groupSessionsByDay", () => {
  const now = at(8, 18, 0);

  test("按日期分组，日期倒序、天内按开始时间升序", () => {
    const sessions = [
      s("b", "英语", at(7, 14, 0), at(7, 14, 30)),
      s("a", "数学", at(7, 9, 0), at(7, 9, 45)),
      s("c", "语文", at(8, 10, 0), at(8, 10, 20)),
    ];
    const groups = groupSessionsByDay(sessions, now, "2026-11-07", "2026-11-08");

    expect(groups.map((g) => g.key)).toEqual(["2026-11-08", "2026-11-07"]);
    expect(groups[1].sessions.map((x) => x.id)).toEqual(["a", "b"]);
    expect(groups[1].totalMs).toBe(45 * 60_000 + 30 * 60_000);
  });

  test("范围外的会话被排除，结束日当天整天都算在内", () => {
    const sessions = [
      s("out", "范围外", at(6, 10, 0), at(6, 11, 0)),
      s("late", "深夜", at(8, 23, 59), at(9, 0, 30)),
    ];
    const groups = groupSessionsByDay(sessions, now, "2026-11-07", "2026-11-08");

    expect(groups.map((g) => g.key)).toEqual(["2026-11-08"]);
    expect(groups[0].sessions.map((x) => x.id)).toEqual(["late"]);
  });

  test("进行中的会话按 now 计时长", () => {
    const groups = groupSessionsByDay(
      [s("run", "背单词", at(8, 17, 0), null)],
      now,
      "2026-11-08",
      "2026-11-08",
    );

    expect(groups[0].totalMs).toBe(60 * 60_000);
  });

  test("跨午夜的会话归入开始那天，不拆分", () => {
    const groups = groupSessionsByDay(
      [s("cross", "通宵", at(8, 23, 30), at(9, 0, 30))],
      now,
      "2026-11-08",
      "2026-11-09",
    );

    expect(groups.map((g) => g.key)).toEqual(["2026-11-08"]);
    expect(groups[0].totalMs).toBe(60 * 60_000);
  });

  test("没有会话时返回空数组", () => {
    expect(groupSessionsByDay([], now, "2026-11-08", "2026-11-08")).toEqual([]);
  });
});
