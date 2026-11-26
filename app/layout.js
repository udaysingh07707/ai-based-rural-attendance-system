import "./globals.css";
import { SchoolDataProvider } from "../components/providers/school-data-provider";
import PwaRegistration from "../components/common/pwa-registration";

export const metadata = {
  title: "School Attendance",
  description: "A simple attendance workspace for rural schools.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SchoolDataProvider>
          <PwaRegistration />
          {children}
        </SchoolDataProvider>
      </body>
    </html>
  );
}
