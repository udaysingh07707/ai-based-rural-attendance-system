"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { initialClasses, initialStudents } from "../../lib/mock-data";

const SchoolDataContext = createContext(null);

export function SchoolDataProvider({ children }) {
  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);
  const [attendance, setAttendance] = useState({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("rural-school-data-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.students)) setStudents(parsed.students);
        if (Array.isArray(parsed.classes)) setClasses(parsed.classes);
        if (parsed.attendance && typeof parsed.attendance === "object") setAttendance(parsed.attendance);
      }
    } catch {
      // Keep the sample data available when storage is disabled or unreadable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem("rural-school-data-v1", JSON.stringify({ students, classes, attendance }));
    } catch {
      // The app remains usable for this session when device storage is full.
    }
  }, [students, classes, attendance, hydrated]);

  return (
    <SchoolDataContext.Provider
      value={{ students, setStudents, classes, setClasses, attendance, setAttendance }}
    >
      {children}
    </SchoolDataContext.Provider>
  );
}

export function useSchoolData() {
  const context = useContext(SchoolDataContext);
  if (!context) {
    throw new Error("useSchoolData must be used within SchoolDataProvider");
  }
  return context;
}
