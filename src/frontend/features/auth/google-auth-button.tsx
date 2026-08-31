"use client";

import { useState } from "react";

import { Button } from "@/frontend/shared/ui/button";
import { StatusMessage } from "@/frontend/shared/ui/status-message";

import { authClient } from "./auth-client";

const AUTH_ERROR_MESSAGE = "Google 로그인을 시작하지 못했습니다. 다시 시도해 주세요.";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.7 4.7 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
        fill="currentColor"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
        fill="currentColor"
        opacity=".78"
      />
      <path
        d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1A10 10 0 0 0 2 12c0 1.7.4 3.2 1.1 4.6L6.4 14Z"
        fill="currentColor"
        opacity=".58"
      />
      <path
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 3.1 7.4L6.4 10A6 6 0 0 1 12 5.9Z"
        fill="currentColor"
        opacity=".9"
      />
    </svg>
  );
}

export function GoogleAuthButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setErrorMessage(AUTH_ERROR_MESSAGE);
      }
    } catch {
      setErrorMessage(AUTH_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button
        busy={isSubmitting}
        className="w-full"
        emphasis="outline"
        intent="neutral"
        onClick={handleClick}
      >
        <GoogleMark />
        Google로 계속하기
      </Button>
      {errorMessage ? <StatusMessage tone="danger">{errorMessage}</StatusMessage> : null}
    </div>
  );
}
