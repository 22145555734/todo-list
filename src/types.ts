export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimeSession {
  id: string;
  todoId: string;
  /** 开始计时时快照的事项名称，用于统计页按科目聚合 */
  subject: string;
  /** 开始时间戳（毫秒） */
  start: number;
  /** 结束时间戳（毫秒），null 表示仍在计时 */
  end: number | null;
}
