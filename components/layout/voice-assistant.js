"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Mic, MicOff, X } from "lucide-react";
import {
  readSettingsPreferences,
  SETTINGS_PREFERENCES_EVENT,
  writeSettingsPreferences,
} from "../settings/settings-preferences";

const COMMANDS = [
  { label: "Open dashboard", hindi: "डैशबोर्ड खोलो", phrases: ["open dashboard", "show dashboard", "डैशबोर्ड खोलो", "डैशबोर्ड दिखाओ"], href: "/dashboard" },
  { label: "Open students", hindi: "छात्र सूची खोलो", phrases: ["open students", "show students", "student list", "छात्र सूची खोलो", "विद्यार्थी सूची खोलो", "छात्र दिखाओ"], href: "/students" },
  { label: "Open classes", hindi: "कक्षाएँ खोलो", phrases: ["open classes", "show classes", "कक्षाएं खोलो", "कक्षाएँ खोलो", "क्लास खोलो"], href: "/classes" },
  { label: "Take attendance", hindi: "उपस्थिति खोलो", phrases: ["take attendance", "open attendance", "mark attendance", "उपस्थिति खोलो", "हाज़िरी खोलो", "हाजिरी खोलो", "उपस्थिति दर्ज करो"], href: "/attendance" },
  { label: "Open reports", hindi: "रिपोर्ट खोलो", phrases: ["open reports", "show reports", "attendance report", "रिपोर्ट खोलो", "रिपोर्ट दिखाओ", "उपस्थिति रिपोर्ट"], href: "/reports" },
  { label: "Open photo attendance", hindi: "फोटो से उपस्थिति खोलो", phrases: ["open photo attendance", "photo attendance", "फोटो से उपस्थिति खोलो", "फोटो उपस्थिति खोलो"], href: "/ai-attendance" },
];

function normalize(text) {
  return text.toLocaleLowerCase().replace(/[.,!?।]/g, " ").replace(/\s+/g, " ").trim();
}

export default function VoiceAssistant() {
  const router = useRouter();
  const recognitionRef = useRef(null);
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState({ language: "en-IN", voiceAssistantEnabled: true });
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const refreshPreferences = () => {
      const next = readSettingsPreferences();
      setPreferences(next);
      if (!next.voiceAssistantEnabled) {
        recognitionRef.current?.stop();
        setListening(false);
        setOpen(false);
      }
    };
    refreshPreferences();
    window.addEventListener(SETTINGS_PREFERENCES_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    return () => {
      window.removeEventListener(SETTINGS_PREFERENCES_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, []);

  useEffect(() => {
    if (open && dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [open]);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function close() {
    stopListening();
    setOpen(false);
  }

  function runCommand(rawText) {
    const spoken = normalize(rawText);
    setTranscript(rawText);
    if (["help", "commands", "मदद", "कमांड", "आदेश"].includes(spoken)) {
      setMessage("Try one of the commands listed below.");
      return;
    }
    if (["close", "cancel", "बंद करो", "रद्द करो"].includes(spoken)) {
      close();
      return;
    }
    const match = COMMANDS.find((command) => command.phrases.some((phrase) => normalize(phrase) === spoken));
    if (match) {
      setMessage(`Opening ${match.label.toLowerCase()}…`);
      setTimeout(() => { router.push(match.href); setOpen(false); }, 350);
    } else {
      setMessage("Command not recognized. Try a phrase from the list below.");
    }
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setSupported(false); return; }
    recognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = preferences.language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setMessage("Listening…"); setTranscript(""); };
    recognition.onresult = (event) => runCommand(event.results[0][0].transcript);
    recognition.onerror = (event) => {
      setListening(false);
      setMessage(event.error === "not-allowed" ? "Microphone access is blocked. Allow it in your browser settings and try again." : event.error === "no-speech" ? "I didn’t hear anything. Try again." : "Voice input couldn’t start. Check your microphone and try again.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setListening(false); setMessage("Voice input is already active. Please try again in a moment."); }
  }

  if (!preferences.voiceAssistantEnabled) return null;

  function changeLanguage(language) {
    const next = { ...readSettingsPreferences(), language };
    setPreferences(next);
    writeSettingsPreferences(next);
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setMessage(""); }} aria-haspopup="dialog" aria-label="Open voice assistant" title="Voice assistant" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><AudioLines size={18} aria-hidden="true" /><span className="hidden sm:inline">Voice assistant</span></button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="voice-assistant-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">English and Hindi</p><h2 id="voice-assistant-title" className="mt-1 text-xl font-bold text-slate-900">Voice assistant</h2><p className="mt-1 text-sm text-slate-600">Say a command to open a section of your workspace.</p></div><button type="button" onClick={close} aria-label="Close voice assistant" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></div>
        <label className="mt-5 block text-sm font-medium text-slate-700">Spoken language<select value={preferences.language} onChange={(event) => changeLanguage(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="en-IN">English (India)</option><option value="hi-IN">हिन्दी (भारत)</option></select></label>
        <div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="flex min-h-12 items-center gap-3"><button type="button" onClick={listening ? stopListening : startListening} disabled={!supported} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors ${listening ? "animate-pulse bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"} disabled:cursor-not-allowed disabled:bg-slate-400`} aria-label={listening ? "Stop listening" : "Start voice command"}>{listening ? <MicOff size={21} /> : <Mic size={21} />}</button><div aria-live="polite"><p className="text-sm font-semibold text-slate-900">{listening ? "Listening for a command" : transcript ? `Heard: “${transcript}”` : "Tap the microphone to speak"}</p><p className="mt-1 text-xs text-slate-500">{message || "Microphone permission may be requested by your browser."}</p></div></div>
          {!supported && <p className="mt-3 text-sm text-rose-700">Voice recognition isn’t supported in this browser. Try a recent version of Chrome.</p>}
        </div>
        <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Available commands (English and Hindi)</summary><ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">{COMMANDS.map((command) => <li key={command.href} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm"><span className="text-slate-700">“{command.label}”</span><span lang="hi" className="text-slate-500">“{command.hindi}”</span></li>)}</ul><p className="mt-3 text-xs leading-5 text-slate-500">Voice is processed by your browser’s speech recognition service. Commands only navigate between app sections; they don’t change attendance records.</p></details>
      </section>
    </div>}
  </>;
}
