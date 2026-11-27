"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import ClassAttendance from "../../components/dashboard/class-attendance";
import QuickActions from "../../components/dashboard/quick-actions";
import RecentActivity from "../../components/dashboard/recent-activity";
import StatCard from "../../components/dashboard/stat-card";

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSummary(signal) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?date=${localDateKey()}`, { signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load dashboard data.");
      setSummary(result);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Could not load dashboard data.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(controller.signal);
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    if (!summary) return { values: [], classRows: [], activities: [] };
    const values = [
      { label: "Total students", value: String(summary.totalStudents), detail: `Across ${summary.totalClasses} active classes`, color: "blue" },
      { label: "Present today", value: String(summary.today.present), detail: "Students marked present", color: "green" },
      { label: "Absent today", value: String(summary.today.absent), detail: "Students marked absent", color: "red" },
      { label: "Attendance rate", value: `${summary.today.attendancePercentage}%`, detail: `Among ${summary.today.markedStudents} students marked (late counts as attended)`, color: "amber" },
    ];
    const classRows = summary.classAttendance.map((item) => ({
      name: `${item.name} - ${item.section}`,
      total: item.markedStudents,
      present: item.present + item.late,
    }));
    const activities = summary.recentActivity.map((item) => ({
      name: item.studentName,
      className: item.className,
      status: item.status[0].toUpperCase() + item.status.slice(1),
      time: `${item.date} · ${new Date(item.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    }));
    return { values, classRows, activities };
  }, [summary]);

  return <DashboardShell>
    <div className="mb-7"><p className="text-sm font-medium text-slate-500">Daily overview</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">School attendance overview</h1><p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">Live figures from your school records for today.</p></div>
    {loading && !summary && <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-600"><LoaderCircle size={18} className="animate-spin text-brand-600" />Loading dashboard…</div>}
    {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => loadSummary()} className="inline-flex items-center gap-2 font-semibold"><RefreshCw size={15} />Retry</button></div>}
    {summary && <>
      <section aria-label="Today's attendance summary"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.values.map((stat) => <StatCard key={stat.label} stat={stat} />)}</div></section>
      <section className="mt-8" aria-labelledby="quick-actions-heading"><div className="mb-4"><h2 id="quick-actions-heading" className="text-lg font-semibold text-slate-900">Quick actions</h2><p className="mt-1 text-sm text-slate-500">Common tasks to get your school day started.</p></div><QuickActions /></section>
      <div className="mt-8 grid gap-6 xl:grid-cols-2"><ClassAttendance classes={stats.classRows} /><RecentActivity activities={stats.activities} /></div>
    </>}
  </DashboardShell>;
}
