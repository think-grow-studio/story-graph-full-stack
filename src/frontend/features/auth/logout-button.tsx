"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { StatusMessage } from "@/frontend/shared/ui/status-message";

import { authClient } from "./auth-client";

export function LogoutButton() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    setHasError(false);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setHasError(true);
        return;
      }

      queryClient.clear();
      router.replace("/");
      router.refresh();
    } catch {
      setHasError(true);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        busy={isPending}
        className="w-full justify-start"
        emphasis="ghost"
        intent="neutral"
        onClick={handleLogout}
      >
        로그아웃
      </Button>
      {hasError ? (
        <StatusMessage tone="danger">로그아웃하지 못했습니다. 다시 시도해 주세요.</StatusMessage>
      ) : null}
    </div>
  );
}
