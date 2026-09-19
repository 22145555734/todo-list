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

// 从 badgeImage 反推实际的炫动幅度（单侧偏移），供下面几条幅度测试共用
function shimmerOffsets(lv: number) {
  const stops = levelShimmer(lv)!
    .badgeImage.match(/hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/g)!
    .slice(0, 3) // lo / mid / hi
    .map((s) => {
      const m = s.match(/hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/)!;
      return { h: Number(m[1]), l: Number(m[3]) };
    });
  // 色相会跨 0°/360°，用最短环向差（正值 = 偏了多少度）。单侧偏移 < 180°，不会反转。
  const hueGap = (a: number, b: number) => ((a - b + 540) % 360) - 180;
  return { hue: hueGap(stops[1].h, stops[0].h), light: stops[1].l - stops[0].l };
}

// 容差取 0.5：hsl() 只序列化到 1 位小数，两个停靠点相减后回读有约 0.1° 的量化误差。
test("明度偏移所有等级一律 ±6%，不随等级变", () => {
  for (const lv of [1, 2, 100, 250, 251, 300, 346, 400, 401, 499]) {
    expect(shimmerOffsets(lv).light).toBeCloseTo(6, 0);
  }
  // 逐级断言相邻等级之间没有明度差 —— 防止哪天又悄悄插值进来
  for (const lv of [1, 50, 150, 250, 300, 350, 400, 450]) {
    expect(shimmerOffsets(lv + 1).light).toBeCloseTo(shimmerOffsets(lv).light, 1);
  }
});

test("色相偏移 400 级及以下恒为 ±8°，401~499 线性升到 ±30°", () => {
  // 平段：400 级（含）之前纹丝不动 —— 全部 400 级逐级断言，这是本版最容易被改坏的地方
  for (let lv = 1; lv <= 400; lv++) {
    expect(shimmerOffsets(lv).hue).toBeCloseTo(8, 0);
  }
  // 终点
  expect(shimmerOffsets(499).hue).toBeCloseTo(30, 0);
  // 中段线性：450 级 = 8 + (450-400)/99 * 22 ≈ 19.11
  expect(shimmerOffsets(450).hue).toBeCloseTo(19.11, 0);
  // 边界连续：400 → 401 没有台阶（斜率约 0.222°/级）
  expect(shimmerOffsets(401).hue - shimmerOffsets(400).hue).toBeLessThan(0.4);
  // 401 起逐级单调不降，且每级增量都不大（不会跳变）。
  // 容差 0.11 = 一个量化步长：幅度本身是严格单调的，但两个停靠点各自被序列化到 1 位小数，
  // 反解回来的差值带约 1e-13 的浮点噪声，回读值会在 0.1° 的两侧跳。
  // 本版斜率 0.222°/级，量化后相邻两级大多能区分开，但仍不该卡死 ≥
  for (let lv = 400; lv < 499; lv++) {
    expect(shimmerOffsets(lv + 1).hue).toBeGreaterThan(shimmerOffsets(lv).hue - 0.11);
  }
  for (const lv of [400, 420, 450, 470, 498]) {
    expect(shimmerOffsets(lv + 1).hue - shimmerOffsets(lv).hue).toBeLessThan(0.4);
  }
  // 每一级都还在动，没有「完全静止」的等级（满级除外，它走彩虹）
  for (const lv of [1, 250, 400, 499]) {
    expect(new Set(levelShimmer(lv)!.badgeImage.match(/hsl\([^)]*\)/g)!).size).toBeGreaterThan(1);
  }
});

test("字号随等级单调递增，1 级为 10/10，满级为 18/36", () => {
  expect(levelFont(1)).toMatchObject({ badgeSize: 10, titleSize: 10 });
  expect(levelFont(MAX_LEVEL)).toMatchObject({ badgeSize: 18, titleSize: 36 });
  for (const lv of [1, 50, 51, 200, 400, 401, 499]) {
    expect(levelFont(lv + 1).badgeSize).toBeGreaterThan(levelFont(lv).badgeSize);
    expect(levelFont(lv + 1).titleSize).toBeGreaterThan(levelFont(lv).titleSize);
  }
});
