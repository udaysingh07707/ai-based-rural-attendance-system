"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const SchoolDataContext = createContext(null);

async function request(url, method, data, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const response = await fetch(url, {
      method,
      headers: data && !isFormData ? { "Content-Type": "application/json" } : undefined,
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Request failed.");
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request took too long. Check your connection and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function SchoolDataProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [teacher, setTeacher] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");
  const authRequestRef = useRef(null);
  const authRequestIdRef = useRef(0);

  const reload = useCallback(async () => {
    setDataError("");
    try {
      const data = await request("/api/school-data", "GET");
      setStudents(data.students);
      setClasses(data.classes);
      setAttendance(data.attendance);
      setHydrated(true);
      return true;
    } catch (error) {
      setHydrated(true);
      setDataError(error.message || "Could not load school data.");
      throw error;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    authRequestRef.current?.abort();
    const controller = new AbortController();
    authRequestRef.current = controller;
    const requestId = ++authRequestIdRef.current;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setAuthStatus("checking");
    setAuthError("");

    try {
      const response = await fetch("/api/auth/session", { signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (requestId !== authRequestIdRef.current) return null;
      if (response.status === 401) {
        setTeacher(null);
        setStudents([]);
        setClasses([]);
        setAttendance({});
        setAuthStatus("unauthenticated");
        setDataError("");
        setHydrated(true);
        return null;
      }
      if (!response.ok || !result.teacher) throw new Error(result.error || "Could not verify your school account.");

      setTeacher(result.teacher);
      setAuthStatus("authenticated");
      reload().catch(() => {});
      return result.teacher;
    } catch (error) {
      if (requestId !== authRequestIdRef.current) return null;
      setAuthError(error.name === "AbortError" ? "Checking your account timed out. Check your connection and retry." : error.message || "Could not reach the account service.");
      setAuthStatus("error");
      setHydrated(true);
      return null;
    } finally {
      clearTimeout(timeout);
      if (authRequestRef.current === controller) authRequestRef.current = null;
    }
  }, [reload]);

  const clearSessionState = useCallback(() => {
    authRequestIdRef.current += 1;
    authRequestRef.current?.abort();
    authRequestRef.current = null;
    setTeacher(null);
    setStudents([]);
    setClasses([]);
    setAttendance({});
    setAuthError("");
    setDataError("");
    setAuthStatus("unauthenticated");
  }, []);

  const updateTeacher = useCallback((nextTeacher) => setTeacher(nextTeacher), []);

  useEffect(() => {
    refreshSession();
    return () => {
      authRequestIdRef.current += 1;
      authRequestRef.current?.abort();
    };
  }, [refreshSession]);

  const createClass = async (data) => { await request("/api/classes", "POST", data); await reload(); };
  const updateClass = async (id, data) => { await request(`/api/classes/${id}`, "PUT", data); await reload(); };
  const deleteClass = async (id) => {
    await request(`/api/classes/${id}`, "DELETE");
    setClasses((current) => current.filter((item) => item.id !== id));
    setStudents((current) => current.filter((student) => student.classId !== id));
  };
  const createStudent = async (data) => {
    const result = await request("/api/students", "POST", data);
    setStudents((current) => [...current, result.student].sort((a, b) => a.name.localeCompare(b.name)));
    return result.student;
  };
  const updateStudent = async (id, data) => {
    const result = await request(`/api/students/${id}`, "PUT", data);
    setStudents((current) => current.map((student) => student.id === id ? result.student : student).sort((a, b) => a.name.localeCompare(b.name)));
    return result.student;
  };
  const deleteStudent = async (id) => {
    await request(`/api/students/${id}`, "DELETE");
    setStudents((current) => current.filter((student) => student.id !== id));
  };
  const saveAttendance = async (classId, date, statuses) => { await request("/api/attendance", "POST", { classId, date, statuses }); await reload(); };

  return (
    <SchoolDataContext.Provider value={{ students, classes, attendance, teacher, hydrated, authStatus, authError, dataError, refreshSession, clearSessionState, updateTeacher, createClass, updateClass, deleteClass, createStudent, updateStudent, deleteStudent, saveAttendance, reload, setAttendance }}>
      {children}
    </SchoolDataContext.Provider>
  );
}

export function useSchoolData() {
  const context = useContext(SchoolDataContext);
  if (!context) throw new Error("useSchoolData must be used within SchoolDataProvider");
  return context;
}
