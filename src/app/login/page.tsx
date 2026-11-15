import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { isFrontendPreview } from "@/lib/preview-mode";

export const metadata: Metadata = {
  title: "Sign in | NexusPay",
};

async function LoginContent({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const requestedPath = typeof query.next === "string" ? query.next : "/";
  const redirectTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/";
  return <AuthForm redirectTo={redirectTo} previewMode={isFrontendPreview()} />;
}

function LoginFallback() {
  return <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-zinc-100" aria-busy="true"><div className="h-[28rem] w-full max-w-md animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /></main>;
}

export default function LoginPage(props: PageProps<"/login">) {
  return <Suspense fallback={<LoginFallback />}><LoginContent {...props} /></Suspense>;
}
