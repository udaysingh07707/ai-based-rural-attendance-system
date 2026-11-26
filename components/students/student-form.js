export default function StudentForm({
  student,
  classes,
  nextId,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
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
