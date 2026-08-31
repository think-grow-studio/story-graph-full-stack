"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import type { BootstrapResponse } from "@/contracts/auth/bootstrap.contract";
import { LogoutButton } from "@/frontend/features/auth/logout-button";
import { Dialog } from "@/frontend/shared/ui/dialog";

function Brand() {
  return (
    <Link className="inline-flex items-center gap-2 text-sm font-bold tracking-[-0.02em]" href="/dashboard">
      <span
        aria-hidden="true"
        className="relative size-6 rounded-full border-2 border-[var(--sg-brand)] before:absolute before:left-[5px] before:top-[5px] before:size-1.5 before:rounded-full before:bg-[var(--sg-brand)] after:absolute after:bottom-[4px] after:right-[4px] after:size-1 after:rounded-full after:bg-[var(--sg-brand)]"
      />
      Story Graph
    </Link>
  );
}

function ProductNavigation() {
  return (
    <nav aria-label="주요 메뉴" className="grid gap-1">
      <Link
        aria-current="page"
        className="rounded-[var(--sg-radius-sm)] bg-[color-mix(in_srgb,var(--sg-brand)_10%,white)] px-3 py-2.5 text-sm font-semibold text-[var(--sg-brand-strong)]"
        href="/dashboard"
      >
        내 이야기
      </Link>
    </nav>
  );
}

function Account({ actor }: { actor: BootstrapResponse["actor"] }) {
  const displayName = actor.name.trim() || actor.email;

  return (
    <div className="grid gap-3 border-t border-[var(--sg-line)] pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--sg-muted)]">{actor.email}</p>
      </div>
      <LogoutButton />
    </div>
  );
}

export function AppShell({
  actor,
  title,
  description,
  action,
  children,
}: {
  actor: BootstrapResponse["actor"];
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--sg-canvas)] text-[var(--sg-ink)] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden h-dvh flex-col border-r border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 lg:sticky lg:top-0 lg:flex">
        <Brand />
        <div className="mt-8">
          <ProductNavigation />
        </div>
        <div className="mt-auto">
          <Account actor={actor} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--sg-line)] bg-[var(--sg-surface)] px-5 lg:hidden">
          <Brand />
          <button
            aria-label="메뉴 열기"
            className="inline-flex size-10 items-center justify-center rounded-[var(--sg-radius-sm)] border border-[var(--sg-line)] bg-white text-lg font-semibold"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            ≡
          </button>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-col gap-5 border-b border-[var(--sg-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sg-muted)] sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          {children}
        </main>
      </div>

      <Dialog
        className="w-[min(92vw,420px)]"
        description="이야기 화면 이동과 계정 작업을 할 수 있습니다."
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        title="메뉴"
      >
        <div className="grid gap-6">
          <ProductNavigation />
          <Account actor={actor} />
        </div>
      </Dialog>
    </div>
  );
}
