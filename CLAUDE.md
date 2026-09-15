# Todo List（学习计时版）

React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 4 的待办事项应用，带按事项独立计时、学习统计与等级称号系统。

## 常用命令

- `npm run dev` — 启动开发服务器（Vite，默认 5173）
- `npm run build` — 类型检查 + 构建（`tsc && vite build`）
- `npm test` — 运行 Vitest（`vitest run`）
- `npm run test:watch` — 监听模式测试

## 目录结构

- `src/store.tsx` — 全局状态（todos + 计时会话），localStorage 持久化（键 `todo-list`、`todo-time-sessions`）
- `src/time.ts` — 时间分桶（day/week/month）、统计聚合、格式化
- `src/level.ts` — 等级/称号系统（500 级、累计 500 小时、等差数列）
- `src/Stats.tsx` — 统计页（SVG 堆叠柱状图 + KPI + 图例 + 表格）
- `src/TodoList.tsx` — 待办列表（计时 + 等级进度条）
- `src/App.tsx` — 标签页导航（待办事项 / 学习统计）

## 分支约定

- 开发在 `YinnnH_feature` 分支进行，推 PR 到 `main`。
- `main` 跟踪 `origin/main`。
