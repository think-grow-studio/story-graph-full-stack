"use client";

import { useState } from "react";

import { authClient } from "./auth-client";

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
        setErrorMessage(result.error.message ?? "Unable to continue with Google.");
      }
    } catch {
      setErrorMessage("Unable to continue with Google.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        className="rounded-md border border-neutral-300 bg-white px-4 py-2 font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        onClick={handleClick}
        type="button"
      >
        {isSubmitting ? "Connecting to Google..." : "Continue with Google"}
      </button>
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
