"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";

export default function ConnectivityStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return <div role="status" aria-live="polite" className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium sm:gap-2 sm:px-3 ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`} title={online ? "Connected. Data is saved on this device." : "Offline. Changes are saved on this device."}>
    {online ? <Cloud size={15} aria-hidden="true" /> : <CloudOff size={15} aria-hidden="true" />}
    <span className="hidden sm:inline">{online ? "Online · saved on device" : "Offline · saved on device"}</span>
    <span className="sm:hidden">{online ? "Online" : "Offline"}</span>
  </div>;
}
