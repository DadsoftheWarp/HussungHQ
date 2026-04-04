"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  ListChecks,
  Utensils,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/calendar", icon: Calendar, label: "Calendar" },
  { href: "/dashboard/todos", icon: CheckSquare, label: "Todos" },
  { href: "/dashboard/chores", icon: ListChecks, label: "Chores" },
  { href: "/dashboard/meals", icon: Utensils, label: "Meals" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t"
      style={{
        background: "var(--card)",
        borderColor: "var(--card-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around h-16 px-2 py-4">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all active:scale-95 min-w-0"
            >
              <Icon
                className="w-5 h-5 flex-shrink-0"
                style={{
                  color: active ? "var(--primary)" : "var(--muted-foreground)",
                }}
              />
              <span
                className="text-[10px] font-medium truncate"
                style={{
                  color: active ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
