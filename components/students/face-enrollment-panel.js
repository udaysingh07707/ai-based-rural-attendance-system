"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, ShieldCheck, Trash2, UserRoundSearch, Upload } from "lucide-react";

const MAX_ENROLLMENT_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function request(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The face enrollment request failed.");
  return result;
}

export default function FaceEnrollmentPanel({ student, initialPhoto = null, onPhotoConsumed = () => {} }) {
  const [status, setStatus] = useState(null);
  const [guardianName, setGuardianName] = useState(student.guardianName || "");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [consentReference, setConsentReference] = useState("");
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [enrollmentPhoto, setEnrollmentPhoto] = useState(initialPhoto);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);
  const endpoint = `/api/students/${encodeURIComponent(student.id)}/face-consent`;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setStatus(await request(endpoint)); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!enrollmentPhoto) {
      setPhotoPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(enrollmentPhoto);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [enrollmentPhoto]);

  function selectEnrollmentPhoto(event) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_ENROLLMENT_PHOTO_BYTES) {
      setError("Choose a non-empty JPG, PNG, or WEBP enrollment photo up to 5 MB.");
      event.target.value = "";
      return;
    }
    setEnrollmentPhoto(file);
    setNotice("");
  }

  function discardEnrollmentPhoto() {
    setEnrollmentPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onPhotoConsumed();
  }

  async function sendEnrollment(file) {
    const form = new FormData();
    form.set("enrollmentPhoto", file);
    await request(`/api/students/${encodeURIComponent(student.id)}/face-enrollment`, { method: "POST", body: form });
    setEnrollmentPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onPhotoConsumed();
  }

  async function recordConsent(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guardianName, guardianRelationship, consentReference, guardianConfirmed }),
      });
      setGuardianConfirmed(false);
      if (enrollmentPhoto) {
        try {
          await sendEnrollment(enrollmentPhoto);
          setNotice("Documented guardian consent was recorded and the encrypted face template was enrolled.");
        } catch (enrollmentError) {
          setError(`Consent was recorded, but face enrollment failed: ${enrollmentError.message}`);
        }
      } else {
        setNotice("Guardian consent recorded. Choose a temporary individual photo to enroll the face template.");
      }
      await reload();
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  async function enroll() {
    if (!enrollmentPhoto) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await sendEnrollment(enrollmentPhoto);
      setNotice("The encrypted face template was enrolled. The temporary enrollment photo was discarded.");
      await reload();
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  async function revoke() {
    if (!window.confirm(`Revoke face-recognition consent for ${student.name}? Their face template will be deleted. Manual attendance will remain available.`)) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await request(endpoint, { method: "DELETE" });
      setNotice("Consent revoked and the enrolled face template deleted.");
      await reload();
    } catch (requestError) { setError(requestError.message); }
    finally { setWorking(false); }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="face-enrollment-heading">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700"><ShieldCheck size={19} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="face-enrollment-heading" className="font-semibold text-slate-900">Face recognition consent and enrollment</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">A profile photo is not biometric consent. Only record consent after the school has documented guardian authorization. The enrollment image is sent temporarily; only the encrypted face template is stored for recognition.</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-xs font-medium text-slate-700">Temporary individual enrollment photo
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectEnrollmentPhoto} className="mt-2 block w-full text-xs" />
        </label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WEBP up to 5 MB. The image is not saved to PostgreSQL or disk by enrollment.</p>
        {photoPreview && <div className="mt-3 flex items-center gap-3"><Image src={photoPreview} alt="Temporary enrollment photo preview" width={64} height={64} unoptimized className="h-16 w-16 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate text-xs text-slate-600">{enrollmentPhoto?.name}</span><button type="button" onClick={discardEnrollmentPhoto} className="inline-flex items-center gap-1 text-xs font-medium text-red-700"><Trash2 size={14} /> Discard</button></div>}
      </div>

      {loading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" />Loading consent status…</p> : status?.consent ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-sm">
          <p className="font-medium text-emerald-800">Guardian consent recorded</p>
          <p className="mt-1 text-xs text-slate-600">{status.consent.guardianName} · {status.consent.guardianRelationship} · consent record {status.consent.consentReference} · {new Date(status.consent.grantedAt).toLocaleDateString()}</p>
          <p className="mt-2 text-xs text-slate-600">{status.enrolled ? `Face template enrolled (${status.modelVersion}).` : "No face template is enrolled for the current consent."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(!status.enrolled || enrollmentPhoto) && <button type="button" disabled={working || !enrollmentPhoto} onClick={enroll} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><UserRoundSearch size={15} />{working ? "Enrolling…" : status.enrolled ? "Replace face template" : "Enroll temporary photo"}</button>}
            <button type="button" disabled={working} onClick={revoke} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} />Revoke and delete template</button>
          </div>
        </div>
      ) : (
        <form onSubmit={recordConsent} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs leading-5 text-slate-600">Record the guardian’s authorization from the school’s consent process. Do not proceed if consent has not been obtained. A selected image will be enrolled only after consent is recorded.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-700">Consenting guardian<input required maxLength={120} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
            <label className="text-xs font-medium text-slate-700">Relationship to student<input required maxLength={80} value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} placeholder="Parent, guardian…" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
            <label className="text-xs font-medium text-slate-700 sm:col-span-2">School consent record reference<input required maxLength={120} value={consentReference} onChange={(event) => setConsentReference(event.target.value)} placeholder="Paper form number or school register reference" className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
          </div>
          <label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" required checked={guardianConfirmed} onChange={(event) => setGuardianConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" /><span>I confirm appropriate guardian consent for face recognition has been documented by the school.</span></label>
          <button type="submit" disabled={working} className="min-h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{working ? "Recording consent…" : enrollmentPhoto ? "Record consent and enroll photo" : "Record guardian consent"}</button>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}
    </section>
  );
}
