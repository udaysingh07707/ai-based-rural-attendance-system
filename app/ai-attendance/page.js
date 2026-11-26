"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ImagePlus, RotateCcw, ShieldCheck, Upload, Users, X } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

function dateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function AiAttendancePage() {
  const { students, classes, attendance, setAttendance } = useSchoolData();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(dateKey);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [presentIds, setPresentIds] = useState([]);
  const [saved, setSaved] = useState(false);
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const roster = useMemo(() => students.filter((student) => student.classId === classId), [students, classId]);
  const key = `${date}:${classId}`;
  const existing = attendance[key] ?? {};

  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo]);

  function choosePhoto(file) {
    setPhotoError("");
    setSaved(false);
    setReviewMode(false);
    setPresentIds([]);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Choose an image file to continue."); return; }
    if (file.size > 10 * 1024 * 1024) { setPhotoError("Photo must be 10 MB or smaller."); return; }
    setPhoto({ file, url: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null); setReviewMode(false); setPresentIds([]); setSaved(false);
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function togglePresent(id) {
    setPresentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setSaved(false);
  }

  function saveReview() {
    if (!roster.length) return;
    const next = Object.fromEntries(roster.map((student) => [student.id, presentIds.includes(student.id) ? "present" : "absent"]));
    setAttendance((current) => ({ ...current, [key]: next }));
    setSaved(true);
  }

  const previousMarked = roster.filter((student) => existing[student.id]).length;

  return <DashboardShell>
    <div className="mb-6"><p className="text-sm font-medium text-slate-500">Photo-assisted register</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">AI photo attendance</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Add a classroom photo, review the student roster, and confirm attendance before saving.</p></div>

    <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><p><strong>Interface preview.</strong> Photo matching is not connected yet. This screen does not identify faces or upload photos. You will select present students yourself; everyone else in the selected class will be marked absent when you save.</p></div>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Class<select value={classId} onChange={(event) => { setClassId(event.target.value); setPresentIds([]); setReviewMode(false); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Attendance date<input type="date" max={dateKey()} value={date} onChange={(event) => { setDate(event.target.value); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          {photo ? <div className="relative flex h-full min-h-[268px] w-full items-center justify-center"><img src={photo.url} alt="Selected classroom preview" className="max-h-[440px] max-w-full rounded-lg object-contain" /><button type="button" onClick={clearPhoto} aria-label="Remove selected photo" className="absolute right-2 top-2 rounded-full bg-white p-2 text-slate-600 shadow hover:bg-slate-100"><X size={18} /></button></div> : <><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Camera size={26} /></span><h2 className="mt-4 text-base font-semibold text-slate-900">Add a classroom photo</h2><p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">Take a photo now or choose an existing image. JPG, PNG, or another image format up to 10 MB.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Camera size={17} />Take photo</button><button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ImagePlus size={17} />Choose photo</button></div></>}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <input ref={uploadRef} type="file" accept="image/*" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          {photoError && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{photoError}</p>}
        </div>

        <aside className="rounded-xl border border-slate-200 p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Users size={19} /></span><div><h2 className="font-semibold text-slate-900">Class roster</h2><p className="text-xs text-slate-500">{roster.length} students · {previousMarked ? `${previousMarked} previously marked` : "Not yet marked"}</p></div></div><p className="mt-4 text-sm leading-5 text-slate-600">{reviewMode ? "Select every student visible in the classroom photo." : "Choose a photo to begin the review. Attendance is saved only after you confirm the roster."}</p>
          {!reviewMode ? <button type="button" disabled={!photo || !roster.length} onClick={() => { setReviewMode(true); setPresentIds(roster.filter((student) => existing[student.id] === "present").map((student) => student.id)); }} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={17} />Continue to roster review</button> : <><div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">{roster.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={presentIds.includes(student.id)} onChange={() => togglePresent(student.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{student.name}</span><span className="mt-0.5 block text-xs text-slate-500">Roll {student.rollNumber}</span></span><span className={`text-xs font-semibold ${presentIds.includes(student.id) ? "text-emerald-700" : "text-slate-400"}`}>{presentIds.includes(student.id) ? "Present" : "Absent"}</span></label>)}</div><div className="mt-4 flex gap-2"><button type="button" onClick={saveReview} disabled={!roster.length} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Check size={17} />Confirm attendance</button><button type="button" onClick={() => { setReviewMode(false); setSaved(false); }} aria-label="Start roster review over" className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"><RotateCcw size={17} /></button></div></>}
          <p aria-live="polite" className="mt-3 min-h-5 text-xs text-slate-600">{saved ? "Attendance confirmed and added to reports." : reviewMode ? `${presentIds.length} present · ${roster.length - presentIds.length} absent` : "Your photo stays in this browser session."}</p>
        </aside>
      </div>
      {photo && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><p className="truncate text-xs text-slate-600">Selected: {photo.file.name}</p><button type="button" onClick={clearPhoto} className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-900">Remove photo</button></div>}
    </section>
  </DashboardShell>;
}
