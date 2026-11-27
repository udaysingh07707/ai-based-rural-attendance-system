"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSchoolData } from "../providers/school-data-provider";
import {
  BookOpen,
  Camera,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Users,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Classes", href: "/classes", icon: BookOpen },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
  { label: "AI photo attendance", href: "/ai-attendance", icon: Camera },
  { label: "Reports", href: "/reports", icon: GraduationCap },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar({ isOpen, onNavigate }) {
  const pathname = usePathname();
  const { teacher } = useSchoolData();

  return (
    <aside
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <GraduationCap size={21} aria-hidden="true" />
          </span>
          <span>
          <span className="block max-w-36 truncate text-sm font-bold text-slate-900">{teacher?.school?.name ?? "School"}</span>
            <span className="block text-xs text-slate-500">Attendance</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="Close navigation menu"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          onClick={onNavigate}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          School menu
        </p>
        {navigation.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <p className="text-xs font-medium text-slate-500">School account</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
          {teacher?.school?.name ?? "School account"}
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">{teacher?.name ?? "Teacher account"}</p>
      </div>
    </aside>
  );
}
