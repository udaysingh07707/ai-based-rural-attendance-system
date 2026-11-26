import { Bell, Menu } from "lucide-react";

export default function Topbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={onMenuClick}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-slate-700">
          Teacher workspace
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications (coming soon)"
          title="Notifications coming soon"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <Bell size={19} aria-hidden="true" />
        </button>
        <span
          aria-label="Teacher profile placeholder"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          T
        </span>
      </div>
    </header>
  );
}
