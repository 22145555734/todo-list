import { useEffect, useState } from "react";

/**
 * 返回当前时间戳。仅当 active 为 true 时每秒刷新一次，
 * 用于有计时器在运行时驱动实时时长显示，避免无谓重渲染。
 */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return now;
}
