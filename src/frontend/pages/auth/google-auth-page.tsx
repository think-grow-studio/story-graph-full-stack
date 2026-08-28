import Link from "next/link";

import { GoogleAuthButton } from "@/frontend/features/auth/google-auth-button";

export function GoogleAuthPage({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="grid w-full max-w-sm gap-6 rounded-xl border border-neutral-200 p-6">
        <div className="grid gap-2">
          <p className="text-sm text-neutral-500">Story Graph</p>
          <h1 className="text-2xl font-semibold">{isLogin ? "Sign in" : "Get started"}</h1>
          <p className="text-sm text-neutral-600">
            {isLogin
              ? "Continue with your Google account."
              : "Create your Story Graph account with Google."}
          </p>
        </div>

        <GoogleAuthButton />

        <p className="text-sm text-neutral-600">
          {isLogin ? "New to Story Graph? " : "Already have an account? "}
          <Link className="font-medium underline" href={isLogin ? "/signup" : "/login"}>
            {isLogin ? "Get started" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
