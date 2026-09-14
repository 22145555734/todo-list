import { useState } from "react";
import TodoList from "./TodoList";
import Stats from "./Stats";
import { StoreProvider } from "./store";

type Tab = "todo" | "stats";

export default function App() {
  const [tab, setTab] = useState<Tab>("todo");

  const tabs: { value: Tab; label: string }[] = [
    { value: "todo", label: "待办事项" },
    { value: "stats", label: "学习统计" },
  ];

  return (
    <StoreProvider>
      <div className="min-h-screen bg-gray-100 py-8">
        <nav className="mx-auto mb-6 flex w-full max-w-md gap-1 rounded-xl bg-gray-200 p-1">
          {tabs.map(({ value, label }) => (
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

        {tab === "todo" ? <TodoList /> : <Stats />}
      </div>
    </StoreProvider>
  );
}
