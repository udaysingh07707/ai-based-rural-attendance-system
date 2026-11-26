export const attendanceSummary = [
  {
    label: "Total students",
    value: "128",
    detail: "Across 5 classes",
    color: "blue",
  },
  {
    label: "Present today",
    value: "116",
    detail: "Students marked present",
    color: "green",
  },
  {
    label: "Absent today",
    value: "8",
    detail: "Students marked absent",
    color: "red",
  },
  {
    label: "Attendance rate",
    value: "90.6%",
    detail: "116 of 128 students",
    color: "amber",
  },
];

export const classAttendance = [
  { name: "Class 1 - A", present: 24, total: 26 },
  { name: "Class 2 - A", present: 21, total: 23 },
  { name: "Class 3 - A", present: 20, total: 22 },
  { name: "Class 4 - A", present: 25, total: 27 },
  { name: "Class 5 - A", present: 26, total: 30 },
];

export const attendanceActivity = [
  {
    name: "Aarav Sharma",
    className: "Class 5 - A",
    status: "Present",
    time: "8:42 AM",
  },
  {
    name: "Meera Patel",
    className: "Class 4 - A",
    status: "Present",
    time: "8:39 AM",
  },
  {
    name: "Kabir Singh",
    className: "Class 3 - A",
    status: "Absent",
    time: "8:35 AM",
  },
  {
    name: "Anaya Das",
    className: "Class 2 - A",
    status: "Present",
    time: "8:31 AM",
  },
];

export const initialClasses = [
  { id: "class-1", name: "Class 1", section: "A" },
  { id: "class-2", name: "Class 2", section: "A" },
  { id: "class-3", name: "Class 3", section: "A" },
  { id: "class-4", name: "Class 4", section: "A" },
  { id: "class-5", name: "Class 5", section: "A" },
];

export const initialStudents = [
  { id: "STU-001", name: "Aarav Sharma", classId: "class-5", rollNumber: "01", age: 10, guardianName: "Ravi Sharma" },
  { id: "STU-002", name: "Meera Patel", classId: "class-4", rollNumber: "01", age: 9, guardianName: "Kiran Patel" },
  { id: "STU-003", name: "Kabir Singh", classId: "class-3", rollNumber: "01", age: 8, guardianName: "Harpreet Singh" },
  { id: "STU-004", name: "Anaya Das", classId: "class-2", rollNumber: "01", age: 7, guardianName: "Suman Das" },
  { id: "STU-005", name: "Ishaan Kumar", classId: "class-1", rollNumber: "01", age: 6, guardianName: "Mohan Kumar" },
  { id: "STU-006", name: "Diya Verma", classId: "class-1", rollNumber: "02", age: 6, guardianName: "Asha Verma" },
  { id: "STU-007", name: "Arjun Yadav", classId: "class-1", rollNumber: "03", age: 7, guardianName: "Sunil Yadav" },
  { id: "STU-008", name: "Sara Khan", classId: "class-2", rollNumber: "02", age: 7, guardianName: "Imran Khan" },
  { id: "STU-009", name: "Dev Joshi", classId: "class-2", rollNumber: "03", age: 7, guardianName: "Ramesh Joshi" },
  { id: "STU-010", name: "Ira Roy", classId: "class-3", rollNumber: "02", age: 8, guardianName: "Mitali Roy" },
  { id: "STU-011", name: "Vivaan Gupta", classId: "class-3", rollNumber: "03", age: 8, guardianName: "Nitin Gupta" },
  { id: "STU-012", name: "Myra Reddy", classId: "class-4", rollNumber: "02", age: 9, guardianName: "Suresh Reddy" },
  { id: "STU-013", name: "Reyansh Bose", classId: "class-4", rollNumber: "03", age: 9, guardianName: "Anil Bose" },
  { id: "STU-014", name: "Aadhya Nair", classId: "class-5", rollNumber: "02", age: 10, guardianName: "Lakshmi Nair" },
  { id: "STU-015", name: "Advik Mishra", classId: "class-5", rollNumber: "03", age: 10, guardianName: "Prakash Mishra" },
];
