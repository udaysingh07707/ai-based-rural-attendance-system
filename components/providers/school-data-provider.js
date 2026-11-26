"use client";

import { createContext, useContext, useState } from "react";
import { initialClasses, initialStudents } from "../../lib/mock-data";

const SchoolDataContext = createContext(null);

export function SchoolDataProvider({ children }) {
  const [students, setStudents] = useState(initialStudents);
  const [classes, setClasses] = useState(initialClasses);

  return (
    <SchoolDataContext.Provider
      value={{ students, setStudents, classes, setClasses }}
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
