// 等级 / 称号系统：500 级、累计 500 小时，等差数列平滑递增。
// 第 i 级耗时 t_i = 15 + (i-1) * d 分钟，其中 d = 90/499 ≈ 11 秒/级。
// 第 1 级 15 分钟，第 500 级 105 分钟；总耗时 = 500*(15+105)/2 = 500 小时。

const D = 90 / 499; // 每升一级增加的分钟数
export const MAX_LEVEL = 500;

export interface Rank {
  minLevel: number;
  maxLevel: number;
  title: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, maxLevel: 50, title: "新手" },
  { minLevel: 51, maxLevel: 100, title: "学徒" },
  { minLevel: 101, maxLevel: 150, title: "研习者" },
  { minLevel: 151, maxLevel: 200, title: "实践者" },
  { minLevel: 201, maxLevel: 250, title: "能手" },
  { minLevel: 251, maxLevel: 300, title: "资深" },
  { minLevel: 301, maxLevel: 350, title: "顾问" },
  { minLevel: 351, maxLevel: 400, title: "首席" },
  { minLevel: 401, maxLevel: 499, title: "泰斗" },
  { minLevel: 500, maxLevel: 500, title: "登峰造极" },
];

export function titleOf(level: number): string {
  return (
    RANKS.find((r) => level >= r.minLevel && level <= r.maxLevel)?.title ?? ""
  );
}

/** 第 level 级耗时（分钟） */
export function levelMinutes(level: number): number {
  return 15 + (level - 1) * D;
}

/** 达到第 level 级所需的累计分钟数（即完成前 level-1 级） */
export function cumulativeMinutes(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * 15 + (D * (n - 1) * n) / 2;
}

export interface LevelInfo {
  level: number;
  title: string;
  nextLevel: number | null;
  nextTitle: string | null;
  /** 本等级进度 0~1 */
  progress: number;
  /** 到下一级还需时长（毫秒），满级为 0 */
  remainingMs: number;
}

/** 由累计时长（毫秒）计算当前等级、称号与升级进度 */
export function getLevelInfo(totalMs: number): LevelInfo {
  const minutes = totalMs / 60000;

  // 二分查找最大的 level 使 cumulativeMinutes(level) <= minutes
  let level = 1;
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeMinutes(mid) <= minutes) {
      level = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (level >= MAX_LEVEL) {
    return {
      level,
      title: titleOf(level),
      nextLevel: null,
      nextTitle: null,
      progress: 1,
      remainingMs: 0,
    };
  }

  const intoMs = totalMs - cumulativeMinutes(level) * 60000;
  const levelTotalMs = levelMinutes(level) * 60000;
  return {
    level,
    title: titleOf(level),
    nextLevel: level + 1,
    nextTitle: titleOf(level + 1),
    progress: Math.min(1, Math.max(0, intoMs / levelTotalMs)),
    remainingMs: Math.max(0, levelTotalMs - intoMs),
  };
}
