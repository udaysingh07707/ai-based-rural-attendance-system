"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCircle2, ChevronDown, GraduationCap, LogOut, Menu, UserRound } from "lucide-react";
import { useSchoolData } from "../providers/school-data-provider";
import VoiceAssistant from "./voice-assistant";
import ConnectivityStatus from "../common/connectivity-status";

export default function Topbar({ onMenuClick }) {
  const router = useRouter();
  const pathname = usePathname();
  const { teacher, clearSessionState } = useSchoolData();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const profileRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape" && profileOpen) {
        setProfileOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      clearSessionState();
      router.replace("/login");
    } catch {
      setLogoutError("Sign out failed. Check your connection and try again.");
      setLoggingOut(false);
    }
  }

  const initials = teacher?.name?.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "T";
  const verified = Boolean(teacher?.emailVerifiedAt);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 sm:gap-3">
        <ConnectivityStatus />
        <VoiceAssistant />
        <button
          type="button"
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={onMenuClick}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-slate-700">Teacher workspace</span>
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

        <div ref={profileRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            aria-label="Open teacher profile menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-controls="teacher-profile-menu"
            onClick={() => { setLogoutError(""); setProfileOpen((open) => !open); }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-slate-100 focus-visible:outline-offset-2 ${profileOpen ? "bg-slate-100" : ""}`}
          >
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{initials}</span>
            <ChevronDown size={15} aria-hidden="true" className={`hidden text-slate-500 transition sm:block ${profileOpen ? "rotate-180" : ""}`} />
          </button>

          {profileOpen && <div id="teacher-profile-menu" role="menu" aria-label="Teacher profile" className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
            <div className="border-b border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{teacher?.name || "Teacher account"}</p>
                  <p className="truncate text-xs text-slate-600">{teacher?.email || "Email unavailable"}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-600"><GraduationCap size={15} className="shrink-0 text-slate-400" /><span className="truncate">{teacher?.school?.name || "School unavailable"}</span></div>
                <div className={`flex items-center gap-2 text-xs font-medium ${verified ? "text-emerald-700" : "text-amber-700"}`}>
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{verified ? "Email verified" : "Email not verified"}</span>
                </div>
              </div>
            </div>

            <div className="p-2">
              <Link href="/settings#teacher-profile" role="menuitem" onClick={() => setProfileOpen(false)} className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-700 focus-visible:bg-slate-50">
                <UserRound size={17} className="text-slate-400" />My Profile
              </Link>
              {logoutError && <p role="alert" className="mx-2 mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">{logoutError}</p>}
              <button type="button" role="menuitem" onClick={logout} disabled={loggingOut} className="mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60">
                <LogOut size={17} />{loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>}
        </div>
      </div>
    </header>
  );
}
