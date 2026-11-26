"use client";

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

export default function ReportsPage() {
  const { attendance, students, classes } = useSchoolData();
  const [classId, setClassId] = useState("all");
  const [date, setDate] = useState("");
  const records = useMemo(() => Object.entries(attendance).flatMap(([key, statuses]) => {
    const [recordDate, recordClassId] = key.split(":");
    if ((date && recordDate !== date) || (classId !== "all" && classId !== recordClassId)) return [];
    const classItem = classes.find((item) => item.id === recordClassId);
    return Object.entries(statuses).map(([studentId, status]) => {
      const student = students.find((item) => item.id === studentId);
      return student ? { date: recordDate, className: classItem ? `${classItem.name} - ${classItem.section}` : "Class", student, status } : null;
    }).filter(Boolean);
  }).sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className) || a.student.rollNumber.localeCompare(b.student.rollNumber)), [attendance, classes, students, date, classId]);
  const present = records.filter((record) => record.status === "present").length;
  const absent = records.filter((record) => record.status === "absent").length;
  const rate = records.length ? Math.round((present / records.length) * 1000) / 10 : 0;

  function exportCsv() {
    const rows = [["Date", "Class", "Student ID", "Student", "Roll number", "Status"], ...records.map((r) => [r.date, r.className, r.student.id, r.student.name, r.student.rollNumber, r.status])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "attendance-report.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <DashboardShell>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-slate-500">Attendance records</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Reports</h1><p className="mt-2 text-sm text-slate-600">Review attendance by date and class, and export a CSV copy.</p></div><button type="button" onClick={exportCsv} disabled={!records.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Download size={17} />Export CSV</button></div>
    <section aria-label="Report filters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Class<select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="all">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Summary label="Present" value={present} color="text-emerald-700" /><Summary label="Absent" value={absent} color="text-rose-700" /><Summary label="Attendance rate" value={`${rate}%`} color="text-brand-700" /></div>
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{records.map((record) => <tr key={`${record.date}:${record.student.id}`}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{record.date}</td><td className="px-4 py-3"><p className="font-medium text-slate-900">{record.student.name}</p><p className="mt-0.5 text-xs text-slate-500">Roll {record.student.rollNumber} · {record.student.id}</p></td><td className="px-4 py-3 text-slate-600">{record.className}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "present" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{record.status === "present" ? "Present" : "Absent"}</span></td></tr>)}</tbody></table>{!records.length && <div className="px-4 py-12 text-center"><FileText className="mx-auto text-slate-400" size={25} /><p className="mt-3 font-medium text-slate-800">No attendance records found</p><p className="mt-1 text-sm text-slate-500">Take attendance first, or adjust the selected filters.</p></div>}</div><p className="mt-4 text-xs leading-5 text-slate-500">Reports include the attendance records currently available in this demo session.</p></section>
  </DashboardShell>;
}

function Summary({ label, value, color }) { return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>; }
