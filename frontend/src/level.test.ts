import {
  cumulativeMinutes,
  getLevelInfo,
  levelColor,
  levelFont,
  levelMinutes,
  levelShimmer,
  MAX_LEVEL,
  RANKS,
} from "./level";

test("0 时长为新手 1 级，距下一级 15 分钟", () => {
  const info = getLevelInfo(0);
  expect(info.level).toBe(1);
  expect(info.title).toBe("新手");
  expect(info.nextLevel).toBe(2);
  expect(info.remainingMs).toBe(levelMinutes(1) * 60000);
  expect(info.progress).toBe(0);
});

test("累计 15 分钟升到 2 级", () => {
  expect(getLevelInfo(15 * 60000).level).toBe(2);
});

test("称号边界：50/51 级分别为新手/学徒", () => {
  const at51 = cumulativeMinutes(51) * 60000;
  expect(getLevelInfo(at51).level).toBe(51);
  expect(getLevelInfo(at51).title).toBe("学徒");
  expect(getLevelInfo(at51 - 1).level).toBe(50);
  expect(getLevelInfo(at51 - 1).title).toBe("新手");
});

test("累计 500 小时达到满级", () => {
  const info = getLevelInfo(cumulativeMinutes(MAX_LEVEL) * 60000);
  expect(info.level).toBe(MAX_LEVEL);
  expect(info.title).toBe("登峰造极");
  expect(info.nextLevel).toBeNull();
  expect(info.progress).toBe(1);
  expect(info.remainingMs).toBe(0);
});

test("单级耗时单调递增，且第 500 级为 105 分钟", () => {
  expect(levelMinutes(1)).toBeCloseTo(15);
  expect(levelMinutes(MAX_LEVEL)).toBeCloseTo(105);
  for (let i = 2; i <= MAX_LEVEL; i++) {
    expect(levelMinutes(i)).toBeGreaterThan(levelMinutes(i - 1));
  }
});

test("等级主题色在锚点处取品质色", () => {
  expect(levelColor(1)).toBe("rgb(34, 197, 94)"); // 绿
  expect(levelColor(100)).toBe("rgb(59, 130, 246)"); // 蓝
  expect(levelColor(200)).toBe("rgb(168, 85, 247)"); // 紫
  expect(levelColor(300)).toBe("rgb(245, 158, 11)"); // 金
  expect(levelColor(400)).toBe("rgb(239, 68, 68)"); // 红
  expect(levelColor(499)).toBe("rgb(185, 28, 28)"); // 深红
});

test("等级主题色相邻两级都不同（连续渐变）", () => {
  for (const lv of [50, 150, 250, 350, 450]) {
    expect(levelColor(lv)).not.toBe(levelColor(lv + 1));
  }
});

test("新手档称号用页面默认字体（不改 font-family）", () => {
  expect(levelFont(1).titleFamily).toBeNull();
  expect(levelFont(50).titleFamily).toBeNull();
});

test("称号字体一档一款：51 级起每档换一款，满级是云峰飞云体", () => {
  // 各档的 titleFamily 都带后备字体，所以断言首选项而非包含关系
  const first = (lv: number) => levelFont(lv).titleFamily?.split(",")[0].trim();
  const want = [
    [51, '"LevelXuetu"'],
    [101, '"LevelYanxizhe"'],
    [151, '"LevelShijianzhe"'],
    [201, '"LevelNengshou"'],
    [251, '"LevelZishen"'],
    [301, '"LevelGuwen"'],
    [351, '"LevelShouxi"'],
    [401, '"LevelTaidou"'],
    [MAX_LEVEL, '"LevelPeak"'],
  ] as const;
  for (const [lv, family] of want) {
    expect(first(lv)).toBe(family);
    // 每档的上下界都要落在同一款字体上
    const rank = RANKS.find((r) => lv >= r.minLevel && lv <= r.maxLevel)!;
    expect(first(rank.minLevel)).toBe(family);
    expect(first(rank.maxLevel)).toBe(family);
  }
  // 八档互不相同，没有漏改的重复项
  const used = want.map(([, f]) => f);
  expect(new Set(used).size).toBe(used.length);
});

