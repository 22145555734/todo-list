export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  /** 所属合集 id；null 表示顶层事项。只允许一层嵌套 */
  parentId: string | null;
}

export interface TimeSession {
  id: string;
  todoId: string;
  /** 开始计时时快照的事项名称，用于统计页按科目聚合 */
  subject: string;
  /** 开始计时时快照的所属合集名称；null 表示不属于任何合集（统计页合并视图据此归并） */
  rootSubject: string | null;
  /** 开始时间戳（毫秒） */
  start: number;
  /** 结束时间戳（毫秒），null 表示仍在计时 */
  end: number | null;
}
