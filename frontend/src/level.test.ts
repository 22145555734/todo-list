import {
  cumulativeMinutes,
  getLevelInfo,
  levelColor,
  levelColorText,
  levelFont,
  levelMinutes,
  MAX_LEVEL,
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

test("称号字体四档递进：新手默认 → 霞鹜文楷 → 马善政 → 云峰飞云体", () => {
  // 各档的 titleFamily 都带后备字体，所以断言首选项而非包含关系
  const first = (lv: number) => levelFont(lv).titleFamily?.split(",")[0].trim();
  expect(first(51)).toBe('"LevelKai"');
  expect(first(400)).toBe('"LevelKai"');
  expect(first(401)).toBe('"LevelTaidou"');
  expect(first(499)).toBe('"LevelTaidou"');
  expect(first(MAX_LEVEL)).toBe('"LevelPeak"');
});

test("字号随等级单调递增，1 级为 12/14，满级为 17/26", () => {
  expect(levelFont(1)).toMatchObject({ badgeSize: 12, titleSize: 14 });
  expect(levelFont(MAX_LEVEL)).toMatchObject({ badgeSize: 17, titleSize: 26 });
  for (const lv of [1, 50, 51, 200, 400, 401, 499]) {
    expect(levelFont(lv + 1).badgeSize).toBeGreaterThan(levelFont(lv).badgeSize);
    expect(levelFont(lv + 1).titleSize).toBeGreaterThan(levelFont(lv).titleSize);
  }
});
