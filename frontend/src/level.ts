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

// 等级炫动：1~499 级以本位色为中心左右流动，**幅度（色相/明度偏移）与速度都随等级线性递增**；500 级走整条彩虹
// （`.rainbow-*` 类，1.2 周期/秒 = 0.833s，那个值定义在 index.css 里，本文件不参与）。
//
// 「速度」以每秒跑完几个渐变周期计。两端点由用户直接钉死，中间按等级线性插值：
//   1 级   ：20 秒一圈（0.05 周期/秒）—— 本期之前是「完全不动」，用户要求给一档可见的慢速
//   499 级：1.145 秒一圈（≈0.8734 周期/秒）—— 用户直接给的秒数
// 端点的历史账（只看 1 级与 499 级，满级那 1.2 没动）：
//   第十五期：1 级 0（不动），499 级 1.2 周期/秒 = 0.83s
//   第十六期：1 级 0，499 级 ×0.7 = 0.84 周期/秒 = 1.19s
//   本期    ：改为用户直接给的秒数，且 1 级不再是 0
//
// 注意速度是**线性**插值而非周期线性：两者只在端点相同，中段能差到 5 倍
// （250 级：速度线性 2.17s vs 周期线性 10.57s）。用户看过这组对比后选的速度线性。
const LV1_CYCLES_PER_SEC = 1 / 20; // 0.05
const LV499_CYCLES_PER_SEC = 1 / 1.145; // ≈ 0.8734

// 炫动幅度随等级线性递增（端点由用户直接钉死）：色相左右各偏 hueDeg 度、明度上下各偏 lightPct 个百分点。
//   1 级  ：±5°  —— 只微微颤动，本位色的辨识度基本不变
//   499 级：±70° —— 上一版是 ±100°，用户看过后嫌「好难看」而收窄：
//                   色相扫 140°，仍然明显比低等级炫，但不会整条彩虹糊成一片
const LV1_HUE_DEG = 5;
const LV499_HUE_DEG = 70;

// 明度偏移：本期按用户要求**全局归零**（原话「先把明暗都降到0」）—— 1~499 级只剩色相流动，
// 不再有一亮一暗的闪烁。插值、收窄那一整套机制都原样留着，恢复只需把这三个数改回去。
// 归零的连带后果：251~400 收窄段本来就已把色相减到 0（见 TRIM_HUE_DEG），
// 明度再去掉后，**258~346 级彻底静止** —— 渐变五个停靠点完全相同，animation 空转。
const LV1_LIGHT_PCT = 0;
const LV499_LIGHT_PCT = 0;

// 资深 / 顾问 / 首席三档（251~400 级）再额外收窄一档 —— 用户先要求这一段减 20°/5%，
// 看过预览后又要求「还是太多了，再减30°」，色相合计减 50°。
// **两端各留一段过渡**，否则 250→251 与 400→401 会各出现一次 50° 的台阶：
// 相邻两级看起来明显不同，升级瞬间幅度突变。
//
// 减到负数时**封底为 0**，不取绝对值。这一段的基准幅度本来就只有 37~57°，
// 减 50° 必然在中途穿越零点；取绝对值的话，渐入过程中（约 258 级）会先掉到 0 再回弹，
// 到 346 级第二次归零，整段成双谷 —— 相邻两级一会儿更静一会儿更闹，反而不像「逐级变化」。
// 封底后整段单调：251 级 37.6° 一路降到 258 级触底，258~346 恒为 0，
// 之后回升到 400 级的 57.1°。
//
// 明度这一路同样归零（用户「先把明暗都降到0」），所以原本给这一段留的
// 「明暗呼吸」也没了 —— 258~346 级是真·完全静止，不再是「退成明暗呼吸」。
// 这条与第十九期「1~499 级全都炫动」的约定直接冲突，是用户明知后选的（预览里写明「完全静止」）。
const TRIM_FROM = 251;
const TRIM_TO = 400;
const TRIM_HUE_DEG = 50;
const TRIM_LIGHT_PCT = 0;
const TRIM_FADE_IN = 9; // 251~260 渐入
const TRIM_FADE_OUT = 10; // 390~400 渐出

/** 251~400 段的减幅权重 0~1：两端线性渐入渐出，中段取满 */
function trimWeight(lv: number): number {
  if (lv < TRIM_FROM || lv > TRIM_TO) return 0;
  if (lv < TRIM_FROM + TRIM_FADE_IN) return (lv - TRIM_FROM) / TRIM_FADE_IN;
  if (lv > TRIM_TO - TRIM_FADE_OUT) return (TRIM_TO - lv) / TRIM_FADE_OUT;
  return 1;
}

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
function shimmerGradient(rgb: [number, number, number], hueDeg: number, lightPct: number): string {
  const [h, s, l] = toHsl(...rgb);
  const lo = hsl(h - hueDeg, s, l - lightPct);
  const mid = hsl(h, s, l);
  const hi = hsl(h + hueDeg, s, l + lightPct);
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
 * 1~499 级的炫动参数。**只有满级返回 null** —— 500 级走整条彩虹的 `.rainbow-*`，
 * 是另一套样式，不参与本档炫动。
 */
export function levelShimmer(level: number): LevelShimmer | null {
  const lv = Math.min(Math.max(level, 1), MAX_LEVEL);
  if (lv === MAX_LEVEL) return null;
  const [r, g, b] = levelRgb(lv);
  // 速度、幅度都在两端点之间按等级线性插值：1 级取到 0（= LV1），499 级取到 1（= LV499）
  const t = (lv - 1) / (MAX_LEVEL - 2);
  const cyclesPerSec =
    LV1_CYCLES_PER_SEC + t * (LV499_CYCLES_PER_SEC - LV1_CYCLES_PER_SEC);
  const trim = trimWeight(lv);
  // 收窄段减得比基准幅度还深，中段会减成负数 —— 封底为 0（理由见 TRIM_HUE_DEG 的注释）
  const hueDeg = Math.max(
    0,
    LV1_HUE_DEG + t * (LV499_HUE_DEG - LV1_HUE_DEG) - trim * TRIM_HUE_DEG,
  );
  const lightPct =
    LV1_LIGHT_PCT + t * (LV499_LIGHT_PCT - LV1_LIGHT_PCT) - trim * TRIM_LIGHT_PCT;
  return {
    badgeImage: shimmerGradient([r, g, b], hueDeg, lightPct),
    titleImage: shimmerGradient([r, g, b].map((c) => Math.round(c * 0.72)) as [number, number, number], hueDeg, lightPct),
    // 时长是速度的倒数
    durationS: 1 / cyclesPerSec,
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
