"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalDevelopment) {
      navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        if (!registrations.length) {
          window.sessionStorage.removeItem("rural-attendance-sw-cleanup");
          return;
        }
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter((name) => name.startsWith("rural-attendance-")).map((name) => caches.delete(name)));
        if (!window.sessionStorage.getItem("rural-attendance-sw-cleanup")) {
          window.sessionStorage.setItem("rural-attendance-sw-cleanup", "done");
          window.location.reload();
        }
      }).catch(() => {});
      return;
    }
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