test("只有满级不参与本档炫动（它走整条彩虹）", () => {
  expect(levelShimmer(MAX_LEVEL)).toBeNull();
  // 1 级自第十七期起也有炫动，不再返回 null
  for (const lv of [1, 2, 250, 499]) expect(levelShimmer(lv)).not.toBeNull();
});

test("速度两端点就是用户给的秒数：1 级 20s、499 级 1.145s", () => {
  expect(levelShimmer(1)!.durationS).toBeCloseTo(20, 9);
  expect(levelShimmer(499)!.durationS).toBeCloseTo(1.145, 9);
});

test("炫动周期随等级逐级变短（速度递增）", () => {
  for (const lv of [1, 2, 50, 151, 250, 400, 498]) {
    expect(levelShimmer(lv + 1)!.durationS).toBeLessThan(levelShimmer(lv)!.durationS);
  }
});

test("炫动渐变首尾同色，且只用本位色的 hsl（中间以本位色为基准偏移）", () => {
  const s = levelShimmer(250)!;
  for (const image of [s.badgeImage, s.titleImage]) {
    expect(image).toMatch(/^linear-gradient\(90deg, /);
    const stops = image.match(/hsl\([^)]*\)/g)!;
    expect(stops).toHaveLength(5);
    expect(stops[0]).toBe(stops[4]); // 首尾同色 → 无缝循环
    expect(stops[0]).not.toBe(stops[2]); // 中间确实有变化，不是一整块纯色
  }
});

test("炫动幅度随等级线性递增：1 级 ±5°/±8%，499 级 ±100°/±20%", () => {
  // 解析 badgeImage 的前三个 hsl 停靠点（lo / mid / hi），取色相 h 与明度 l
  const parse = (lv: number) => {
    const img = levelShimmer(lv)!.badgeImage;
    return img
      .match(/hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/g)!
      .slice(0, 3)
      .map((s) => {
        const m = s.match(/hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/)!;
        return { h: Number(m[1]), l: Number(m[3]) };
      });
  };
  // 色相会跨 0°/360°，用最短环向差（正值 = 偏了多少度）。单侧偏移 ≤100° < 180°，不会反转。
  const hueGap = (a: number, b: number) => ((a - b + 540) % 360) - 180;
  // 单侧偏移：mid 相对 lo 的色相/明度差，即 hueDeg / lightPct
  const offsets = (lv: number) => {
    const [lo, mid] = parse(lv);
    return { hue: hueGap(mid.h, lo.h), light: mid.l - lo.l };
  };
  const l1 = offsets(1);
  const l499 = offsets(499);
  expect(l1.hue).toBeCloseTo(5, 0);
  expect(l1.light).toBeCloseTo(8, 0);
  expect(l499.hue).toBeCloseTo(100, 0);
  expect(l499.light).toBeCloseTo(20, 0);
  // 中间等级严格夹在两端之间
  const mid = offsets(250);
  expect(mid.hue).toBeGreaterThan(l1.hue);
  expect(mid.hue).toBeLessThan(l499.hue);
  expect(mid.light).toBeGreaterThan(l1.light);
  expect(mid.light).toBeLessThan(l499.light);
});

test("字号随等级单调递增，1 级为 10/10，满级为 18/36", () => {
  expect(levelFont(1)).toMatchObject({ badgeSize: 10, titleSize: 10 });
  expect(levelFont(MAX_LEVEL)).toMatchObject({ badgeSize: 18, titleSize: 36 });
  for (const lv of [1, 50, 51, 200, 400, 401, 499]) {
    expect(levelFont(lv + 1).badgeSize).toBeGreaterThan(levelFont(lv).badgeSize);
    expect(levelFont(lv + 1).titleSize).toBeGreaterThan(levelFont(lv).titleSize);
  }
});
