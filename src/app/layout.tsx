import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/frontend/app/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Story Graph",
  description: "Build and explore the structure of your story world.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
