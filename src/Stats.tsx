import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import { useNow } from "./useNow";
import {
  buildStats,
  dateKey,
  formatShort,
  parseKey,
  DAY_MS,
  type BucketStat,
  type Granularity,
} from "./time";

type Preset = "7" | "14" | "30" | "90" | "365" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7", label: "近7天" },
  { value: "14", label: "近14天" },
  { value: "30", label: "近30天" },
  { value: "90", label: "近3个月" },
  { value: "365", label: "近一年" },
  { value: "custom", label: "自定义" },
];

const SERIES_COUNT = 8;
const GAP = 2; // 堆叠段之间的留白
const CORNER = 4; // 柱子顶部的圆角
const MARGIN = { top: 20, right: 8, bottom: 26, left: 46 };
const PLOT_H = 220;

/** 观察容器宽度，用于 SVG 像素级定位（含命中区域与 tooltip） */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

/** 依据数据最大值生成刻度（分钟）、刻度上限（分钟）与单位 */
function buildTicks(dataMaxMin: number): {
  ticks: number[];
  scaleMax: number;
  useHours: boolean;
} {
  const useHours = dataMaxMin >= 60;
  const unit = useHours ? 60 : 1;
  const rawMax = Math.max(1, Math.ceil(dataMaxMin / unit));
  let step = 1;
  while (rawMax / step > 6) step *= 2;
  const scaleMax = Math.ceil(rawMax / step) * step * unit;
  const ticks: number[] = [];
  for (let v = 0; v <= scaleMax / unit; v += step) ticks.push(v * unit);
  return { ticks, scaleMax, useHours };
}

function tickLabel(min: number, useHours: boolean): string {
  if (min === 0) return "0";
  return useHours ? `${min / 60}小时` : `${min}分`;
}

/** 顶部圆角、底部平直的柱段路径 */
function segmentPath(x: number, y: number, w: number, h: number): string {
  const r = Math.max(0, Math.min(CORNER, w / 2, h));
  return [
    `M ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h}`,
    `L ${x} ${y + h}`,
    "Z",
  ].join(" ");
}

