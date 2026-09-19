import { applyGroupOrder, siblingIds } from "./reorder";
import type { Todo } from "./types";

const t = (id: string, parentId: string | null = null): Todo => ({
  id,
  text: id,
  completed: false,
  parentId,
});

describe("siblingIds", () => {
  test("只取同父的，且保持数组顺序", () => {
    const todos = [t("a"), t("p"), t("a1", "p"), t("b"), t("a2", "p")];
    expect(siblingIds(todos, null)).toEqual(["a", "p", "b"]);
    expect(siblingIds(todos, "p")).toEqual(["a1", "a2"]);
  });

  test("没有同父项时返回空数组", () => {
    expect(siblingIds([t("a")], "不存在")).toEqual([]);
    expect(siblingIds([], null)).toEqual([]);
  });
});

describe("applyGroupOrder", () => {
  test("重排顶层，其它元素的下标原样不动", () => {
    const todos = [t("a"), t("p"), t("a1", "p"), t("b"), t("c")];
    const out = applyGroupOrder(todos, null, ["c", "b", "a", "p"]);
    // 顶层四个槽位 (0,1,3,4) 被换成 c,b,a,p；a1 占的下标 2 根本不属于这一组，原样不动
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a1", "a", "p"]);
  });

  test("重排某个合集的子任务，顶层顺序不受影响", () => {
    const todos = [t("a"), t("p"), t("p1", "p"), t("p2", "p"), t("p3", "p"), t("b")];
    const out = applyGroupOrder(todos, "p", ["p3", "p1", "p2"]);
    expect(out.map((x) => x.id)).toEqual(["a", "p", "p3", "p1", "p2", "b"]);
  });

  test("orderedIds 没提到的组内成员，按原相对顺序留在本组末尾", () => {
    const todos = [t("a"), t("b"), t("c"), t("d")];
    const out = applyGroupOrder(todos, null, ["d", "b"]);
    expect(out.map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
  });

  test("orderedIds 里不属于本组的 id 被忽略", () => {
    const todos = [t("a"), t("b"), t("p"), t("p1", "p")];
    const out = applyGroupOrder(todos, null, ["b", "p1", "a", "p"]);
    // p1 不是顶层，被滤掉；顶层槽位 (0,1,2) 拿到 [b,a,p]，p1 待在下标 3
    expect(out.map((x) => x.id)).toEqual(["b", "a", "p", "p1"]);
  });

  test("重复 id 会让长度对不上，此时整体放弃改动", () => {
    const todos = [t("a"), t("b"), t("c")];
    const out = applyGroupOrder(todos, null, ["c", "c", "b", "a"]);
    expect(out).toBe(todos);
  });

  test("该分组为空时原样返回同一个引用", () => {
    const todos = [t("a")];
    expect(applyGroupOrder(todos, "不存在", ["x"])).toBe(todos);
  });

  test("不修改入参", () => {
    const todos = [t("a"), t("b")];
    const copy = todos.slice();
    applyGroupOrder(todos, null, ["b", "a"]);
    expect(todos).toEqual(copy);
  });
});
