import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/frontend/app/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Story Graph",
  description: "인물, 장소, 사건과 관계를 연결해 이야기 세계를 정리하는 그래프 작업 공간.",
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
