"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import StudentCard from "../../components/students/student-card";
import StudentForm from "../../components/students/student-form";
import Modal from "../../components/common/modal";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";

function getNextStudentId(students) {
  const highestId = students.reduce((highest, student) => {
    const number = Number(student.id.replace("STU-", ""));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `STU-${String(highestId + 1).padStart(3, "0")}`;
}

export default function StudentsPage() {
  const { students, setStudents, classes } = useSchoolData();
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [formError, setFormError] = useState("");
  const nextId = getNextStudentId(students);

  const visibleStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery =
        !normalizedQuery ||
        [student.name, student.id, student.rollNumber]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesClass =
        classFilter === "all" || student.classId === classFilter;
      return matchesQuery && matchesClass;
    });
  }, [students, query, classFilter]);

  function getClassLabel(classId) {
    const classItem = classes.find((item) => item.id === classId);
    return classItem ? `${classItem.name} - ${classItem.section}` : "Unassigned";
  }

  function openForm(student = null) {
    setFormError("");
    setDialog({ type: student ? "edit" : "add", student });
  }

  function saveStudent(event) {
    event.preventDefault();
    setFormError("");
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const classId = String(formData.get("classId") ?? "");
    const rollNumber = String(formData.get("rollNumber") ?? "").trim();
    const age = Number(formData.get("age"));
    const guardianName = String(formData.get("guardianName") ?? "").trim();

    if (!name || !classId || !rollNumber || !guardianName || !Number.isInteger(age)) {
      setFormError("Complete all fields with valid student details.");
      return;
    }

    const duplicateRollNumber = students.some(
      (student) =>
        student.id !== dialog.student?.id &&
        student.classId === classId &&
        student.rollNumber.toLowerCase() === rollNumber.toLowerCase(),
    );
    if (duplicateRollNumber) {
      setFormError("That roll number is already used in this class.");
      return;
    }

    const studentDetails = {
      name,
      classId,
      rollNumber,
      age,
      guardianName,
    };

    if (dialog.type === "edit") {
      setStudents((current) =>
        current.map((student) =>
          student.id === dialog.student.id
            ? { ...student, ...studentDetails }
            : student,
        ),
      );
    } else {
      setStudents((current) => [
        { id: nextId, ...studentDetails },
        ...current,
      ]);
    }
    setDialog(null);
  }

  function deleteStudent(student) {
    const confirmed = window.confirm(
      `Delete ${student.name} (${student.id}) from the student list?`,
    );
    if (confirmed) {
      setStudents((current) =>
        current.filter((item) => item.id !== student.id),
      );
    }
  }

  const selectedStudent = dialog?.student;

  return (
    <DashboardShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">School directory</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Students
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Search, review, and manage student records.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openForm()}
          disabled={classes.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus size={18} aria-hidden="true" />
          Add student
        </button>
      </div>

      <section
        aria-label="Student directory"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Search students</span>
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, student ID, or roll number"
              className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="sm:w-52">
            <span className="sr-only">Filter by class</span>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">All classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} - {classItem.section}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-4 flex items-center justify-between text-sm">
          <p className="font-medium text-slate-700">
            {visibleStudents.length}{" "}
            {visibleStudents.length === 1 ? "student" : "students"}
          </p>
          <p className="text-xs text-slate-500">Sample records</p>
        </div>

        {visibleStudents.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleStudents.map((student) => (
              <li key={student.id}>
                <StudentCard
                  student={student}
                  classLabel={getClassLabel(student.classId)}
                  onView={() => setDialog({ type: "view", student })}
                  onEdit={() => openForm(student)}
                  onDelete={() => deleteStudent(student)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center">
            <p className="font-medium text-slate-800">No students found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try a different search or class filter.
            </p>
            {(query || classFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setClassFilter("all");
                }}
                className="mt-3 text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      {dialog?.type !== "view" && dialog && (
        <Modal
          key={dialog.type}
          title={dialog.type === "edit" ? "Edit student" : "Add student"}
          description="Student records are demo data and are not saved to a server."
          onClose={() => setDialog(null)}
        >
          {formError && (
            <p role="alert" className="mb-4 text-sm font-medium text-red-700">
              {formError}
            </p>
          )}
          <StudentForm
            student={selectedStudent}
            classes={classes}
            nextId={nextId}
            onSubmit={saveStudent}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}

      {dialog?.type === "view" && selectedStudent && (
        <Modal
          key="student-details"
          title="Student details"
          description="Sample student record."
          onClose={() => setDialog(null)}
        >
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">
              {selectedStudent.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">
                {selectedStudent.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{selectedStudent.id}</p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
            <div>
              <dt className="text-slate-500">Class</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {getClassLabel(selectedStudent.classId)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Roll number</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {selectedStudent.rollNumber}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Age</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {selectedStudent.age} years
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Parent or guardian</dt>
              <dd className="mt-1 font-medium text-slate-800">
                {selectedStudent.guardianName}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => openForm(selectedStudent)}
              className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Edit student
            </button>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
