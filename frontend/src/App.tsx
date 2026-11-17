import { lazy, Suspense, useState } from "react";
import Auth from "./Auth";
import TodoList from "./TodoList";
import { StoreProvider, useStore } from "./store";

const Stats = lazy(() => import("./Stats"));

type Tab = "todo" | "stats";

const TABS: { value: Tab; label: string }[] = [
  { value: "todo", label: "待办事项" },
  { value: "stats", label: "学习统计" },
];

function Shell() {
  const { token, authReady, username, error, clearError, logout } = useStore();
  const [tab, setTab] = useState<Tab>("todo");

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-400">
        加载中…
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 py-10">
        <Auth />
        <ExpLink />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <nav className="mx-auto mb-4 flex w-full max-w-md gap-1 rounded-xl bg-gray-200 p-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === value
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mx-auto mb-4 flex w-full max-w-md items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 transition hover:text-red-600"
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      )}

      <div className="mx-auto mb-4 flex w-full max-w-md items-center justify-between text-sm text-gray-500">
        <span>
          已登录：
          <span className="font-medium text-gray-700">{username}</span>
        </span>
        <button
          onClick={logout}
          className="text-blue-500 transition hover:text-blue-600"
        >
          退出登录
        </button>
      </div>

      {tab === "todo" ? (
        <TodoList />
      ) : (
        <Suspense
          fallback={
            <div className="py-16 text-center text-gray-400">加载中…</div>
          }
        >
          <Stats />
        </Suspense>
      )}

      <ExpLink />
    </div>
  );
}

/**
 * 课程实验用：首页放一张可右键「图片另存为」的图片，点击进入第二个页面。
 * 素材是静态文件（public/exp3/），不走 React 路由，直接由 nginx 提供。
 * 实验结束后删掉这个组件和 public/exp3/ 即可，不影响其它功能。
 */
function ExpLink() {
  return (
    <div className="mx-auto mt-6 w-full max-w-md rounded-xl bg-white p-4 text-center shadow-sm">
      <a href="/exp3/page2.html">
        <img
          src="/exp3/pic.jpg"
          alt="点击图片进入第二页"
          className="w-full rounded-lg border-2 border-amber-300"
        />
      </a>
      <p className="mt-2 text-xs text-gray-500">点击图片进入第二页</p>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
