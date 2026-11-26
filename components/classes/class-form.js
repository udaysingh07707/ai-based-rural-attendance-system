export default function ClassForm({ classItem, onSubmit, onCancel }) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label
          htmlFor="class-name"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Class name
        </label>
        <input
          id="class-name"
          name="name"
          required
          autoFocus
          defaultValue={classItem?.name ?? ""}
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="e.g. Class 6"
        />
      </div>
      <div>
        <label
          htmlFor="class-section"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Section
        </label>
        <input
          id="class-section"
          name="section"
          required
          maxLength={10}
          defaultValue={classItem?.section ?? ""}
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="e.g. A"
        />
      </div>
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
          {classItem ? "Save changes" : "Add class"}
        </button>
      </div>
    </form>
  );
}
