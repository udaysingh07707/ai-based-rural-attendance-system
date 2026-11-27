"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ChevronRight,
  Globe2,
  GraduationCap,
  Info,
  LogOut,
  Mic,
  ShieldCheck,
  UserRound,
  Volume2,
} from "lucide-react";
import DashboardShell from "../../components/layout/dashboard-shell";
import { useSchoolData } from "../../components/providers/school-data-provider";
import {
  DEFAULT_SETTINGS_PREFERENCES,
  readSettingsPreferences,
  writeSettingsPreferences,
} from "../../components/settings/settings-preferences";

export default function SettingsPage() {
  const router = useRouter();
  const { teacher, updateTeacher } = useSchoolData();
  const [preferences, setPreferences] = useState(DEFAULT_SETTINGS_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    setPreferences(readSettingsPreferences());
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    setProfileName(teacher?.name || "");
    setSchoolName(teacher?.school?.name || "");
  }, [teacher?.name, teacher?.school?.name]);

  function updatePreference(key, value) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaved(writeSettingsPreferences(next));
  }

  async function saveAccountDetails(updates) {
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save account details.");
      updateTeacher(result.teacher);
      setSettingsMessage("Account details saved.");
    } catch (error) {
      setSettingsError(error.message || "Could not save account details.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(error.message || "Could not sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <DashboardShell>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Your workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review your account and manage preferences for this browser.</p>
        </div>
        {preferencesReady && saved && <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check size={16} /> Preferences saved on this device</p>}
      </div>

      <div className="mb-6 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-5 text-blue-950">
        <Info size={19} className="mt-0.5 shrink-0 text-blue-700" />
        <p>Language and voice preferences are stored only in this browser. Notification options are preference placeholders; this app does not currently send notifications.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsCard id="teacher-profile" icon={UserRound} title="Teacher profile" description="Account details from your verified sign-in.">
          <InfoRow label="Name" value={teacher?.name || "Loading account…"} />
          <InfoRow label="Email address" value={teacher?.email || "—"} />
          <InfoRow label="Email verification" value={teacher?.emailVerifiedAt ? "Verified" : "Not available"} valueClass={teacher?.emailVerifiedAt ? "text-emerald-700" : "text-slate-500"} />
          <label className="block text-sm font-medium text-slate-700">Update display name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={160} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <button type="button" disabled={settingsBusy || !profileName.trim()} onClick={() => saveAccountDetails({ name: profileName })} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{settingsBusy ? "Saving…" : "Save profile"}</button>
        </SettingsCard>

        <SettingsCard icon={GraduationCap} title="School information" description="School associated with this teacher account.">
          <InfoRow label="School name" value={teacher?.school?.name || "Loading school…"} />
          <InfoRow label="Account role" value={teacher?.role || "Teacher"} />
          <label className="block text-sm font-medium text-slate-700">Update school name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} maxLength={120} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          <button type="button" disabled={settingsBusy || !schoolName.trim()} onClick={() => saveAccountDetails({ schoolName })} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{settingsBusy ? "Saving…" : "Save school"}</button>
        </SettingsCard>

        <SettingsCard icon={Globe2} title="Language preference" description="Choose the spoken language used by voice recognition.">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Voice input language</span>
            <select value={preferences.language} onChange={(event) => updatePreference("language", event.target.value)} disabled={!preferencesReady} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 disabled:opacity-60">
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">हिन्दी (भारत)</option>
            </select>
          </label>
          <p className="mt-3 text-xs leading-5 text-slate-500">The rest of the interface currently remains in English. This preference is saved in this browser.</p>
        </SettingsCard>

        <SettingsCard icon={Mic} title="Voice assistant" description="Enable voice navigation and set its preferred language.">
          <PreferenceToggle label="Enable voice assistant" description="Show the voice assistant in the workspace toolbar." checked={preferences.voiceAssistantEnabled} disabled={!preferencesReady} onChange={(value) => updatePreference("voiceAssistantEnabled", value)} />
          <InfoRow label="Preferred spoken language" value={preferences.language === "hi-IN" ? "हिन्दी (भारत)" : "English (India)"} />
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><Volume2 size={15} className="mt-0.5 shrink-0" /><p>Voice navigation uses your browser’s speech recognition support. This preference is stored locally and does not change server account data.</p></div>
        </SettingsCard>

        <SettingsCard icon={Bell} title="Notification preferences" description="These choices are saved locally but do not send notifications.">
          <PreferenceToggle label="Email notifications" description="Preference only; email notifications are not connected." checked={preferences.emailNotifications} disabled={!preferencesReady} onChange={(value) => updatePreference("emailNotifications", value)} />
          <PreferenceToggle label="Attendance reminders" description="Preference only; reminders are not connected." checked={preferences.attendanceReminders} disabled={!preferencesReady} onChange={(value) => updatePreference("attendanceReminders", value)} />
          <ReadOnlyNote>Changing these options does not enable email, push, or browser notifications.</ReadOnlyNote>
        </SettingsCard>

        <SettingsCard icon={ShieldCheck} title="Account and sign out" description="Manage the current browser session.">
          <InfoRow label="Signed in as" value={teacher?.email || "Loading account…"} />
          <InfoRow label="Password changes" value="Not available yet" valueClass="text-slate-500" />
          {logoutError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{logoutError}</p>}
          <button type="button" onClick={logout} disabled={loggingOut} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
            <LogOut size={17} />{loggingOut ? "Signing out…" : "Sign out"}<ChevronRight size={16} />
          </button>
        </SettingsCard>
      </div>
      {settingsError && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{settingsError}</p>}
      {settingsMessage && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{settingsMessage}</p>}
    </DashboardShell>
  );
}

function SettingsCard({ id, icon: Icon, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-card sm:p-6" aria-label={title}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={19} aria-hidden="true" /></span>
        <div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, valueClass = "text-slate-900" }) {
  return <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="text-sm text-slate-500">{label}</span><span className={`break-all text-sm font-medium sm:text-right ${valueClass}`}>{value}</span></div>;
}

function PreferenceToggle({ label, description, checked, disabled, onChange }) {
  return <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 p-3.5 ${disabled ? "opacity-60" : "hover:bg-slate-50"}`}>
    <span><span className="block text-sm font-medium text-slate-800">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
  </label>;
}

function ReadOnlyNote({ children }) {
  return <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">{children}</p>;
}
