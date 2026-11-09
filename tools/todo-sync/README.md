# todo-sync

把考研计划的每日任务同步进 todolist，并在科目合集下计时。

数据源是考研计划目录里导出好的 `plan_days.json`（`schemaVersion: 1`），
由考研计划那边维护；本目录的脚本只读它，不碰原始的 CSV / 生成脚本。

## 用法

```bash
# 首次（或 token 失效后）：登录一次，token 存进本地配置
node tools/todo-sync/import-plan.mjs login

# 同步今天
node tools/todo-sync/import-plan.mjs

# 指定日期 / 只看要做什么、不发请求
node tools/todo-sync/import-plan.mjs --date 2026-11-10
node tools/todo-sync/import-plan.mjs --dry-run
```

## 它做了什么

对当天 `active` 的每个科目：

1. 在 todolist 根级找到对应合集（`数学` / `408` / `英语` / `政治`），没有就建
2. 该合集下只保留**一条**常驻子任务，名字是 `科目：短标题`，例如
   `408：数据结构第1章 绪论 + 第2章 线性表`
   - 短标题 = 去掉 `本周目标（第x/5天）：` 前缀后，取第一个「：」或「；」之前的正文；
     太长再截到 30 字加省略号
3. 同时写入**预算**（计划里的 `minutes`，如数学 120 分）和 `planDate`（同步的那一天），
   前端据此显示倒计时；换天后 `planDate` 变了，预算自动从零开始算
4. 每天更新文字；**`planDate` 变了才重置勾选**，同一天重跑不会把已勾的又清掉
5. `active: false` 的科目完全不动（不建、不更新、不重置）

「哪一天」按**学习日**算：凌晨 4 点前跑仍归前一天（前沿用的是 `studyDateKey`），
和前端 `studyDayKey` 同一口径，凌晨学的时长不会被零点切走。

所以列表里永远只有 4 个合集 + 4 条「今日计划」，不会一年堆出 1600 条。
计时记录里的科目名是**开始计时那一刻的快照**，之后改文字不影响历史统计。

旧格式（`今日计划｜11-09｜正文`）会被就地改名成新格式并补上预算，不会另建一条。

## 配置

配置文件在 `E:\考研\plan\todo-sync.config.json`，**不在任何 git 仓库里**（里面有 token）。

```json
{
  "baseUrl": "http://47.106.200.121:8310",
  "planDaysPath": "E:\\考研\\2028软微AI\\工具\\plan_days.json",
  "username": "…",
  "token": "…",
  "roots": { "数学": "数学", "408": "408", "英语": "英语", "政治": "政治" },
  "dailyTaskLabel": "今日计划"
}
```

- `roots`：计划里的科目名 → todolist 里根合集的文字。合集叫法不一样时改这里，避免重复建。
- `dailyTaskLabel`：常驻子任务的文字前缀，改了会让脚本找不到旧的、另建一条。

## 环境变量（只为本机测试留的口子）

`TODO_SYNC_CONFIG` / `TODO_SYNC_BASE_URL` / `TODO_SYNC_PLAN_DAYS` 可以覆盖默认值，
用于指向假后端做回归测试，正常使用不需要设置。

## 给 P1 复用

`lib.mjs` 里的 `loadConfig` / `login` / `api` / `ask` / `dateKey` 是公共的，
考研计划侧写「实际时长 → 总台」的脚本时直接 import 这个文件，不要另写一套登录。
