"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Trash2, Upload } from "lucide-react";
import Image from "next/image";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function StudentForm({
  student,
  classes,
  nextId,
  onSubmit,
  onCancel,
}) {
  const fileInputRef = useRef(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saveAsProfilePhoto, setSaveAsProfilePhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    setPhotoError("");
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
      setPhotoError("Choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setSelectedPhoto(file);
    setPhotoRemoved(false);
  }

  function clearEnrollmentPhoto() {
    setSelectedPhoto(null);
    setSaveAsProfilePhoto(false);
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeSavedProfilePhoto() {
    setPhotoRemoved(true);
    setSaveAsProfilePhoto(false);
  }

  function handleSubmit(event) {
    if (photoError) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  const existingPhotoUrl = student?.hasProfilePhoto
    ? `/api/students/${encodeURIComponent(student.id)}/photo`
    : "";
  const displayedPhotoUrl = photoPreview || (!photoRemoved ? existingPhotoUrl : "");

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label
          htmlFor="student-name"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Student name
        </label>
        <input
          id="student-name"
          name="name"
          required
          defaultValue={student?.name ?? ""}
          autoFocus
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="Enter full name"
        />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <label className="mb-3 block text-sm font-medium text-slate-700">
          Individual face-enrollment photo <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {displayedPhotoUrl ? (
            <Image
              src={displayedPhotoUrl}
              alt={`${student?.name || "Student"} profile preview`}
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-hidden="true">
              <ImagePlus size={26} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700">
              {selectedPhoto ? selectedPhoto.name : displayedPhotoUrl ? "Current saved profile photo" : "No photo selected"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG, or WEBP · up to 5 MB. This image is held temporarily and sent for face enrollment only after documented guardian consent.</p>
            <input
              ref={fileInputRef}
              id="student-enrollment-photo"
              name="enrollmentPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={selectPhoto}
              className="sr-only"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {selectedPhoto ? <RotateCcw size={15} /> : <Upload size={15} />}
                {selectedPhoto ? "Choose another enrollment photo" : "Choose enrollment photo"}
              </button>
              {selectedPhoto && (
                <button
                  type="button"
                  onClick={clearEnrollmentPhoto}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={15} /> Discard enrollment photo
                </button>
              )}
              {!photoRemoved && student?.hasProfilePhoto && (
                <button type="button" onClick={removeSavedProfilePhoto} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                  <Trash2 size={15} /> Remove saved profile photo
                </button>
              )}
            </div>
          </div>
        </div>
        {selectedPhoto && <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" name="saveAsProfilePhoto" value="true" checked={saveAsProfilePhoto} onChange={(event) => setSaveAsProfilePhoto(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" /><span>Also keep a separate copy as the student’s profile photo. Leave unchecked to discard the image after enrollment.</span></label>}
        <input type="hidden" name="profilePhotoAction" value={selectedPhoto && saveAsProfilePhoto ? "replace" : photoRemoved ? "remove" : "keep"} />
        {photoError && <p role="alert" className="mt-3 text-sm text-red-700">{photoError}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="student-class"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Class
          </label>
          <select
            id="student-class"
            name="classId"
            required
            defaultValue={student?.classId ?? classes[0]?.id ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {classes.map((classItem) => (
              <option key={classItem.id} value={classItem.id}>
                {classItem.name} - {classItem.section}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="student-roll"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Roll number
          </label>
          <input
            id="student-roll"
            name="rollNumber"
            required
            defaultValue={student?.rollNumber ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="e.g. 04"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="student-age"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Age
          </label>
          <input
            id="student-age"
            name="age"
            type="number"
            min="3"
            max="18"
            required
            defaultValue={student?.age ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Age in years"
          />
        </div>
        <div>
          <label
            htmlFor="student-guardian"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Parent or guardian
          </label>
          <input
            id="student-guardian"
            name="guardianName"
            required
            defaultValue={student?.guardianName ?? ""}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Enter guardian name"
          />
        </div>
      </div>

      {student && (
        <p className="text-xs text-slate-500">
          Student ID: <span className="font-medium text-slate-700">{student.id}</span>
        </p>
      )}
      {!student && (
        <p className="text-xs text-slate-500">
          A student ID ({nextId}) will be assigned automatically.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {student ? "Save changes" : "Add student"}
        </button>
      </div>
    </form>
  );
}
