import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/Sidebar";
import { getSettings } from "@/lib/repo";
import AuthWrapper from "@/components/AuthWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "LWN INVOICE & DATA", // <-- Change this to whatever tab name you want
  description: "LWN Management System",
  icons: {
    icon: "/logo.png", // <-- This links your public/logo.png as the tab icon
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let businessName = "LedgerLite";
  let vatScheme = "cash";

  try {
    const settings = await getSettings();
    businessName = settings.businessName;
    vatScheme = settings.vatScheme;
  } catch {
    // Database not ready yet — the shell still renders so the error page works.
  }

  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <AuthWrapper>
          <Sidebar businessName={businessName} vatScheme={vatScheme} />
          <main className="min-h-screen px-4 pb-16 pt-16 lg:pl-72 lg:pr-8 lg:pt-8">
            <div className="mx-auto max-w-7xl space-y-6">{children}</div>
          </main>
        </AuthWrapper>
      </body>
    </html>
  );
}