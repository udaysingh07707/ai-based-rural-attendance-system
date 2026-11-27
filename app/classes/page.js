"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, BookOpen, Pencil, Plus, Users } from "lucide-react";
import ClassForm from "../../components/classes/class-form";
import Modal from "../../components/common/modal";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

export default function ClassesPage() {
  const { classes, createClass, updateClass, deleteClass, students } = useSchoolData();
  const [dialog, setDialog] = useState(null);
  const [formError, setFormError] = useState("");

  function openForm(classItem = null) {
    setFormError("");
    setDialog({ type: classItem ? "edit" : "add", classItem });
  }

  async function saveClass(event) {
    event.preventDefault();
    setFormError("");
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const section = String(formData.get("section") ?? "").trim();

    if (!name || !section) {
      setFormError("Enter both a class name and section.");
      return;
    }

    const duplicate = classes.some(
      (item) =>
        item.id !== dialog.classItem?.id &&
        item.name.toLowerCase() === name.toLowerCase() &&
        item.section.toLowerCase() === section.toLowerCase(),
    );
    if (duplicate) {
      setFormError("That class and section already exist.");
      return;
    }

    try {
      if (dialog.type === "edit") await updateClass(dialog.classItem.id, { name, section });
      else await createClass({ name, section });
      setDialog(null);
    } catch (error) { setFormError(error.message); }
  }

  async function archiveClass(classItem) {
    const confirmed = window.confirm(`Archive ${classItem.name} - Section ${classItem.section}? Its attendance history will be preserved.`);
    if (!confirmed) return;
    try { await deleteClass(classItem.id); }
    catch (error) { window.alert(error.message || "Could not archive this class."); }
  }

  const selectedClass = dialog?.classItem;
  const selectedStudents = selectedClass
    ? students.filter((student) => student.classId === selectedClass.id)
    : [];

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">School directory</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Classes
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Organize class sections and view their student lists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={18} aria-hidden="true" />
          Add class
        </button>
      </div>

      <section aria-label="Class list">
        <div className="mb-4 flex items-center justify-between text-sm">
          <p className="font-medium text-slate-700">
            {classes.length} {classes.length === 1 ? "class" : "classes"}
          </p>
          <p className="text-xs text-slate-500">Saved to your school database</p>
        </div>

        {classes.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((classItem) => {
              const classStudents = students.filter(
                (student) => student.classId === classItem.id,
              );
              return (
                <li key={classItem.id}>
                  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <BookOpen size={21} aria-hidden="true" />
                      </span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openForm(classItem)} aria-label={`Edit ${classItem.name}, section ${classItem.section}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"><Pencil size={17} aria-hidden="true" /></button>
                        <button type="button" onClick={() => archiveClass(classItem)} aria-label={`Archive ${classItem.name}, section ${classItem.section}`} className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-800"><Archive size={17} aria-hidden="true" /></button>
                      </div>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">
                      {classItem.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Section {classItem.section}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="flex items-center gap-2 text-sm text-slate-600">
                        <Users size={17} aria-hidden="true" />
                        {classStudents.length}{" "}
                        {classStudents.length === 1 ? "student" : "students"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDialog({ type: "view", classItem })}
                        className="rounded-md px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                      >
                        View students
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <p className="font-medium text-slate-800">No classes yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add a class to start organizing student records.
            </p>
            <button
              type="button"
              onClick={() => openForm()}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Add your first class
            </button>
          </div>
        )}
      </section>

      {dialog?.type !== "view" && dialog && (
        <Modal
          key={dialog.type}
          title={dialog.type === "edit" ? "Edit class" : "Add class"}
          description="Class information is saved to your school database."
          onClose={() => setDialog(null)}
        >
          {formError && (
            <p role="alert" className="mb-4 text-sm font-medium text-red-700">
              {formError}
            </p>
          )}
          <ClassForm
            classItem={selectedClass}
            onSubmit={saveClass}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}

      {dialog?.type === "view" && selectedClass && (
        <Modal
          key="class-students"
          title={`${selectedClass.name} - Section ${selectedClass.section}`}
          description={`${selectedStudents.length} ${
            selectedStudents.length === 1 ? "student" : "students"
          } in this class.`}
          onClose={() => setDialog(null)}
        >
          {selectedStudents.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {selectedStudents.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {student.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{student.id}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Roll {student.rollNumber}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              No students have been assigned to this class yet.
            </p>
          )}
          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
            <Link
              href="/students"
              onClick={() => setDialog(null)}
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open student directory
            </Link>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
