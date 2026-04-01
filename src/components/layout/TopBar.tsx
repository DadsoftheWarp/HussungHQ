"use client";

import { usePathname } from "next/navigation";
import { Sun, Moon, Home, LogOut } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Hussung HQ",
  "/dashboard/calendar": "Calendar",
  "/dashboard/budget": "Budget",
  "/dashboard/todos": "To-Do Lists",
  "/dashboard/goals": "Goals",
  "/dashboard/chores": "Chores",
  "/dashboard/meals": "Meal Planner",
};

export default function TopBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const title = PAGE_TITLES[pathname] ?? "Hussung HQ";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b"
      style={{ background: "var(--card)", borderColor: "var(--card-border)", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="h-16 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "var(--primary)" }}>
          <Home className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-base" style={{ color: "var(--foreground)" }}>{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
          style={{ background: "var(--muted)" }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" style={{ color: "var(--accent)" }} />
          ) : (
            <Moon className="w-4 h-4" style={{ color: "var(--primary)" }} />
          )}
        </button>
        <button
          onClick={signOut}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
          style={{ background: "var(--muted)" }}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
      </div>
    </header>
  );
}
