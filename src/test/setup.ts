import "@testing-library/jest-dom/vitest";

// jsdom 的 crypto 若缺少 randomUUID 则补一个简单实现，保证测试环境稳定
if (typeof globalThis.crypto?.randomUUID !== "function") {
  let id = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
  });
}
