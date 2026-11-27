"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Camera, Check, ImagePlus, LoaderCircle, ShieldCheck, Trash2, Users } from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function dateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function FaceLocation({ face, photos, title }) {
  const photo = photos[face.photoIndex];
  const [x, y, width, height] = face.box;
  if (!photo || !face.imageWidth || !face.imageHeight) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-xs text-slate-500">{title} · photo {face.photoIndex + 1}</p>
      <div className="relative w-full max-w-[280px] overflow-hidden rounded-lg bg-slate-900" style={{ aspectRatio: `${face.imageWidth} / ${face.imageHeight}` }}>
        <Image src={photo.url} alt={`Photo ${face.photoIndex + 1} with marked face`} fill unoptimized className="object-contain" />
        <span aria-hidden="true" className="absolute border-2 border-amber-400" style={{ left: `${(x / face.imageWidth) * 100}%`, top: `${(y / face.imageHeight) * 100}%`, width: `${(width / face.imageWidth) * 100}%`, height: `${(height / face.imageHeight) * 100}%` }} />
      </div>
    </div>
  );
}

function AttendanceChoice({ student, status, onChange, suggestion }) {
  const initials = student.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
      {student.profilePhotoUrl && <Image src={student.profilePhotoUrl} alt={`${student.name} profile photo`} width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />}
      {!student.profilePhotoUrl && <span aria-label={`${student.name} initials`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{initials}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{student.name}</p>
        <p className="text-xs text-slate-500">Roll {student.rollNumber}</p>
      </div>
      {suggestion && <p className="text-xs text-slate-600">AI suggestion: <span className="font-semibold">{suggestion}</span></p>}
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">Teacher status
        <select value={status || ""} onChange={(event) => onChange(student.studentId, event.target.value)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs">
          <option value="" disabled>Select status</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
        </select>
      </label>
    </div>
  );
}

export default function AiAttendancePage() {
  const { students, classes, hydrated, dataError, reload, saveAttendance } = useSchoolData();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [date, setDate] = useState(dateKey);
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState("");
  const [recognitionError, setRecognitionError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [recognition, setRecognition] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const uploadRef = useRef(null);
  const cameraRef = useRef(null);
  const photosRef = useRef([]);
  const roster = useMemo(() => students.filter((student) => student.classId === classId), [students, classId]);

  useEffect(() => {
    if (!hydrated || !classes.length) return;
    if (!classes.some((item) => item.id === classId)) setClassId(classes[0].id);
  }, [classes, classId, hydrated]);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  function selectPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    setPhotoError("");
    setRecognitionError("");
    setSaveError("");
    setSaved(false);
    setRecognition(null);
    setStatuses({});
    if (!files.length) return;
    if (files.length > MAX_PHOTOS) {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
      setPhotoError(`Choose no more than ${MAX_PHOTOS} classroom photos.`);
      return;
    }
    if (files.some((file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_PHOTO_BYTES)) {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
      setPhotoError("Each photo must be a JPG, PNG, or WEBP image up to 10 MB.");
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
      setPhotoError("The total upload limit is 50 MB.");
      return;
    }
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos(files.map((file) => ({ file, url: URL.createObjectURL(file) })));
  }

  function removePhoto(index) {
    const removed = photos[index];
    if (removed) URL.revokeObjectURL(removed.url);
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setRecognition(null);
    setStatuses({});
    setSaved(false);
  }

  function clearPhotos() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setRecognition(null);
    setStatuses({});
    setSaved(false);
    setRecognitionError("");
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function analyzePhotos() {
    if (!photos.length || !classId || analyzing) return;
    setAnalyzing(true);
    setRecognitionError("");
    setSaveError("");
    setRecognition(null);
    setStatuses({});
    setSaved(false);
    const form = new FormData();
    form.set("classId", classId);
    photos.forEach(({ file }) => form.append("photos", file));
    try {
      const response = await fetch("/api/ai-attendance/recognize", { method: "POST", body: form, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Face recognition could not complete.");
      const suggestions = Object.fromEntries(result.detected.map((student) => [student.studentId, "present"]));
      setRecognition(result);
      setStatuses(suggestions);
    } catch (error) {
      setRecognitionError(error.message || "Face recognition could not complete. No attendance was changed.");
    } finally {
      setAnalyzing(false);
      if (uploadRef.current) uploadRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  function changeStatus(studentId, value) {
    setStatuses((current) => ({ ...current, [studentId]: value }));
    setSaved(false);
  }

  async function confirmAttendance() {
    if (!recognition || !classId || !roster.length || saving) return;
    const complete = Object.fromEntries(roster.map((student) => [student.id, statuses[student.id]]));
    if (Object.values(complete).some((status) => !["present", "absent"].includes(status))) {
      setSaveError("Review a Present or Absent status for every student before confirming.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await saveAttendance(classId, date, complete);
      setSaved(true);
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      setPhotos([]);
      setRecognition(null);
      setStatuses({});
    } catch (error) { setSaveError(error.message || "Could not save attendance."); }
    finally { setSaving(false); }
  }

  return <DashboardShell>
    <div className="mb-6"><p className="text-sm font-medium text-slate-500">Teacher-reviewed face matching</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">AI photo attendance</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">YuNet detects faces and SFace compares them with consented student templates enrolled for the selected class.</p></div>

    <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><ShieldCheck size={20} className="mt-0.5 shrink-0" /><p><strong>Teacher confirmation is required.</strong> Similarity scores are not probabilities. A student who is not detected is not proven absent. Unknown or ambiguous faces are never assigned automatically.</p></div>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Class<select value={classId} disabled={!hydrated || Boolean(dataError) || classes.length === 0 || analyzing} onChange={(event) => { setClassId(event.target.value); setRecognition(null); setStatuses({}); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">{!hydrated ? <option value="">Loading classes…</option> : dataError ? <option value="">Classes unavailable</option> : classes.length === 0 ? <option value="">No classes available</option> : classes.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.section}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Attendance date<input type="date" max={dateKey()} value={date} onChange={(event) => { setDate(event.target.value); setSaved(false); }} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" /></label>
      </div>

      {dataError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>School classes and students could not be loaded: {dataError} <button type="button" onClick={() => reload().catch(() => {})} className="font-semibold underline">Retry</button></p></div>}

      <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-900">Classroom photos</h2><p className="mt-1 text-xs leading-5 text-slate-500">Select 1–{MAX_PHOTOS} JPG, PNG, or WEBP photos, up to 10 MB each. They are processed in memory and are not stored.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={analyzing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Camera size={16} />Take photo</button>
            <button type="button" onClick={() => uploadRef.current?.click()} disabled={analyzing} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><ImagePlus size={16} />Choose photos</button>
          </div>
        </div>
        <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => selectPhotos(event.target.files)} />
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => selectPhotos(event.target.files)} />
        {photoError && <p role="alert" className="mt-3 text-sm text-red-700">{photoError}</p>}
        {photos.length > 0 && <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{photos.map((photo, index) => <div key={`${photo.file.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2"><Image src={photo.url} width={600} height={400} unoptimized alt={`Classroom photo ${index + 1}`} className="max-h-48 w-full rounded-md object-contain" /><div className="mt-2 flex items-center justify-between gap-2"><p className="truncate text-xs text-slate-600">{photo.file.name}</p><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove photo ${index + 1}`} className="rounded p-1 text-red-700 hover:bg-red-50"><Trash2 size={15} /></button></div></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={analyzePhotos} disabled={!classId || analyzing || !roster.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{analyzing ? <LoaderCircle size={17} className="animate-spin" /> : <Users size={17} />}{analyzing ? "Detecting and matching faces…" : "Detect faces and match students"}</button><button type="button" onClick={clearPhotos} disabled={analyzing} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Clear photos</button></div>
        </>}
      </div>

      {recognitionError && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p>{recognitionError} No attendance was changed. Manual attendance remains available in the Attendance section.</p></div>}
      {saved && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Teacher-confirmed attendance was saved. Classroom photos were discarded.</p>}

      {recognition && <div className="mt-6 space-y-5">
        <section aria-labelledby="detected-heading" className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="detected-heading" className="font-semibold text-slate-900">Detected Students ({recognition.detected.length})</h2><p className="text-xs text-slate-500">Actual matches only · similarity is not probability</p></div>
          {recognition.detected.length ? <div className="mt-3 space-y-3">{recognition.detected.map((student) => <div key={student.studentId} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center gap-3">{student.profilePhotoUrl ? <Image src={student.profilePhotoUrl} alt={`${student.name} profile photo`} width={44} height={44} unoptimized className="h-11 w-11 rounded-full object-cover" /> : <span aria-label={`${student.name} initials`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{student.name}</p><p className="text-xs text-slate-500">Roll {student.rollNumber} · Class {student.className} - {student.section}</p></div><p className="text-xs font-medium text-emerald-800">Status: Matched</p><p className="text-xs font-medium text-slate-700">Similarity (not probability): {student.similarity.toFixed(3)}</p><p className="w-full text-xs text-emerald-800">Suggested Present · seen in {student.duplicateAppearances ? `${student.duplicateAppearances + 1} photos` : `photo ${student.photoIndex + 1}`}</p><label className="flex items-center gap-2 text-xs font-medium text-slate-700">Teacher status<select value={statuses[student.studentId] || "present"} onChange={(event) => changeStatus(student.studentId, event.target.value)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2"><option value="present">Present</option><option value="absent">Absent</option></select></label></div><FaceLocation face={student} photos={photos} title="Matched face" /></div>)}</div> : <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600">No student faces matched. No students are marked Present by recognition.</p>}
        </section>

        <section aria-labelledby="not-detected-heading" className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="not-detected-heading" className="font-semibold text-slate-900">Not Detected ({recognition.notDetected.length})</h2><p className="text-xs text-amber-800">Non-detection does not prove absence.</p></div>
          {recognition.notDetected.length ? <div className="mt-3 space-y-2">{recognition.notDetected.map((student) => <AttendanceChoice key={student.studentId} student={student} status={statuses[student.studentId]} onChange={changeStatus} />)}</div> : <p className="mt-3 text-sm text-slate-600">Every student has a match. Review each result before confirming.</p>}
        </section>

        <section aria-labelledby="unknown-heading" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 id="unknown-heading" className="font-semibold text-slate-900">Unknown Faces ({recognition.unknown.length})</h2>
          {recognition.unknown.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2">{recognition.unknown.map((face) => <div key={`${face.photoIndex}-${face.faceIndex}`} className="rounded-lg border border-amber-200 bg-white p-3"><p className="text-sm font-medium text-slate-800">Unidentified face {face.faceIndex + 1} in photo {face.photoIndex + 1}</p><p className="mt-1 text-xs text-slate-500">No enrolled student matched this face. It was not assigned to anyone.</p><FaceLocation face={face} photos={photos} title="Unknown face location" /></div>)}</div> : <p className="mt-2 text-sm text-slate-600">No unknown faces were detected.</p>}
        </section>

        <section aria-labelledby="ambiguous-heading" className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <h2 id="ambiguous-heading" className="font-semibold text-slate-900">Ambiguous Faces ({recognition.ambiguous.length})</h2>
          {recognition.ambiguous.length ? <div className="mt-3 grid gap-4 sm:grid-cols-2">{recognition.ambiguous.map((face) => <div key={`${face.photoIndex}-${face.faceIndex}`} className="rounded-lg border border-orange-200 bg-white p-3"><p className="text-sm font-medium text-slate-800">Face {face.faceIndex + 1} in photo {face.photoIndex + 1} needs teacher review</p><ul className="mt-2 space-y-1 text-xs text-slate-600">{face.candidates.map((candidate) => <li key={candidate.studentId}>{candidate.name} · roll {candidate.rollNumber} · similarity {candidate.similarity.toFixed(3)}</li>)}</ul><FaceLocation face={face} photos={photos} title="Ambiguous face location" /></div>)}</div> : <p className="mt-2 text-sm text-slate-600">No ambiguous matches were detected.</p>}
        </section>

        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm font-medium text-slate-900">Review every class status before saving</p><p className="mt-1 text-xs leading-5 text-slate-600">AI suggestions do not change attendance by themselves. Choose Present or Absent for every student; a student not detected by AI has no default status. Confirming saves the selected status for the full active roster.</p><button type="button" onClick={confirmAttendance} disabled={saving || roster.some((student) => !["present", "absent"].includes(statuses[student.id]))} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{saving ? "Saving attendance…" : "Confirm and save attendance"}</button>{saveError && <p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}</div>
      </div>}
    </section>
  </DashboardShell>;
}
