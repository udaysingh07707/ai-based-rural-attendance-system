"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, CheckCheck, Users } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const { students, classes, attendance, setAttendance } = useSchoolData();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(todayKey);
  const [saved, setSaved] = useState(false);
  const classStudents = useMemo(() => students.filter((student) => student.classId === classId), [students, classId]);
  const recordKey = `${date}:${classId}`;
  const statuses = attendance[recordKey] ?? {};
  const markedCount = classStudents.filter((student) => statuses[student.id]).length;
  const presentCount = classStudents.filter((student) => statuses[student.id] === "present").length;

  function markAll(status) {
    setAttendance((current) => ({ ...current, [recordKey]: Object.fromEntries(classStudents.map((student) => [student.id, status])) }));
    setSaved(false);
  }

  function setStatus(studentId, status) {
    setAttendance((current) => ({ ...current, [recordKey]: { ...(current[recordKey] ?? {}), [studentId]: status } }));
    setSaved(false);
  }

  function saveAttendance() {
    if (!classStudents.length || markedCount !== classStudents.length) return;
    setSaved(true);
  }

  return (
    <DashboardShell>
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Daily records</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Take attendance</h1>
        <p className="mt-2 text-sm text-slate-600">Choose a class and date, then mark each student present or absent.</p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Class
            <select value={classId} onChange={(event) => { setClassId(event.target.value); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Attendance date
            <span className="relative mt-1.5 block"><CalendarDays size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input type="date" value={date} max={todayKey()} onChange={(event) => { setDate(event.target.value); setSaved(false); }} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm" /></span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-600"><Users size={17} /><span>{classStudents.length} students</span><span aria-hidden="true">·</span><span>{presentCount} present</span><span aria-hidden="true">·</span><span>{classStudents.length - presentCount} absent</span></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => markAll("present")} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Mark all present</button>
            <button type="button" onClick={() => markAll("absent")} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Mark all absent</button>
          </div>
        </div>
        {classStudents.length ? <ul className="divide-y divide-slate-100">
          {classStudents.map((student) => <li key={student.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium text-slate-900">{student.name}</p><p className="mt-1 text-xs text-slate-500">Roll {student.rollNumber} · {student.id}</p></div>
            <div className="flex gap-2" role="group" aria-label={`Attendance for ${student.name}`}>
              {[ ["present", "Present"], ["absent", "Absent"] ].map(([value, label]) => <button key={value} type="button" aria-pressed={statuses[student.id] === value} onClick={() => setStatus(student.id, value)} className={`min-h-10 min-w-24 rounded-lg border px-3 text-sm font-semibold ${statuses[student.id] === value ? value === "present" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-rose-600 bg-rose-50 text-rose-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}
            </div>
          </li>)}
        </ul> : <p className="py-10 text-center text-sm text-slate-500">No students are assigned to this class yet.</p>}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite" className="text-sm text-slate-600">{saved ? "Attendance saved for this session." : markedCount < classStudents.length ? `Mark all ${classStudents.length} students to save (${markedCount} of ${classStudents.length} marked).` : "All students are marked. Review and save the register."}</p>
          <button type="button" disabled={!classStudents.length || markedCount !== classStudents.length} onClick={saveAttendance} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Check size={18} />Save attendance</button>
        </div>
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><CheckCheck size={14} className="mr-1 inline" />Demo records are held in memory and reset when the page reloads. Persistent storage and offline sync are planned for a later phase.</p>
      </section>
    </DashboardShell>
  );
}
