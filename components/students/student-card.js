import { Eye, Pencil, Trash2 } from "lucide-react";

export default function StudentCard({
  student,
  classLabel,
  onView,
  onEdit,
  onDelete,
}) {
  const initials = student.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-label={`${student.name} profile photo placeholder`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-900">{student.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{student.id}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Class</dt>
          <dd className="mt-1 font-medium text-slate-800">{classLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Roll number</dt>
          <dd className="mt-1 font-medium text-slate-800">{student.rollNumber}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onView}
          aria-label={`View details for ${student.name}`}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-700"
        >
          <Eye size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${student.name}`}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-brand-700"
        >
          <Pencil size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Archive ${student.name}`}
          className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
