import {
  cumulativeMinutes,
  getLevelInfo,
  levelColor,
  levelColorText,
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

test("文字色是底色加深版（白底可读）", () => {
  const base = levelColor(250);
  const text = levelColorText(250);
  const [br, bg, bb] = base
    .slice(4, -1)
    .split(",")
    .map((n) => Number(n.trim()));
  const [tr, tg, tb] = text
    .slice(4, -1)
    .split(",")
    .map((n) => Number(n.trim()));
  expect(tr).toBeLessThan(br);
  expect(tg).toBeLessThan(bg);
  expect(tb).toBeLessThan(bb);
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

test("1 级完全不动、满级走彩虹，都不参与本档炫动", () => {
  expect(levelShimmer(1)).toBeNull();
  expect(levelShimmer(MAX_LEVEL)).toBeNull();
  expect(levelShimmer(2)).not.toBeNull();
  expect(levelShimmer(499)).not.toBeNull();
});

test("炫动速度随等级递增，499 级是满级新速度的 0.8 倍", () => {
  // 满级 1.5 周期/秒，499 级 = 1.5 × 0.8 = 1.2 周期/秒 → 时长 1/1.2
  expect(levelShimmer(499)!.durationS).toBeCloseTo(1 / 1.2, 6);
  for (const lv of [2, 50, 151, 250, 400, 498]) {
    expect(levelShimmer(lv + 1)!.durationS).toBeLessThan(levelShimmer(lv)!.durationS);
  }
});

test("炫动渐变首尾同色，且只用本位色的 hsl（保持在自己的色域内）", () => {
  const s = levelShimmer(250)!;
  for (const image of [s.badgeImage, s.titleImage]) {
    expect(image).toMatch(/^linear-gradient\(90deg, /);
    const stops = image.match(/hsl\([^)]*\)/g)!;
    expect(stops).toHaveLength(5);
    expect(stops[0]).toBe(stops[4]); // 首尾同色 → 无缝循环
    expect(stops[0]).not.toBe(stops[2]); // 中间确实有变化，不是一整块纯色
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
