#!/usr/bin/env node
/**
 * P0：把考研计划当天的任务同步进 todolist。
 *
 * 数据源：E:\考研\2028软微AI\工具\plan_days.json（由考研计划那边维护，schemaVersion=1）
 * 做法：每个科目根合集下只保留一条常驻子任务「科目：短标题」，每天更新文字与预算
 *       （预算 = 计划里的 minutes，planDate 跟着换天 → 预算每天归零）。
 *       换天以 planDate 为准，凌晨 4 点前仍算前一天；同一天重跑不会把已勾选的又清掉。
 *
 * 用法：
 *   node tools/todo-sync/import-plan.mjs login        首次登录，token 存进配置文件
 *   node tools/todo-sync/import-plan.mjs              同步今天
 *   node tools/todo-sync/import-plan.mjs --date 2026-11-10
 *   node tools/todo-sync/import-plan.mjs --dry-run    只打印要做什么，不发请求
 */
import { readFile } from "node:fs/promises";
import {
  CONFIG_PATH, ask, api, loadConfig, login, saveConfig, studyDateKey,
} from "./lib.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? "";
};
const has = (name) => argv.includes(name);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * 任务名用「科目：短标题」—— 列表里一行放得下。
 *
 * 计划正文往往是「本周目标（第2/5天）：高数第1章 ...：李擂基础课 2-3 节 + ...」这种
 * 上百字的长句，整段塞进任务名会把列表撑成好几行。这里去掉「本周目标（第x/5天）：」
 * 这类前缀，再取第一个分句（「：」或「；」之前）。细节留在计划总台看。
 */
function shortTitle(text) {
  const body = text.replace(/^[^：]*?（第\d+\/\d+天）：/, "").trim();
  const cut = body.search(/[：；]/);
  const head = (cut === -1 ? body : body.slice(0, cut)).trim();
  const s = head.length >= 2 ? head : body;
  return s.length > 30 ? `${s.slice(0, 30)}…` : s;
}

async function doLogin(cfg) {
  const username = flag("--user") || (await ask("用户名: "));
  const password = await ask("密码（不回显）: ", { secret: true });
  const r = await login(cfg, username.trim(), password);
  await saveConfig({ ...cfg, username: r.username, token: r.token });
  console.log(`已登录 ${r.username}，token 写入 ${CONFIG_PATH}`);
}

async function main() {
  const cfg = await loadConfig();

  if (argv[0] === "login") {
    await doLogin(cfg);
    return;
  }

  if (!cfg.token) {
    die("还没有登录，先运行：node tools/todo-sync/import-plan.mjs login");
  }

  const plan = JSON.parse(await readFile(cfg.planDaysPath, "utf8"));
  if (plan.schemaVersion !== 1) {
    die(`plan_days.json 的 schemaVersion 是 ${plan.schemaVersion}，本脚本只支持 1`);
  }

  // 默认按**学习日**取日期：凌晨 0–4 点跑仍算前一天，别把还没过完的那一晚切走
  const date = flag("--date") || studyDateKey(Date.now());
  const day = plan.days.find((d) => d.date === date);
  if (!day) {
    die(`plan_days.json 里没有 ${date} 这一天`);
  }

  const active = day.subjects.filter((s) => s.active);
  if (active.length === 0) {
    console.log(`${date} 没有计划任务（考试日或休息日），未做改动`);
    return;
  }

  const dry = has("--dry-run");
  const todos = await api(cfg, "/todos");

  const findRoot = (name) =>
    todos.find((t) => t.parentId === null && t.text === name);

  for (const subject of active) {
    const rootName = cfg.roots[subject.name] ?? subject.name;
    let root = findRoot(rootName);
    if (!root) {
      if (dry) {
        console.log(`[dry] 新建根合集「${rootName}」`);
        root = { id: `<new:${rootName}>`, parentId: null, text: rootName };
      } else {
        root = await api(cfg, "/todos", {
          method: "POST",
          body: JSON.stringify({ text: rootName, parentId: null }),
        });
        todos.push(root);
        console.log(`新建根合集「${rootName}」`);
      }
    }

    const label = cfg.dailyTaskLabel;
    // 任务名：科目：短标题。不带日期 —— 换天靠 planDate 判断，名字里再塞日期只会更长
    const newText = `${rootName}：${shortTitle(subject.text)}`;
    // 预算取计划里的 minutes，每天随 planDate 重置
    const plannedMs = subject.minutes > 0 ? subject.minutes * 60000 : undefined;
    const budgetNote = plannedMs ? `${subject.minutes} 分` : "无预算";
    // 兼容旧格式「今日计划｜11-09｜…」，第一次跑会把它就地改名并补上预算
    const existing = todos.find(
      (t) =>
        t.parentId === root.id &&
        (t.text.startsWith(`${label}｜`) || t.text.startsWith(`${rootName}：`)),
    );

    if (!existing) {
      if (dry) {
        console.log(`[dry] 在「${rootName}」下新建「${newText}」（预算 ${budgetNote}）`);
      } else {
        const created = await api(cfg, "/todos", {
          method: "POST",
          body: JSON.stringify({
            text: newText, parentId: root.id, plannedMs, planDate: date,
          }),
        });
        todos.push(created);
        console.log(`「${rootName}」新建：${newText}（预算 ${budgetNote}）`);
      }
      continue;
    }

    // 换天以 planDate 为准：老数据没有 planDate，第一次跑会被当成「新的一天」
    const sameDay = existing.planDate === date;
    const patch = {};
    if (existing.text !== newText) patch.text = newText;
    // 换了一天就重置勾选、换归属日（预算随之归零）；同一天重跑保留已勾状态
    if (!sameDay) {
      patch.completed = false;
      patch.planDate = date;
    }
    if (plannedMs && existing.plannedMs !== plannedMs) patch.plannedMs = plannedMs;
    if (Object.keys(patch).length === 0) {
      console.log(`「${rootName}」已是最新：${newText}（预算 ${budgetNote}）`);
      continue;
    }

    if (dry) {
      console.log(
        `[dry] 更新「${rootName}」：${existing.text} -> ${newText}（预算 ${budgetNote}）` +
          (sameDay ? "（同一天，保留勾选）" : "（新的一天，重置勾选）"),
      );
    } else {
      const updated = await api(cfg, `/todos/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      Object.assign(existing, updated);
      console.log(
        `「${rootName}」更新：${newText}（预算 ${budgetNote}）` +
          (sameDay ? "" : "（已重置勾选）"),
      );
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