export default function Stats() {
  const { sessions, runningTodoId } = useStore();
  const [preset, setPreset] = useState<Preset>("7");
  const [customStart, setCustomStart] = useState(() =>
    dateKey(Date.now() - 29 * DAY_MS),
  );
  const [customEnd, setCustomEnd] = useState(() => dateKey(Date.now()));
  const [mergeSubs, setMergeSubs] = useState(true);
  const [tip, setTip] = useState<{
    bucket: BucketStat;
    x: number;
    y: number;
  } | null>(null);
  const { ref: containerRef, width } = useWidth<HTMLDivElement>();

  const now = useNow(runningTodoId !== null);
  const todayK = dateKey(now);

  // —— 计算生效的起止日期与粒度 ——
  const { startKey, endKey, unit } = useMemo(() => {
    if (preset === "custom") {
      const s = customStart <= customEnd ? customStart : customEnd;
      const e = customStart <= customEnd ? customEnd : customStart;
      return { startKey: s, endKey: e, unit: pickUnit(s, e) };
    }
    const n = Number(preset);
    const start = dateKey(parseKey(todayK).getTime() - (n - 1) * DAY_MS);
    return { startKey: start, endKey: todayK, unit: pickUnit(start, todayK) };
  }, [preset, customStart, customEnd, todayK]);

  // 没有子任务时隐藏合并/展开开关，保持原有界面不变
  const hasSubs = useMemo(
    () => sessions.some((s) => s.rootSubject !== null),
    [sessions],
  );
  const merge = !hasSubs || mergeSubs;

  const { buckets, allSubjects } = useMemo(
    () => buildStats(sessions, now, startKey, endKey, unit, merge),
    [sessions, now, startKey, endKey, unit, merge],
  );

  // 全量总时长（所有时间）
  const totalAllMs = useMemo(
    () => sessions.reduce((sum, s) => sum + ((s.end ?? now) - s.start), 0),
    [sessions, now],
  );

  // 今日时长（与所选范围无关）
  const todayMs = useMemo(
    () =>
      sessions
        .filter((s) => dateKey(s.start) === todayK)
        .reduce((sum, s) => sum + ((s.end ?? now) - s.start), 0),
    [sessions, now, todayK],
  );

  // 当前范围内出现的科目（按字母序，保证配色稳定）
  const rangeSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const b of buckets)
      for (const k of Object.keys(b.perSubject)) set.add(k);
    return Array.from(set).sort();
  }, [buckets]);

  // 科目名 -> 颜色槽。超过 8 个科目折叠为“其他”，保持颜色稳定（颜色跟随实体而非排名）
  const colorOf = (name: string): string => {
    const i = allSubjects.indexOf(name);
    return i >= 0 && i < SERIES_COUNT
      ? `var(--series-${i + 1})`
      : "var(--series-other)";
  };

  const foldedInRange = rangeSubjects.filter(
    (s) => allSubjects.indexOf(s) >= SERIES_COUNT,
  );
  const chartSubjects: { name: string; color: string }[] = [
    ...rangeSubjects
      .filter((s) => allSubjects.indexOf(s) < SERIES_COUNT)
      .map((s) => ({ name: s, color: colorOf(s) })),
    ...(foldedInRange.length > 0
      ? [{ name: "其他", color: "var(--series-other)" }]
      : []),
  ];

  const segmentMs = (bucket: BucketStat, name: string): number => {
    if (name === "其他") {
      return foldedInRange.reduce(
        (sum, s) => sum + (bucket.perSubject[s] ?? 0),
        0,
      );
    }
    return bucket.perSubject[name] ?? 0;
  };

  const rangeTotalMs = buckets.reduce((sum, b) => sum + b.totalMs, 0);

  // —— 图表几何 ——
  const dataMaxMin =
    buckets.reduce((m, b) => Math.max(m, b.totalMs), 0) / 60000;
  const { ticks, scaleMax, useHours } = buildTicks(dataMaxMin);
  const plotW = width - MARGIN.left - MARGIN.right;
  const step = buckets.length > 0 ? plotW / buckets.length : 0;
  const barW = Math.min(24, Math.max(4, step * 0.55));
  const baselineY = MARGIN.top + PLOT_H;
  const svgH = MARGIN.top + PLOT_H + MARGIN.bottom;
  const yFor = (min: number) => baselineY - (min / scaleMax) * PLOT_H;

  const maxBucketIndex = buckets.reduce(
    (idx, b, i) => (b.totalMs > buckets[idx].totalMs ? i : idx),
    0,
  );
  const xLabelEvery = Math.max(
    1,
    Math.ceil((buckets.length * 34) / Math.max(1, plotW)),
  );

  const showTip = (bucket: BucketStat, x: number, y: number) =>
    setTip({ bucket, x, y });
  const hideTip = () => setTip(null);

  const unitText = unit === "day" ? "天" : unit === "week" ? "周" : "月";
  const rangeLabel =
    preset === "custom"
      ? "自定义"
      : preset === "90"
        ? "近3个月"
        : preset === "365"
          ? "近一年"
          : `近${preset}天`;

  const statTiles = [
    { label: "总学习时长", value: formatShort(totalAllMs) },
    { label: "今日时长", value: formatShort(todayMs) },
    { label: `${rangeLabel}时长`, value: formatShort(rangeTotalMs) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">学习统计</h1>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          各科目的独立时长与总时长 · 按{unitText}统计
        </p>
        {hasSubs && (
          <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
            {[
              { value: true, label: "合并子任务" },
              { value: false, label: "展开子任务" },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setMergeSubs(o.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mergeSubs === o.value
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI 卡片 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {statTiles.map((t) => (
          <div
            key={t.label}
            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
          >
            <div className="text-xs text-gray-500">{t.label}</div>
            <div className="mt-1 truncate text-lg font-semibold tabular-nums text-gray-800">
              {t.value}
            </div>
          </div>
        ))}
      </div>

      {/* 时间范围切换 */}
      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
              preset === p.value
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 自定义起止日期 */}
      {preset === "custom" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <label className="flex items-center gap-1.5">
            从
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setCustomStart(v);
                if (v > customEnd) setCustomEnd(v);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="flex items-center gap-1.5">
            到
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={todayK}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setCustomEnd(v);
                if (v < customStart) setCustomStart(v);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="py-12 text-center text-gray-400">
          暂无计时记录，去“待办事项”页开始计时吧
        </p>
      ) : (
        <>
          <div ref={containerRef} className="viz-root relative w-full">
            {width > 0 && (
              <svg
                width={width}
                height={svgH}
                viewBox={`0 0 ${width} ${svgH}`}
                role="img"
                aria-label="各科目学习时长堆叠柱状图"
              >
                {/* 网格线与 Y 轴刻度 */}
                {ticks.map((min) => {
                  const y = yFor(min);
                  return (
                    <g key={min}>
                      <line
                        x1={MARGIN.left}
                        x2={width - MARGIN.right}
                        y1={y}
                        y2={y}
                        stroke="var(--gridline)"
                        strokeWidth={1}
                      />
                      <text
                        x={MARGIN.left - 8}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={11}
                        fill="var(--text-muted)"
                      >
                        {tickLabel(min, useHours)}
                      </text>
                    </g>
                  );
                })}

                {/* 每个桶的堆叠柱 */}
                {buckets.map((bucket, bi) => {
                  const cx = MARGIN.left + bi * step + step / 2;
                  const x = cx - barW / 2;
                  const segs: {
                    name: string;
                    color: string;
                    y: number;
                    h: number;
                  }[] = [];
                  let cursor = baselineY;
                  for (const cs of chartSubjects) {
                    const v = segmentMs(bucket, cs.name);
                    const h = (v / (scaleMax * 60000)) * PLOT_H;
                    if (h < 1) continue;
                    const y = cursor - h;
                    segs.push({ name: cs.name, color: cs.color, y, h });
                    cursor = y - GAP;
                  }

                  return (
                    <g key={bucket.key}>
                      {segs.map((s, si) =>
                        si === segs.length - 1 ? (
                          <path
                            key={s.name}
                            d={segmentPath(x, s.y, barW, s.h)}
                            fill={s.color}
                          />
                        ) : (
                          <rect
                            key={s.name}
                            x={x}
                            y={s.y}
                            width={barW}
                            height={s.h}
                            fill={s.color}
                          />
                        ),
                      )}

                      {/* 命中区域（比柱子更大，便于悬停/键盘聚焦） */}
                      <rect
                        x={MARGIN.left + bi * step}
                        y={MARGIN.top}
                        width={step}
                        height={PLOT_H}
                        fill="transparent"
                        tabIndex={0}
                        aria-label={`${bucket.fullLabel}，总时长 ${formatShort(
                          bucket.totalMs,
                        )}`}
                        onMouseMove={(e) =>
                          showTip(bucket, e.clientX, e.clientY)
                        }
                        onMouseLeave={hideTip}
                        onFocus={() => {
                          const r =
                            containerRef.current?.getBoundingClientRect();
                          if (r)
                            showTip(bucket, r.left + cx, r.top + MARGIN.top);
                        }}
                        onBlur={hideTip}
                      />

                      {/* 仅标注最大那一个桶的数值，其余交给坐标轴与 tooltip/表格 */}
                      {bi === maxBucketIndex && bucket.totalMs > 0 && (
                        <text
                          x={cx}
                          y={yFor(bucket.totalMs / 60000) - 6}
                          textAnchor="middle"
                          fontSize={11}
                          fill="var(--text-secondary)"
                        >
                          {formatShort(bucket.totalMs)}
                        </text>
                      )}

                      {/* X 轴标签（按需抽稀） */}
                      {bi % xLabelEvery === 0 && (
                        <text
                          x={cx}
                          y={baselineY + 16}
                          textAnchor="middle"
                          fontSize={11}
                          fill="var(--text-muted)"
                        >
                          {bucket.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 基线 */}
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={baselineY}
                  y2={baselineY}
                  stroke="var(--baseline)"
                  strokeWidth={1}
                />
              </svg>
            )}
          </div>

          {/* 图例 */}
          {chartSubjects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {chartSubjects.map((cs) => {
                const total =
                  cs.name === "其他"
                    ? foldedInRange.reduce(
                        (sum, s) =>
                          sum +
                          buckets.reduce(
                            (acc, b) => acc + (b.perSubject[s] ?? 0),
                            0,
                          ),
                        0,
                      )
                    : buckets.reduce(
                        (acc, b) => acc + (b.perSubject[cs.name] ?? 0),
                        0,
                      );
                return (
                  <div key={cs.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: cs.color }}
                    />
                    <span className="text-sm text-gray-700">{cs.name}</span>
                    <span className="text-sm tabular-nums text-gray-400">
                      {formatShort(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 数据表：无障碍兜底 + 完整明细 */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">科目</th>
                  {buckets.map((b) => (
                    <th
                      key={b.key}
                      className="px-2 py-2 text-right font-medium tabular-nums"
                    >
                      {b.label}
                    </th>
                  ))}
                  <th className="pl-2 py-2 text-right font-medium">总计</th>
                </tr>
              </thead>
              <tbody>
                {rangeSubjects.map((name) => {
                  const total = buckets.reduce(
                    (acc, b) => acc + (b.perSubject[name] ?? 0),
                    0,
                  );
                  return (
                    <tr key={name} className="border-b border-gray-100">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: colorOf(name) }}
                          />
                          <span className="text-gray-700">{name}</span>
                        </span>
                      </td>
                      {buckets.map((b) => (
                        <td
                          key={b.key}
                          className="px-2 py-2 text-right tabular-nums text-gray-500"
                        >
                          {b.perSubject[name]
                            ? formatShort(b.perSubject[name])
                            : "—"}
                        </td>
                      ))}
                      <td className="pl-2 py-2 text-right font-medium tabular-nums text-gray-700">
                        {formatShort(total)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-medium">
                  <td className="py-2 pr-3 text-gray-700">合计</td>
                  {buckets.map((b) => (
                    <td
                      key={b.key}
                      className="px-2 py-2 text-right tabular-nums text-gray-700"
                    >
                      {b.totalMs ? formatShort(b.totalMs) : "—"}
                    </td>
                  ))}
                  <td className="pl-2 py-2 text-right tabular-nums text-gray-800">
                    {formatShort(rangeTotalMs)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tooltip */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-48 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
          role="tooltip"
        >
          <div className="mb-1 text-xs font-semibold text-gray-800">
            {tip.bucket.fullLabel}
          </div>
          <ul className="space-y-0.5">
            {rangeSubjects
              .filter((s) => (tip.bucket.perSubject[s] ?? 0) > 0)
              .sort(
                (a, b) =>
                  (tip.bucket.perSubject[b] ?? 0) -
                  (tip.bucket.perSubject[a] ?? 0),
              )
              .map((s) => (
                <li
                  key={s}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: colorOf(s) }}
                    />
                    {s}
                  </span>
                  <span className="tabular-nums font-medium text-gray-800">
                    {formatShort(tip.bucket.perSubject[s])}
                  </span>
                </li>
              ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 text-xs">
            <span className="text-gray-500">总计</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {formatShort(tip.bucket.totalMs)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 依据跨度天数选择统计粒度 */
function pickUnit(startKey: string, endKey: string): Granularity {
  const spanDays =
    Math.round((parseKey(endKey).getTime() - parseKey(startKey).getTime()) / DAY_MS) +
    1;
  if (spanDays <= 31) return "day";
  if (spanDays <= 190) return "week";
  return "month";
}
