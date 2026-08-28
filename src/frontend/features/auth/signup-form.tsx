"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { getBootstrap } from "@/frontend/api/auth/bootstrap.api";
import { authClient } from "./auth-client";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmailError = emailPattern.test(email) ? null : "Enter a valid email.";
    const nextPasswordError =
      password.length >= 8 ? null : "Password must be at least 8 characters.";

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setSubmitError(null);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      const name = email.split("@", 1)[0]?.trim() || "Story Graph User";
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setSubmitError(result.error.message ?? "Unable to create account.");
        return;
      }

      await getBootstrap();
      router.push("/dashboard");
    } catch {
      setSubmitError("Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="signup-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          id="signup-email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
        {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="signup-password">
          Password
        </label>
        <input
          autoComplete="new-password"
          className="rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          id="signup-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <button
        className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
