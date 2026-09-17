import type { TimeSession } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地时区下某时间戳所属的日期键，形如 2026-09-15 */
export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 解析 yyyy-mm-dd 为本地零点 Date */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// —— 分桶（统计粒度） ——

export type Granularity = "day" | "week" | "month";

function mondayOf(d: Date): Date {
  const dow = (d.getDay() + 6) % 7; // 周一 = 0
  return addDays(d, -dow);
}

function monthKey(y: number, m: number): string {
  return `${y}-${pad(m + 1)}`;
}

/** 会话按其开始时间归属到对应粒度的桶键 */
export function bucketKeyFor(ts: number, unit: Granularity): string {
  if (unit === "week") return dateKey(mondayOf(new Date(ts)).getTime());
  if (unit === "month") {
    const d = new Date(ts);
    return monthKey(d.getFullYear(), d.getMonth());
  }
  return dateKey(ts);
}

export function shortBucketLabel(key: string, unit: Granularity): string {
  if (unit === "month") {
    const [, m] = key.split("-").map(Number);
    return `${m}月`;
  }
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
}

export function fullBucketLabel(key: string, unit: Granularity): string {
  const [y, m, d] = key.split("-").map(Number);
  if (unit === "month") return `${y}年${m}月`;
  if (unit === "week") {
    const start = parseKey(key);
    const end = addDays(start, 6);
    const endLabel =
      end.getFullYear() !== y
        ? `${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`
        : `${end.getMonth() + 1}月${end.getDate()}日`;
    return `${y}年${m}月${d}日–${endLabel}`;
  }
  return `${y}年${m}月${d}日`;
}

export interface BucketStat {
  key: string;
  /** 短标签（坐标轴/表头用） */
  label: string;
  /** 完整标签（tooltip 用） */
  fullLabel: string;
  totalMs: number;
  /** 科目名 -> 该桶时长（毫秒） */
  perSubject: Record<string, number>;
}

/** 生成覆盖 [startKey, endKey] 的所有桶（含空桶，保证轴连续） */
export function generateBuckets(
  startKey: string,
  endKey: string,
  unit: Granularity,
): BucketStat[] {
  const buckets: BucketStat[] = [];
  const push = (key: string) =>
    buckets.push({
      key,
      label: shortBucketLabel(key, unit),
      fullLabel: fullBucketLabel(key, unit),
      totalMs: 0,
      perSubject: {},
    });

  const start = parseKey(startKey);
  const end = parseKey(endKey);

  if (unit === "day") {
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      push(dateKey(d.getTime()));
    }
  } else if (unit === "week") {
    for (let d = mondayOf(start); d.getTime() <= end.getTime(); d = addDays(d, 7)) {
      push(dateKey(d.getTime()));
    }
  } else {
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      push(monthKey(y, m));
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }
  return buckets;
}

/** 会话的聚合键：合并视图下子集归并回所属合集，展开视图下按各自的事项名 */
export function aggregateKey(s: TimeSession, merge: boolean): string {
  return merge ? (s.rootSubject ?? s.subject) : s.subject;
}

/**
 * 按时间范围与粒度聚合会话。每个会话归属于其开始时刻所在的桶
 * （跨桶/跨午夜的极少数场景不拆分）。返回桶统计与全量科目列表（用于稳定配色）。
 *
 * merge=true 时子集时长并入所属合集（一个合集一根柱子）；
 * merge=false 时各子集独立成柱。
 */
export function buildStats(
  sessions: TimeSession[],
  now: number,
  startKey: string,
  endKey: string,
  unit: Granularity,
  merge: boolean,
): { buckets: BucketStat[]; allSubjects: string[] } {
  const allSubjects = Array.from(
    new Set(sessions.map((s) => aggregateKey(s, merge))),
  ).sort();
  const buckets = generateBuckets(startKey, endKey, unit);
  const idx = new Map(buckets.map((b, i) => [b.key, i]));

  for (const s of sessions) {
    const i = idx.get(bucketKeyFor(s.start, unit));
    if (i === undefined) continue;
    const key = aggregateKey(s, merge);
    const dur = Math.max(0, (s.end ?? now) - s.start);
    buckets[i].perSubject[key] = (buckets[i].perSubject[key] ?? 0) + dur;
    buckets[i].totalMs += dur;
  }

  return { buckets, allSubjects };
}

/** 时长格式化为 时:分:秒（小时可超过 24），用于计时器实时显示 */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 时长格式化为简短中文，用于统计数字与表格 */
export function formatShort(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}小时${m}分` : `${h}小时`;
  if (m > 0) return s > 0 ? `${m}分${s}秒` : `${m}分`;
  return `${s}秒`;
}
