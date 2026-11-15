"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { z } from "zod";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export function AuthForm({ redirectTo = "/", previewMode = false }: { redirectTo?: string; previewMode?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setNotice("");

    if (previewMode) {
      setNotice("Sign-in and account creation are paused in frontend preview.");
      return;
    }

    if (mode === "sign-up" && displayName.trim().length < 2) {
      setErrorMessage("Enter a name with at least 2 characters.");
      return;
    }

    const parsedCredentials = credentialsSchema.safeParse({ email, password });

    if (!parsedCredentials.success) {
      setErrorMessage(parsedCredentials.error.issues[0]?.message ?? "Check your details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: parsedCredentials.data.email,
          password: parsedCredentials.data.password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setNotice("Check your email to confirm your account.");
        }

        return;
      }

      const { error } = await supabase.auth.signInWithPassword(
        parsedCredentials.data,
      );

      if (error) {
        setErrorMessage(error.message);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrorMessage(
          "Supabase is not configured. Copy .env.example to .env.local and set the project URL and public key.",
        );
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Authentication could not be initialized.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: "sign-in" | "sign-up") {
    setMode(nextMode);
    setErrorMessage("");
    setNotice("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <Gamepad2 className="size-5" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">NexusPay</span>
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {previewMode
            ? "Frontend preview: sign-in and account creation are paused."
            : mode === "sign-in"
              ? "Sign in to continue to your account."
              : "Create an account to keep track of your orders."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <label className="block text-sm font-medium text-zinc-300">
              Name
              <input
                autoComplete="name"
                className="mt-1.5 flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-400"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
          )}

          <label className="block text-sm font-medium text-zinc-300">
            Email
            <input
              autoComplete="email"
              className="mt-1.5 flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-400"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Password
            <input
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              className="mt-1.5 flex h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-400"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>

          {errorMessage && (
            <p className="text-sm text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
          {notice && (
            <p className="text-sm text-green-400" role="status">
              {notice}
            </p>
          )}

          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Please wait..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          {mode === "sign-in" ? "New to NexusPay?" : "Already have an account?"}{" "}
          <button
            className="font-medium text-zinc-100 underline-offset-4 hover:underline"
            type="button"
            onClick={() =>
              changeMode(mode === "sign-in" ? "sign-up" : "sign-in")
            }
          >
            {mode === "sign-in" ? "Create account" : "Sign in"}
          </button>
        </p>

        <p className="mt-5 text-center text-xs text-zinc-500">
          <Link href="/" className="hover:text-zinc-300">
            Back to catalog
          </Link>
        </p>
      </section>
    </main>
  );
}
