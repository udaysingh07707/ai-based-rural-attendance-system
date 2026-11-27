"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { useSchoolData } from "../providers/school-data-provider";

export default function DashboardShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const { authStatus, authError, dataError, refreshSession, reload } = useSchoolData();

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="min-h-screen">
      {authStatus === "checking" ? <div role="status" className="flex min-h-[45vh] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-600"><LoaderCircle size={25} className="animate-spin text-brand-600" /><span>Checking your school account…</span><span className="text-xs text-slate-500">This check will time out and offer a retry if the service is unavailable.</span></div> : null}
      {authStatus === "error" ? <div className="mx-auto flex min-h-[45vh] max-w-lg flex-col items-center justify-center px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700"><AlertCircle size={23} /></span><h1 className="mt-4 text-lg font-semibold text-slate-900">We couldn’t check your account</h1><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{authError || "The account service is temporarily unavailable."}</p><button type="button" onClick={() => refreshSession()} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><RefreshCw size={16} />Try again</button><button type="button" onClick={() => router.replace("/login")} className="mt-3 text-sm font-medium text-slate-600 hover:text-slate-900">Return to sign in</button></div> : null}
      {authStatus === "unauthenticated" ? <div role="status" className="flex min-h-[45vh] items-center justify-center px-6 text-center text-sm text-slate-600">Sign-in required. Redirecting to the login page…</div> : null}
      {authStatus === "authenticated" ? <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div className="min-h-screen md:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
          {dataError && <div role="alert" className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"><span>{dataError} Your account is still verified; school data may be temporarily unavailable.</span><button type="button" onClick={() => reload().catch(() => {})} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900 hover:bg-amber-100"><RefreshCw size={15} />Retry data</button></div>}
          {children}
        </main>
      </div>
      </> : null}
    </div>
  );
}
