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

// 等级主题色：绿 → 蓝 → 紫 → 金 → 红 连续渐变，1~499 级每级微变。
// 颜色槽取游戏常见的「品质色」锚点，段内做 RGB 线性插值。
interface ColorStop {
  level: number;
  r: number;
  g: number;
  b: number;
}

const COLOR_STOPS: ColorStop[] = [
  { level: 1, r: 34, g: 197, b: 94 }, // 绿
  { level: 100, r: 59, g: 130, b: 246 }, // 蓝
  { level: 200, r: 168, g: 85, b: 247 }, // 紫
  { level: 300, r: 245, g: 158, b: 11 }, // 金
  { level: 400, r: 239, g: 68, b: 68 }, // 红
  { level: 499, r: 185, g: 28, b: 28 }, // 深红
];

/** 返回 1~499 级的主题色 RGB 分量；满级由调用方改用炫彩样式，不在这里产生颜色 */
function levelRgb(level: number): [number, number, number] {
  const lv = Math.min(Math.max(level, 1), 499);
  // 找 lv 所在的插值段
  let i = 0;
  for (let k = 0; k < COLOR_STOPS.length - 1; k++) {
    if (lv <= COLOR_STOPS[k + 1].level) {
      i = k;
      break;
    }
  }
  const a = COLOR_STOPS[i];
  const b = COLOR_STOPS[i + 1];
  const t = (lv - a.level) / (b.level - a.level);
  const mix = (p: number, q: number) => Math.round(p + (q - p) * t);
  return [mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)];
}

/** 等级主题色（徽章底 / 进度条填充用） */
export function levelColor(level: number): string {
  const [r, g, b] = levelRgb(level);
  return `rgb(${r}, ${g}, ${b})`;
}

/** 等级主题色的加深版（称号文字用）：绿/金等亮色直接当文字在白底上对比度不足 */
export function levelColorText(level: number): string {
  const [r, g, b] = levelRgb(level);
  return `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`;
}

// 等级字体：字号随等级线性放大。字体**只作用于称号**，徽章「Lv.N」一律走页面
// 默认字体 —— 数字与 "Lv." 用毛笔体反而不好认，也没必要。
// 称号字体分四档递进 —— 新手（1~50）用页面默认字体，51 级起换霞鹜文楷，
// 401 级起换马善政毛笔楷书，满级（500）换云峰飞云体。前两档是 OFL 开源字体，
// 只嵌入用到的字符，共约 21KB，可自由子集化。
// 满级那档的授权不允许修改字体，因此整包原样引入、不做子集（7.56MB）——
// 它只在 500 级的称号上被引用，浏览器按需下载，低等级用户不会触发。
// @font-face 见 index.css。系统字体名作后备，字体未加载时也能显示。
const FONT_KAI = '"LevelKai", "KaiTi", "STKaiti", serif';
const FONT_TAIDOU = '"LevelTaidou", "LevelKai", "KaiTi", serif';
const FONT_PEAK = '"LevelPeak", "LevelTaidou", "LevelKai", "KaiTi", serif';

export interface LevelFont {
  /** 徽章「Lv.N」的字号（px） */
  badgeSize: number;
  /** 称号的字号（px） */
  titleSize: number;
  /** 称号的字体族；null 表示沿用页面默认字体。徽章不受它影响 */
  titleFamily: string | null;
}

/** 由等级得到称号 / 徽章的字号与字体族 */
export function levelFont(level: number): LevelFont {
  const lv = Math.min(Math.max(level, 1), MAX_LEVEL);
  const t = (lv - 1) / (MAX_LEVEL - 1); // 1 级为 0，满级为 1
  return {
    badgeSize: 12 + t * 5, // 12 → 17
    titleSize: 14 + t * 12, // 14 → 26
    titleFamily:
      lv >= MAX_LEVEL ? FONT_PEAK : lv > 400 ? FONT_TAIDOU : lv > 50 ? FONT_KAI : null,
  };
}
