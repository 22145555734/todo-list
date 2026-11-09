/**
 * todo-sync 的公共部分：配置文件、登录、API 调用。
 *
 * P0（import-plan.mjs）和 P1（考研计划侧的时长回写）共用这一份，
 * 避免两边各写一套登录逻辑。零依赖，Node 18+ 的内置 fetch 即可。
 *
 * 配置文件刻意放在考研计划目录下、不在任何 git 仓库里：
 * 里面有 token，属于凭据，不能进仓库，也不能落在会被提交的路径上。
 */
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

// 三个环境变量只为本机测试留的口子，正常使用走默认值
export const CONFIG_PATH =
  process.env.TODO_SYNC_CONFIG || "E:\\考研\\plan\\todo-sync.config.json";

const DEFAULTS = {
  baseUrl: process.env.TODO_SYNC_BASE_URL || "http://47.106.200.121:8310",
  planDaysPath:
    process.env.TODO_SYNC_PLAN_DAYS ||
    "E:\\考研\\2028软微AI\\工具\\plan_days.json",
  /** 计划里的科目名 -> todolist 里根合集的文字，合集叫法不同时改这里 */
  roots: { 数学: "数学", 408: "408", 英语: "英语", 政治: "政治" },
  /** 每个合集下那条常驻子任务的文字 */
  dailyTaskLabel: "今日计划",
};

export async function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return { ...DEFAULTS, ...saved };
}

export async function saveConfig(cfg) {
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** 读一行；secret=true 时不回显（密码用） */
export function ask(question, { secret = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  if (!secret) {
    return rl.question(question).finally(() => rl.close());
  }
  // 关掉回显再问，问完恢复
  const out = rl._writeToOutput;
  rl._writeToOutput = function (chunk) {
    if (chunk.includes(question)) out.call(rl, chunk);
  };
  return rl.question(question).finally(() => {
    rl._writeToOutput = out;
    rl.close();
    process.stdout.write("\n");
  });
}

export async function login(cfg, username, password) {
  const res = await fetch(`${cfg.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`登录失败 (${res.status})：${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.token, username: data.username };
}

/** 调后端；401 一律提示重新登录，不在这里自动重试 */
export async function api(cfg, path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const res = await fetch(`${cfg.baseUrl}/api${path}`, { ...options, headers });
  if (res.status === 401) {
    throw new Error("登录已失效，请重新运行 login 子命令");
  }
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} 失败 (${res.status})：${await res.text()}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

/** 本地日期键，形如 2026-11-09（用本机时区，和前端归属口径一致） */
export function dateKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
