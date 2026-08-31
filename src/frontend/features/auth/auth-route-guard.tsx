"use client";

import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import { Button } from "@/frontend/shared/ui/button";
import { StatusMessage } from "@/frontend/shared/ui/status-message";

function isUnauthorized(error: unknown) {
  return isAxiosError(error) && error.response?.status === 401;
}

export function AuthRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const bootstrapQuery = useBootstrapQuery();

  useEffect(() => {
    if (bootstrapQuery.data) {
      router.replace("/dashboard");
    }
  }, [bootstrapQuery.data, router]);

  if (bootstrapQuery.isError && isUnauthorized(bootstrapQuery.error)) {
    return children;
  }

  if (bootstrapQuery.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-5 sm:p-8">
        <section className="grid w-full max-w-sm gap-5 rounded-[var(--sg-radius-lg)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-6 sm:p-8">
          <div>
            <p className="text-sm font-bold tracking-[-0.02em]">Story Graph</p>
            <h1 className="mt-5 text-xl font-bold tracking-[-0.02em]">
              로그인 상태를 확인하지 못했습니다
            </h1>
          </div>
          <StatusMessage tone="danger">
            네트워크 상태를 확인한 뒤 다시 시도해 주세요.
          </StatusMessage>
          <Button
            busy={bootstrapQuery.isFetching}
            className="w-fit"
            emphasis="outline"
            intent="neutral"
            onClick={() => void bootstrapQuery.refetch()}
          >
            다시 시도
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--sg-canvas)] p-5 sm:p-8">
      <section
        aria-busy="true"
        className="w-full max-w-sm rounded-[var(--sg-radius-lg)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-6 sm:p-8"
      >
        <p className="text-sm font-bold tracking-[-0.02em]">Story Graph</p>
        <div className="mt-8 grid gap-3">
          <div
            aria-hidden="true"
            className="h-2 w-20 overflow-hidden rounded-full bg-[var(--sg-line)]"
          >
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--sg-brand)]" />
          </div>
          <p className="text-sm text-[var(--sg-muted)]">
            로그인 상태를 확인하고 있습니다.
          </p>
        </div>
      </section>
    </main>
  );
}
