import type { Todo } from "./types";

/**
 * 同父兄弟在当前数组里的 id 顺序。
 *
 * `todos` 是根与子任务混在一起的**扁平**数组，但渲染顺序完全由数组顺序决定
 * （`roots` 靠 filter、`childrenByParent` 靠 push），所以 filter 出来的顺序就是屏幕顺序。
 */
export function siblingIds(todos: Todo[], parentId: string | null): string[] {
  return todos.filter((t) => t.parentId === parentId).map((t) => t.id);
}

/**
 * 把 `parentId` 这一组的内部顺序换成 `orderedIds`；**其它元素的位置与顺序完全不动**。
 *
 * 为什么是「槽位回填」而不是 `sort`：要按另一张表重排一个子集，比较器里必然混进非本组元素，
 * 那不是合法的偏序，`Array.prototype.sort` 对它的结果各引擎不保证一致。
 *
 * `orderedIds` 少列了谁（本地刚加、或另一台设备刚建的），谁就按原相对顺序留在本组末尾；
 * 多列了不在本组的 id 会被忽略。给重复 id 时长度对不上，整体放弃改动 —— 宁可不动，也不要排出一个残次顺序。
 */
export function applyGroupOrder(
  todos: Todo[],
  parentId: string | null,
  orderedIds: string[],
): Todo[] {
  const slots: number[] = [];
  const group: Todo[] = [];
  todos.forEach((t, i) => {
    if (t.parentId === parentId) {
      slots.push(i);
      group.push(t);
    }
  });
  if (group.length === 0) return todos;

  const byId = new Map(group.map((t) => [t.id, t]));
  const next: Todo[] = [];
  for (const id of orderedIds) {
    const t = byId.get(id);
    if (t) next.push(t);
  }
  const placed = new Set(next.map((t) => t.id));
  for (const t of group) {
    if (!placed.has(t.id)) next.push(t);
  }
  if (next.length !== group.length) return todos;

  const out = todos.slice();
  slots.forEach((slot, i) => {
    out[slot] = next[i];
  });
  return out;
}
