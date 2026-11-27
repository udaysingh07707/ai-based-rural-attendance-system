"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Camera, Check, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, Upload, Users, X } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

function dateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function AiAttendancePage() {
  const { students, classes, attendance, hydrated, dataError, reload, saveAttendance: persistAttendance } = useSchoolData();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(dateKey);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [presentIds, setPresentIds] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const roster = useMemo(() => students.filter((student) => student.classId === classId), [students, classId]);
  const key = `${date}:${classId}`;
  const existing = attendance[key] ?? {};

  useEffect(() => {
    if (!hydrated || !classes.length) return;
    if (!classes.some((item) => item.id === classId)) setClassId(classes[0].id);
  }, [classes, classId, hydrated]);

  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo]);

  function choosePhoto(file) {
    setPhotoError("");
    setSaveError("");
    setSaved(false);
    setReviewMode(false);
    setPresentIds([]);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Choose an image file to continue."); return; }
    if (file.size > 10 * 1024 * 1024) { setPhotoError("Photo must be 10 MB or smaller."); return; }
    setPhotoError("");
    setPhoto({ file, url: URL.createObjectURL(file) });
  }

  function clearPhoto() {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null); setReviewMode(false); setPresentIds([]); setSaved(false); setSaveError("");
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function togglePresent(id) {
    setPresentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setSaved(false);
  }

  async function saveReview() {
    if (!roster.length || !classId || !photo || saving) return;
    const next = Object.fromEntries(roster.map((student) => [student.id, presentIds.includes(student.id) ? "present" : "absent"]));
    setSaving(true);
    setSaveError("");
    try { await persistAttendance(classId, date, next); setSaved(true); }
    catch (error) { setSaveError(error.message || "Could not save attendance. Please try again."); }
    finally { setSaving(false); }
  }

  const previousMarked = roster.filter((student) => existing[student.id]).length;

  return <DashboardShell>
    <div className="mb-6"><p className="text-sm font-medium text-slate-500">Photo-assisted register</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">AI photo attendance</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Add a classroom photo, review the student roster, and confirm attendance before saving.</p></div>

    <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><p><strong>Photo-assisted manual attendance.</strong> Face recognition is not connected. The photo stays in this browser and is not uploaded. You will mark each student present or absent yourself, then confirm before attendance is saved.</p></div>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Class<select value={classId} disabled={!hydrated || Boolean(dataError) || classes.length === 0} onChange={(event) => { setClassId(event.target.value); setPresentIds([]); setReviewMode(false); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">{!hydrated ? <option value="">Loading classes…</option> : dataError ? <option value="">Classes unavailable</option> : classes.length === 0 ? <option value="">No classes available</option> : classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Attendance date<input type="date" max={dateKey()} value={date} onChange={(event) => { setDate(event.target.value); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          {photo ? <div className="relative flex h-full min-h-[268px] w-full flex-col items-center justify-center gap-3"><Image src={photo.url} width={1200} height={900} unoptimized alt="Selected classroom preview" className="max-h-[400px] max-w-full rounded-lg object-contain" /><div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ImagePlus size={16} />Replace photo</button><button type="button" onClick={clearPhoto} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><X size={16} />Remove photo</button></div></div> : <><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Camera size={26} /></span><h2 className="mt-4 text-base font-semibold text-slate-900">Add a classroom photo</h2><p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">Take a photo now or choose an existing image. JPG, PNG, or another image format up to 10 MB.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Camera size={17} />Take photo</button><button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ImagePlus size={17} />Choose photo</button></div></>}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          <input ref={uploadRef} type="file" accept="image/*" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
          {photoError && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{photoError}</p>}
        </div>

        <aside className="rounded-xl border border-slate-200 p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Users size={19} /></span><div><h2 className="font-semibold text-slate-900">Class roster</h2><p className="text-xs text-slate-500">{!hydrated && !dataError ? "Loading students…" : `${roster.length} students · ${previousMarked ? `${previousMarked} previously marked` : "Not yet marked"}`}</p></div></div>
          {dataError ? <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><div className="flex items-start gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>Classes and students could not be loaded: {dataError}</p></div><button type="button" onClick={() => reload().catch(() => {})} className="mt-3 text-sm font-semibold text-rose-900 underline">Try loading again</button></div> : !hydrated ? <div role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading this school’s class roster…</div> : !classes.length ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No active classes were found for this school. Add a class before reviewing attendance.</p> : !roster.length ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No active students are assigned to this class.</p> : <>
          <p className="mt-4 text-sm leading-5 text-slate-600">{reviewMode ? "Review the roster and mark each student present or absent." : "Choose a photo and class to begin the manual roster review. Attendance is saved only after you confirm."}</p>
          {!reviewMode ? <button type="button" disabled={!photo || !classId || !roster.length} onClick={() => { setReviewMode(true); setPresentIds(roster.filter((student) => existing[student.id] === "present").map((student) => student.id)); }} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"><Upload size={17} />Continue to roster review</button> : <><div className="mt-4 flex gap-2"><button type="button" onClick={() => { setPresentIds(roster.map((student) => student.id)); setSaved(false); }} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark all present</button><button type="button" onClick={() => { setPresentIds([]); setSaved(false); }} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark all absent</button></div><div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">{roster.map((student) => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={presentIds.includes(student.id)} onChange={() => togglePresent(student.id)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{student.name}</span><span className="mt-0.5 block text-xs text-slate-500">Roll {student.rollNumber}</span></span><span className={`text-xs font-semibold ${presentIds.includes(student.id) ? "text-emerald-700" : "text-slate-400"}`}>{presentIds.includes(student.id) ? "Present" : "Absent"}</span></label>)}</div><div className="mt-4 flex gap-2"><button type="button" onClick={saveReview} disabled={!roster.length || saving} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{saving ? "Saving attendance…" : "Confirm and save attendance"}</button><button type="button" onClick={() => { setReviewMode(false); setSaved(false); }} aria-label="Start roster review over" className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"><RotateCcw size={17} /></button></div><p className="mt-2 text-xs leading-5 text-slate-500">Saving writes Present or Absent for every student in this class and date, replacing any existing status for those students.</p></>}
          <p aria-live="polite" className="mt-3 min-h-5 text-xs text-slate-600">{saved ? "Attendance confirmed and added to reports." : reviewMode ? `${presentIds.length} present · ${roster.length - presentIds.length} absent` : photo ? "Photo ready. Review is manual; no faces are identified." : "Your photo stays in this browser session."}</p>
          </>}
        </aside>
      </div>
      {saveError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}
      {photo && <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><p className="truncate text-xs text-slate-600">Selected: {photo.file.name}</p><button type="button" onClick={clearPhoto} className="shrink-0 text-xs font-semibold text-brand-700 hover:text-brand-900">Remove photo</button></div>}
    </section>
  </DashboardShell>;
}
