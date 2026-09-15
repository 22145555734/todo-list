import { useState, type FormEvent } from "react";
import { useStore } from "./store";

export default function Auth() {
  const { login, register, error } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password);
    } catch {
      // 错误已写入 store，这里仅复位加载态
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">
        {mode === "login" ? "登录" : "注册"}
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        登录后，待办与计时数据保存在服务器，随时随地同步
      </p>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名（3-32 位）"
          autoComplete="username"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码（至少 6 位）"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "请稍候…" : mode === "login" ? "登录" : "注册"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        {mode === "login" ? "还没有账号？" : "已有账号？"}
        <button
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setUsername("");
            setPassword("");
          }}
          className="ml-1 text-blue-500 hover:text-blue-600"
        >
          {mode === "login" ? "去注册" : "去登录"}
        </button>
      </p>
    </div>
  );
}
