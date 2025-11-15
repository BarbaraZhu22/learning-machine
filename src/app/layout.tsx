import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/app/layout/AppProviders";
import { SiteHeader } from "@/app/layout/SiteHeader";
import { SiteFooter } from "@/app/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Learning Machine",
  description:
    "Language learning workspace for notes, dialogs, and vocabulary networks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`min-h-screen text-surface-900 antialiased transition-colors dark:text-surface-50`}
      >
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="app-shell mx-auto w-full max-w-6xl flex-1 px-4 py-8">
              {children}
            </main>
            <SiteFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
