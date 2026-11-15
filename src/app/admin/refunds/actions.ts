"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function go(message: string): never {
  redirect(`/admin/refunds?notice=${encodeURIComponent(message)}`);
}

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Frefunds");
  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/admin");
  return supabase;
}

export async function requestRefund(formData: FormData) {
  const parsed = z.object({
    paymentId: z.string().uuid(),
    amountMinor: z.coerce.number().int().positive().max(1000000000),
    reason: z.string().trim().min(1).max(1000),
  }).safeParse({ paymentId: value(formData, "payment_id"), amountMinor: value(formData, "amount_minor"), reason: value(formData, "reason") });
  if (!parsed.success) go(parsed.error.issues[0]?.message ?? "Check refund details.");
  const supabase = await adminClient();
  const { error } = await supabase.rpc("request_refund", {
    _payment_id: parsed.data.paymentId,
    _amount_minor: parsed.data.amountMinor,
    _reason: parsed.data.reason,
  });
  if (error) go(error.message);
  revalidatePath("/admin/refunds");
  go("Refund request recorded. Process the refund with the payment provider before marking it complete.");
}

export async function updateRefund(formData: FormData) {
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["requested", "processing", "completed", "failed"]),
    providerReference: z.string().max(200),
    note: z.string().max(1000),
  }).safeParse({ id: value(formData, "refund_id"), status: value(formData, "status"), providerReference: value(formData, "provider_reference"), note: value(formData, "note") });
  if (!parsed.success) go(parsed.error.issues[0]?.message ?? "Check refund update.");
  const supabase = await adminClient();
  const { error } = await supabase.rpc("update_refund", {
    _refund_id: parsed.data.id,
    _next_status: parsed.data.status,
    _provider_reference: parsed.data.providerReference || null,
    _note: parsed.data.note,
  });
  if (error) go(error.message);
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/orders");
  go("Refund update recorded.");
}
