import { Users, UserCheck, UserX, ChartNoAxesColumnIncreasing } from "lucide-react";

const icons = {
  blue: Users,
  green: UserCheck,
  red: UserX,
  amber: ChartNoAxesColumnIncreasing,
};

const colorStyles = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
};

export default function StatCard({ stat }) {
  const Icon = icons[stat.color];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{stat.label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {stat.value}
          </p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorStyles[stat.color]}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{stat.detail}</p>
    </article>
  );
}
