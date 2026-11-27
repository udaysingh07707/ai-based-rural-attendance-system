"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

export default function ReportsPage() {
  const { classes } = useSchoolData();
  const [classId, setClassId] = useState("all");
  const [period, setPeriod] = useState("daily");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ period, classId });
    if (period === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (date) params.set("date", date);
    return params.toString();
  }, [period, classId, date, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/reports?${query}`, { signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not load attendance report.");
        setReport(result);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load attendance report.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [query]);

  function exportCsv() {
    const rows = [["Date", "Class", "Student ID", "Student", "Roll number", "Status"], ...(report?.records ?? []).map((record) => [record.date, record.className, record.studentId, record.studentName, record.rollNumber, record.status])];
    const safeCell = (value) => {
      const text = String(value);
      const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${protectedText.replaceAll('"', '""')}"`;
    };
    const csv = rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-report-${report?.from || "range"}-${report?.to || ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = report?.counts ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0, attendancePercentage: 0 };

  return <DashboardShell>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-slate-500">Attendance records</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reports</h1><p className="mt-2 text-sm text-slate-600">{report ? `${report.from} to ${report.to} · ${counts.total} records` : "Review attendance by date and class, and export a CSV copy."}</p></div><button type="button" onClick={exportCsv} disabled={!report?.records.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={17} />Export CSV</button></div>

    <section aria-label="Report filters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom range</option></select></label>
        <label className="text-sm font-medium text-slate-700">Class<select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}</select></label>
        {period === "custom" ? <><label className="text-sm font-medium text-slate-700">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-sm font-medium text-slate-700">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label></> : <label className="text-sm font-medium text-slate-700">{period === "daily" ? "Date" : "Week or month containing"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Present" value={counts.present} color="text-emerald-700" />
        <Summary label="Absent" value={counts.absent} color="text-rose-700" />
        <Summary label="Late" value={counts.late} color="text-amber-700" />
        <Summary label="Excused" value={counts.excused} color="text-blue-700" />
        <Summary label="Attendance rate" value={`${counts.attendancePercentage}%`} color="text-brand-700" />
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Marked</th></tr></thead><tbody className="divide-y divide-slate-100">{(report?.records ?? []).map((record) => <tr key={`${record.date}:${record.classId}:${record.studentId}`}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{record.date}</td><td className="px-4 py-3"><p className="font-medium text-slate-900">{record.studentName}</p><p className="mt-0.5 text-xs text-slate-500">Roll {record.rollNumber} · {record.studentId}</p></td><td className="px-4 py-3 text-slate-600">{record.className}</td><td className="px-4 py-3 capitalize text-slate-700">{record.status}</td><td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(record.markedAt).toLocaleString()}</td></tr>)}</tbody></table>{loading ? <div role="status" className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading report…</div> : !report?.records.length && <div className="px-4 py-12 text-center"><FileText className="mx-auto text-slate-400" size={25} /><p className="mt-3 font-medium text-slate-800">No attendance records found</p><p className="mt-1 text-sm text-slate-500">Take attendance first, or adjust the selected filters.</p></div>}</div><p className="mt-4 text-xs leading-5 text-slate-500">Reports include archived students’ historical records.</p>
    </section>
  </DashboardShell>;
}

function Summary({ label, value, color }) { return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>; }
