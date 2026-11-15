"use client";

import { useEffect, useRef } from "react";

export function PayWayCheckoutForm({ action, fields }: { action: string; fields: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.requestSubmit(); }, []);
  return (
    <form ref={form} action={action} method="post" className="space-y-4">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <button type="submit" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-zinc-950">Continue to ABA PayWay</button>
    </form>
  );
}
