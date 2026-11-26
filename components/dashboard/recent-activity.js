const statusStyles = {
  Present: "bg-green-50 text-green-700",
  Absent: "bg-red-50 text-red-700",
};

export default function RecentActivity({ activities }) {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6"
    >
      <div className="mb-5">
        <h2
          id="recent-activity-heading"
          className="text-base font-semibold text-slate-900"
        >
          Recent attendance activity
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Latest student attendance updates.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {activities.map((activity) => (
          <li
            key={`${activity.name}-${activity.time}`}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600"
            >
              {activity.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">
                {activity.name}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {activity.className} · {activity.time}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[activity.status]}`}
            >
              {activity.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
