import Link from "next/link";
import {
  Camera,
  ClipboardCheck,
  FileText,
  UserPlus,
} from "lucide-react";

const actions = [
  {
    label: "Take attendance",
    description: "Mark today's attendance",
    href: "/attendance",
    icon: ClipboardCheck,
  },
  {
    label: "Add a student",
    description: "Register a new student",
    href: "/students",
    icon: UserPlus,
  },
  {
    label: "Photo attendance",
    description: "Start a photo session",
    href: "/ai-attendance",
    icon: Camera,
  },
  {
    label: "View reports",
    description: "Review attendance records",
    href: "/reports",
    icon: FileText,
  },
];

export default function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ label, description, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-brand-200 hover:bg-brand-50/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
            <Icon size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              {label}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {description}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
