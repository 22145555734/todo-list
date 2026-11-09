export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  /** 所属父事项 id；null 表示顶层。可任意深度嵌套，只有叶子能计时 */
  parentId: string | null;
  /** 计划时长（毫秒）；null / 0 表示没有预算，计时走正计时 */
  plannedMs?: number | null;
  /** 归属日 yyyy-MM-dd；null 表示不按天归属（预算按这条任务累计） */
  planDate?: string | null;
}

export interface TimeSession {
  id: string;
  todoId: string;
  /** 开始计时时快照的事项名称，用于统计页按科目聚合 */
  subject: string;
  /** 开始计时时快照的所属合集名称；null 表示不属于任何合集（统计页合并视图据此归并） */
  rootSubject: string | null;
  /** 开始计时时快照的完整祖先链，全角 ｜ 分隔；顶层事项为 null */
  path?: string | null;
  /** 开始计时时快照的预算（毫秒）；null 表示这条会话没有预算 */
  plannedMs?: number | null;
  /** 开始计时时快照的归属日 */
  planDate?: string | null;
  /** 开始时间戳（毫秒） */
  start: number;
  /** 结束时间戳（毫秒），null 表示仍在计时 */
  end: number | null;
}
