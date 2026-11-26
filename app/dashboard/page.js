import DashboardShell from "../../components/layout/dashboard-shell";
import ClassAttendance from "../../components/dashboard/class-attendance";
import QuickActions from "../../components/dashboard/quick-actions";
import RecentActivity from "../../components/dashboard/recent-activity";
import StatCard from "../../components/dashboard/stat-card";
import {
  attendanceActivity,
  attendanceSummary,
  classAttendance,
} from "../../lib/mock-data";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="mb-7">
        <p className="text-sm font-medium text-slate-500">Daily overview</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Good morning, Teacher
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          Here is your school attendance overview for today.
        </p>
      </div>

      <section aria-label="Today's attendance summary">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {attendanceSummary.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="quick-actions-heading">
        <div className="mb-4">
          <h2
            id="quick-actions-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Quick actions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Common tasks to get your school day started.
          </p>
        </div>
        <QuickActions />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ClassAttendance classes={classAttendance} />
        <RecentActivity activities={attendanceActivity} />
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Dashboard figures and activity are sample data for demonstration.
      </p>
    </DashboardShell>
  );
}
