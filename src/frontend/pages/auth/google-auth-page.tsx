"use client";

import Link from "next/link";

import { AuthRouteGuard } from "@/frontend/features/auth/auth-route-guard";
import { GoogleAuthButton } from "@/frontend/features/auth/google-auth-button";

function AuthSurface({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";

  return (
    <main className="grid min-h-screen bg-[var(--sg-canvas)] lg:grid-cols-[1fr_0.92fr]">
      <section className="hidden min-h-screen border-r border-[var(--sg-line)] bg-[var(--sg-surface)] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link className="inline-flex items-center gap-2 text-sm font-bold tracking-[-0.02em]" href="/">
          <span
            aria-hidden="true"
            className="relative size-6 rounded-full border-2 border-[var(--sg-brand)] before:absolute before:left-[5px] before:top-[5px] before:size-1.5 before:rounded-full before:bg-[var(--sg-brand)] after:absolute after:bottom-[4px] after:right-[4px] after:size-1 after:rounded-full after:bg-[var(--sg-brand)]"
          />
          Story Graph
        </Link>

        <div className="max-w-lg pb-10">
          <p className="text-sm font-semibold text-[var(--sg-brand-strong)]">STORY WORKSPACE</p>
          <p className="mt-5 text-4xl font-black leading-tight tracking-[-0.045em] xl:text-5xl">
            흩어진 설정을
            <br />
            이야기의 구조로.
          </p>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--sg-muted)]">
            인물과 관계를 연결해 두면 쓰는 동안 필요한 맥락을 더 빠르게 찾을 수 있습니다.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <Link className="mb-10 inline-flex items-center gap-2 text-sm font-bold tracking-[-0.02em] lg:hidden" href="/">
            <span aria-hidden="true" className="size-5 rounded-full border-2 border-[var(--sg-brand)]" />
            Story Graph
          </Link>

          <div>
            <p className="text-sm font-semibold text-[var(--sg-brand-strong)]">
              {isLogin ? "로그인" : "처음 시작하기"}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {isLogin ? "다시 만나서 반가워요" : "이야기를 연결해 보세요"}
            </h1>
            <p className="mt-4 text-sm leading-6 text-[var(--sg-muted)] sm:text-base sm:leading-7">
              {isLogin
                ? "Google 계정으로 Story Graph에 로그인하세요."
                : "Google 계정으로 바로 시작하고 첫 이야기 그래프를 만들어 보세요."}
            </p>
          </div>

          <div className="mt-8">
            <GoogleAuthButton />
          </div>

          <p className="mt-6 text-sm text-[var(--sg-muted)]">
            {isLogin ? "처음이신가요? " : "이미 사용 중이신가요? "}
            <Link
              className="font-semibold text-[var(--sg-ink)] underline decoration-[var(--sg-line)] underline-offset-4 hover:decoration-[var(--sg-brand)]"
              href={isLogin ? "/signup" : "/login"}
            >
              {isLogin ? "처음 시작하기" : "로그인하기"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export function GoogleAuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <AuthRouteGuard>
      <AuthSurface mode={mode} />
    </AuthRouteGuard>
  );
}
