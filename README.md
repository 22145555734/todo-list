# 待办事项（学习计时版）

一个基于 React 的待办事项应用，支持按事项独立计时、学习统计图表，以及游戏化的等级与称号系统。数据保存在浏览器 localStorage，关闭后重开仍会保留。

## 功能

- **待办管理**：添加 / 编辑 / 删除 / 完成，按「全部 / 进行中 / 已完成」筛选，一键清除已完成。
- **独立计时**：每个事项可单独开始 / 暂停计时，记录在该领域投入的总时长，跨会话持久化。
- **学习统计**：柱状图展示每天 / 每周 / 每月各科目的独立时长与学习总时长，支持近 7 天 / 14 天 / 30 天 / 3 个月 / 一年及自定义日期范围。
- **等级与称号**：每个事项独立升级，共 500 级、累计 500 小时，进度条实时显示到下一级还需多久。

## 技术栈

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS 4
- Vitest 2 + @testing-library/react

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（默认 http://localhost:5173）
npm run build     # 类型检查 + 构建
npm test          # 运行测试
```

Windows 下可直接双击 `start-todolist.bat` 一键启动并打开浏览器。

## 目录结构

```
src/
├── store.tsx      # 全局状态（todos + 计时会话），localStorage 持久化
├── time.ts        # 时间分桶、统计聚合与格式化
├── level.ts       # 等级 / 称号系统（500 级，等差数列）
├── Stats.tsx      # 统计页（SVG 堆叠柱状图 + KPI + 图例 + 表格）
├── TodoList.tsx   # 待办列表（计时 + 等级进度条）
└── App.tsx        # 标签页导航（待办事项 / 学习统计）
```

## 数据存储

- `todo-list`：待办事项列表
- `todo-time-sessions`：计时会话记录（用于统计与升级）
