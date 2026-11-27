"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, GraduationCap, Mail, ShieldCheck } from "lucide-react";
import { useSchoolData } from "../../components/providers/school-data-provider";

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useSchoolData();
  const [mode, setMode] = useState("SIGNUP");
  const [step, setStep] = useState("details");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  async function submitRegistration(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details = {
      purpose: "SIGNUP",
      firstName: String(form.get("firstName") || "").trim(),
      lastName: String(form.get("lastName") || "").trim(),
      schoolName: String(form.get("schoolName") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      password: String(form.get("password") || ""),
      confirmPassword: String(form.get("confirmPassword") || ""),
    };
    if (details.password !== details.confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }
    await requestCode(details);
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/login", {
        email: String(form.get("email") || "").trim().toLowerCase(),
        password: String(form.get("password") || ""),
      });
      const teacher = await refreshSession();
      if (!teacher) throw new Error("Your sign-in succeeded, but we couldn’t confirm the session. Please retry.");
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function requestCode(details) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/auth/otp/send", details);
      setEmail(details.email);
      setOtp("");
      setStep("verify");
      setMessage(`We sent a six-digit code to ${details.email}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/auth/otp/verify", { purpose: "SIGNUP", email, code: otp });
      const teacher = await refreshSession();
      if (!teacher) throw new Error("Your email is verified, but we couldn’t confirm the session. Please sign in.");
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  function resendCode() {
    requestCode({ purpose: "SIGNUP", email, resend: true });
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setStep("details");
    setOtp("");
    setError("");
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><GraduationCap size={24} /></span><span className="text-sm font-semibold tracking-wide">RURAL SCHOOL ATTENDANCE</span></div>
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">A calmer school day</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight xl:text-5xl">Attendance, organized for every classroom.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/80">Keep student records, mark daily attendance, and share clear reports with your school team.</p>
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-xs text-blue-100/70">TODAY’S REGISTER</p><p className="mt-1 font-semibold">Class 5 · Section A</p></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">Ready</span></div>
            <div className="mt-4 grid grid-cols-3 gap-3">{[["128", "Students"], ["5", "Classes"], ["90.6%", "Present"]].map(([value, label]) => <div key={label} className="rounded-xl bg-slate-950/20 p-3"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs text-blue-100/70">{label}</p></div>)}</div>
          </div>
        </div>
        <p className="relative text-xs text-blue-100/60">Simple tools for teachers. Clear records for your school.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white"><GraduationCap size={24} /></span><span className="text-sm font-bold text-slate-900">Rural School Attendance</span></div>
          <div className="mb-8"><p className="text-sm font-semibold text-blue-700">TEACHER WORKSPACE</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{step === "verify" ? "Check your email" : mode === "SIGNUP" ? "Create your account" : "Welcome back"}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{step === "verify" ? "Enter the one-time code to verify your email and finish creating your account." : mode === "SIGNUP" ? "Add your details and choose a password. We’ll email you a code to verify your address." : "Sign in with the email and password you registered."}</p></div>

          {step === "details" ? <>
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1"><button type="button" onClick={() => changeMode("SIGNUP")} aria-pressed={mode === "SIGNUP"} className={`min-h-10 rounded-lg text-sm font-semibold transition ${mode === "SIGNUP" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Create account</button><button type="button" onClick={() => changeMode("LOGIN")} aria-pressed={mode === "LOGIN"} className={`min-h-10 rounded-lg text-sm font-semibold transition ${mode === "LOGIN" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Sign in</button></div>

            {mode === "SIGNUP" ? <form className="space-y-4" onSubmit={submitRegistration}>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" name="firstName" placeholder="Rishav" autoComplete="given-name" required /><Field label="Last name" name="lastName" placeholder="Sharma" autoComplete="family-name" required /></div>
              <Field label="School name" name="schoolName" placeholder="Your school" autoComplete="organization" required />
              <Field label="Email address" name="email" type="email" placeholder="you@gmail.com" autoComplete="email" required />
              <PasswordField label="Password" name="password" visible={passwordVisible} onToggle={() => setPasswordVisible((visible) => !visible)} autoComplete="new-password" minLength={10} maxLength={72} required />
              <PasswordField label="Confirm password" name="confirmPassword" visible={confirmVisible} onToggle={() => setConfirmVisible((visible) => !visible)} autoComplete="new-password" minLength={10} maxLength={72} required />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"><Mail size={17} />{busy ? "Sending code…" : "Create account and email code"}<ArrowRight size={16} /></button>
            </form> : <form className="space-y-4" onSubmit={submitLogin}>
              <Field label="Email address" name="email" type="email" placeholder="you@gmail.com" autoComplete="email" required />
              <PasswordField label="Password" name="password" visible={passwordVisible} onToggle={() => setPasswordVisible((visible) => !visible)} autoComplete="current-password" required />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
            </form>}
            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />{mode === "SIGNUP" ? "Your account is saved only after email verification. We never ask for your Gmail password." : "Only email-verified accounts can sign in."}</p>
          </> : <>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm"><Mail size={18} /></span><div className="min-w-0"><p className="text-xs text-slate-500">Verification code sent to</p><p className="truncate text-sm font-semibold text-slate-900">{email}</p></div></div>
            {message && <p className="mb-4 text-sm text-emerald-700">{message}</p>}
            <form className="space-y-4" onSubmit={verifyCode}>
              <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Six-digit code</span><input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus className="min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-2xl font-semibold tracking-[0.45em] text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="000000" /></label>
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <button type="submit" disabled={busy || otp.length !== 6} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Verifying…" : <><Check size={17} />Verify email and continue</>}</button>
            </form>
            <div className="mt-5 flex items-center justify-between text-sm"><button type="button" onClick={() => { setStep("details"); setError(""); setOtp(""); }} className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"><ArrowLeft size={15} />Back to registration</button><button type="button" disabled={busy} onClick={() => requestCode({ purpose: "SIGNUP", email, resend: true })} className="font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50">Resend code</button></div>
            <p className="mt-4 text-xs leading-5 text-slate-500">The code expires after 10 minutes. You can request another code after 60 seconds.</p>
          </>}
          <p className="mt-10 text-center text-xs text-slate-400">Secure email verification · School Attendance</p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, name, type = "text", ...props }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span><input name={name} type={type} {...props} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>;
}

function PasswordField({ label, name, visible, onToggle, ...props }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span><span className="relative block"><input name={name} type={visible ? "text" : "password"} {...props} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>;
}

function ErrorMessage({ children }) {
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">{children}</p>;
}
