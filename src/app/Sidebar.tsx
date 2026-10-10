"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Leads", icon: "◆" },
  { href: "/review", label: "Review queue", icon: "⚑" },
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/replay", label: "Replay (dev)", icon: "↻" },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col gap-1 bg-[#101834] px-4 py-6 text-[#aab0c8] sm:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-teal-300 text-sm font-bold text-[#101834]">
            A
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Aangan Studio</div>
            <div className="text-xs text-[#6b7399]">Intake AI</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-[#aab0c8] hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="w-4 text-center text-xs">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <nav className="flex w-full items-center gap-1 overflow-x-auto bg-[#101834] px-3 py-2 sm:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isActive(item.href) ? "bg-indigo-500 text-white" : "text-[#aab0c8]"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
