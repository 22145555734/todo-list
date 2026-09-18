// 等级 / 称号系统：500 级、累计 500 小时，等差数列平滑递增。
// 第 i 级耗时 t_i = 15 + (i-1) * d 分钟，其中 d = 90/499 ≈ 11 秒/级。
// 第 1 级 15 分钟，第 500 级 105 分钟；总耗时 = 500*(15+105)/2 = 500 小时。

const D = 90 / 499; // 每升一级增加的分钟数
export const MAX_LEVEL = 500;

// 称号字体一档一款 —— 字体族写死在表里，与 @font-face（index.css）一一对应。
// 后缀是系统字体的后备，各自挑了气质相近的：黑体档退到无衬线，手写档退到楷体。
// 字体来源与授权见 index.css 顶部注释。
const FONT_SANS = 'system-ui, sans-serif';
const FONT_MONO = 'ui-monospace, "Consolas", monospace';
const KAI = '"KaiTi", "STKaiti", serif';

export interface Rank {
  minLevel: number;
  maxLevel: number;
  title: string;
  /** 称号字体族；null 表示沿用页面默认字体。徽章「Lv.N」不受它影响 */
  font: string | null;
}

export const RANKS: Rank[] = [
  { minLevel: 1, maxLevel: 50, title: "新手", font: null },
  { minLevel: 51, maxLevel: 100, title: "学徒", font: `"LevelXuetu", ${FONT_MONO}` },
  { minLevel: 101, maxLevel: 150, title: "研习者", font: `"LevelYanxizhe", ${KAI}` },
  { minLevel: 151, maxLevel: 200, title: "实践者", font: `"LevelShijianzhe", ${FONT_SANS}` },
  { minLevel: 201, maxLevel: 250, title: "能手", font: `"LevelNengshou", ${KAI}` },
  { minLevel: 251, maxLevel: 300, title: "资深", font: `"LevelZishen", ${KAI}` },
  { minLevel: 301, maxLevel: 350, title: "顾问", font: `"LevelGuwen", ${KAI}` },
  { minLevel: 351, maxLevel: 400, title: "首席", font: `"LevelShouxi", ${KAI}` },
  { minLevel: 401, maxLevel: 499, title: "泰斗", font: `"LevelTaidou", ${KAI}` },
  { minLevel: 500, maxLevel: 500, title: "登峰造极", font: `"LevelPeak", ${KAI}` },
];

/** level 落在哪一档；超出 1~500 返回 undefined */
function rankOf(level: number): Rank | undefined {
  return RANKS.find((r) => level >= r.minLevel && level <= r.maxLevel);
}

export function titleOf(level: number): string {
  return rankOf(level)?.title ?? "";
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

// 等级炫动：1~499 级在**自己的色域内**向右流动，速度随等级线性递增；1 级完全不动，
// 500 级走整条彩虹（`.rainbow-*` 类，见 index.css）。
// 「速度」以每秒跑完几个渐变周期计。两次调整的账：
//   满级：第十期起 1.0 → 第十五期 ×1.5 = 1.5 → 本期再 ×0.8 = 1.2
//   499 级：第十五期 = 满级 × 0.8 = 1.2 → 本期再 ×0.7 = 0.84
// 本期两个数正好仍满足「499 = 0.7 × 满级」（0.84 / 1.2 = 0.7）。
// 中间的 2~498 级在 0（1 级）与 499 级之间按等级线性插值。
const PEAK_CYCLES_PER_SEC = 1.2;
const LV499_CYCLES_PER_SEC = PEAK_CYCLES_PER_SEC * 0.7; // 0.84

/** 炫动幅度：色相左右各偏这么多度、明度上下各偏这么多个百分点 —— 即「保持在自己的色域附近」 */
const SHIMMER_HUE_DEG = 8;
const SHIMMER_LIGHT_PCT = 14;

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d + 6) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

/** 逗号写法的 hsl()：T7 内核（Chromium 97）安全，不用空格分隔或 oklch */
function hsl(h: number, s: number, l: number): string {
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
  return `hsl(${(((h % 360) + 360) % 360).toFixed(1)}, ${clamp(s, 0, 100).toFixed(1)}%, ${clamp(l, 0, 100).toFixed(1)}%)`;
}

/** 以 rgb 为底色做「左偏暗 → 本色 → 右偏亮 → 本色 → 左偏暗」的渐变，首尾同色 */
function shimmerGradient(rgb: [number, number, number]): string {
  const [h, s, l] = toHsl(...rgb);
  const lo = hsl(h - SHIMMER_HUE_DEG, s, l - SHIMMER_LIGHT_PCT);
  const mid = hsl(h, s, l);
  const hi = hsl(h + SHIMMER_HUE_DEG, s, l + SHIMMER_LIGHT_PCT);
  // 首尾同为 lo：配合 background-size:200%，向右滚一个周期即可无缝衔接
  return `linear-gradient(90deg, ${lo}, ${mid}, ${hi}, ${mid}, ${lo})`;
}

export interface LevelShimmer {
  /** 徽章底色用的渐变 */
  badgeImage: string;
  /** 称号文字用的渐变（本色加深版，白底可读） */
  titleImage: string;
  /** 一个循环的时长（秒） */
  durationS: number;
}

/**
 * 1~499 级的炫动参数。1 级返回 null（完全不动），500 级也返回 null
 * （满级走整条彩虹的 `.rainbow-*`，是另一套样式）。
 */
export function levelShimmer(level: number): LevelShimmer | null {
  const lv = Math.min(Math.max(level, 1), MAX_LEVEL);
  if (lv === 1 || lv === MAX_LEVEL) return null;
  const [r, g, b] = levelRgb(lv);
  return {
    badgeImage: shimmerGradient([r, g, b]),
    titleImage: shimmerGradient([r, g, b].map((c) => Math.round(c * 0.72)) as [number, number, number]),
    // 速度 = (lv-1)/498 × 1.2 周期/秒，故时长是它的倒数
    durationS: (MAX_LEVEL - 2) / ((lv - 1) * LV499_CYCLES_PER_SEC),
  };
}

// 等级字体：字号随等级线性放大。字体**只作用于称号**，徽章「Lv.N」一律走页面
// 默认字体 —— 数字与 "Lv." 用艺术字体反而不好认，也没必要。
// 称号本身一档一款，字体族定义在上面的 RANKS 表里（@font-face 见 index.css）。
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
    badgeSize: 10 + t * 8, // 10 → 18
    titleSize: 10 + t * 26, // 10 → 36
    titleFamily: rankOf(lv)?.font ?? null,
  };
}
