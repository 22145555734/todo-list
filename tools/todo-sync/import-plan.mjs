#!/usr/bin/env node
/**
 * P0：把考研计划当天的任务同步进 todolist。
 *
 * 数据源：E:\考研\2028软微AI\工具\plan_days.json（由考研计划那边维护，schemaVersion=1）
 * 做法：每个科目根合集下只保留一条常驻子任务「今日计划」，每天更新它的文字；
 *       日期前缀变了才重置 completed —— 同一天重跑不会把已勾选的又清掉。
 *
 * 用法：
 *   node tools/todo-sync/import-plan.mjs login        首次登录，token 存进配置文件
 *   node tools/todo-sync/import-plan.mjs              同步今天
 *   node tools/todo-sync/import-plan.mjs --date 2026-11-10
 *   node tools/todo-sync/import-plan.mjs --dry-run    只打印要做什么，不发请求
 */
import { readFile } from "node:fs/promises";
import {
  CONFIG_PATH, ask, api, dateKey, loadConfig, login, saveConfig,
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

  const date = flag("--date") || dateKey(Date.now());
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
  const mmdd = date.slice(5);
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
    // 格式固定为「今日计划｜11-09｜正文」，前两段用来定位和判断是否换天
    const newText = `${label}｜${mmdd}｜${subject.text}`;
    const existing = todos.find(
      (t) => t.parentId === root.id && t.text.startsWith(`${label}｜`),
    );

    if (!existing) {
      if (dry) {
        console.log(`[dry] 在「${rootName}」下新建「${newText}」`);
      } else {
        const created = await api(cfg, "/todos", {
          method: "POST",
          body: JSON.stringify({ text: newText, parentId: root.id }),
        });
        todos.push(created);
        console.log(`「${rootName}」新建：${newText}`);
      }
      continue;
    }

    // 只认「今日计划｜日期」这两段，正文每天都变
    const sameDay = existing.text.startsWith(`${label}｜${mmdd}｜`);
    const patch = {};
    if (existing.text !== newText) patch.text = newText;
    // 换了一天就重置勾选；同一天重跑保留用户已勾的状态
    if (!sameDay) patch.completed = false;
    if (Object.keys(patch).length === 0) {
      console.log(`「${rootName}」已是最新：${newText}`);
      continue;
    }

    if (dry) {
      console.log(
        `[dry] 更新「${rootName}」：${existing.text} -> ${newText}` +
          (sameDay ? "（同一天，保留勾选）" : "（新的一天，重置勾选）"),
      );
    } else {
      const updated = await api(cfg, `/todos/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      Object.assign(existing, updated);
      console.log(
        `「${rootName}」更新：${newText}` +
          (sameDay ? "" : "（已重置勾选）"),
      );
    }
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
