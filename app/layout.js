import "./globals.css";
import { SchoolDataProvider } from "../components/providers/school-data-provider";

export const metadata = {
  title: "School Attendance",
  description: "A simple attendance workspace for rural schools.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SchoolDataProvider>{children}</SchoolDataProvider>
      </body>
    </html>
  );
}
