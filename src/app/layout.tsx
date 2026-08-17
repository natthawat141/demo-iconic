import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_Thai } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "น้องฟ้า · ICONIC Knowledge Assistant",
  description: "ผู้ช่วยความรู้ภายในสำหรับทีม ICONIC",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const modelId =
    process.env.OPENROUTER_CHAT_MODEL?.trim() || "openai/gpt-4.1-mini";
  const liveModel = Boolean(process.env.OPENROUTER_API_KEY) &&
    process.env.DEMO_SAFE_MODE !== "true";
  const databaseLabel = process.env.POSTGRES_URL
    ? "GCP Cloud SQL · PostgreSQL"
    : process.env.MYSQL_URL
      ? "Oracle MySQL · Remote"
      : "SQLite · Local demo";

  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ClerkProvider>
          <ThemeProvider>
            <TooltipProvider>
              <AppShell
                modelId={modelId}
                liveModel={liveModel}
                databaseLabel={databaseLabel}
              >
                {children}
              </AppShell>
            </TooltipProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
