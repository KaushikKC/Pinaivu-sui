import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "./DashboardShell";

export const metadata: Metadata = {
  title: "Pinaivu — Developer Console",
  description: "API key management, usage analytics, and model catalog",
  icons: { icon: "/Pinaivu_logo.jpg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
