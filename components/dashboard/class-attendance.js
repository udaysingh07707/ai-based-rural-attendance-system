export default function ClassAttendance({ classes }) {
  return (
    <section
      aria-labelledby="class-attendance-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="mb-5">
        <h2
          id="class-attendance-heading"
          className="text-base font-semibold text-slate-900"
        >
          Class-wise attendance
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Students present in each class today.
        </p>
      </div>
      <ul className="space-y-5">
        {classes.map((classItem) => {
          const percentage = Math.round(
            (classItem.present / classItem.total) * 100,
          );
          return (
            <li key={classItem.name}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">
                  {classItem.name}
                </span>
                <span className="shrink-0 text-slate-500">
                  {classItem.present}/{classItem.total}{" "}
                  <span className="font-semibold text-slate-700">
                    ({percentage}%)
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${classItem.name} attendance`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                className="h-2 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
