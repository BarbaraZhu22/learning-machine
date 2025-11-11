import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/layout/AppProviders";
import { SiteHeader } from "@/components/layout/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learning Machine",
  description: "Language learning workspace for notes, dialogs, and vocabulary networks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen text-surface-900 antialiased transition-colors dark:text-surface-50`}
      >
        <AppProviders>
          <SiteHeader />
          <main className="app-shell mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl px-4 py-8">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
