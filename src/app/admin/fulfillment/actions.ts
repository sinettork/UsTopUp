"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

export async function updateFulfillmentJob(formData: FormData) {
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["queued", "processing", "completed", "failed", "needs_review"]),
    note: z.string().max(1000),
    externalReference: z.string().max(200),
  }).safeParse({
    id: text(formData, "job_id"),
    status: text(formData, "status"),
    note: text(formData, "note"),
    externalReference: text(formData, "external_reference"),
  });
  if (!parsed.success) redirect("/admin/fulfillment?notice=Check%20the%20update%20details.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Ffulfillment");

  const { error } = await supabase.rpc("update_fulfillment_job", {
    _job_id: parsed.data.id,
    _next_status: parsed.data.status,
    _note: parsed.data.note,
    _external_reference: parsed.data.externalReference || null,
  });
  if (error) redirect(`/admin/fulfillment?notice=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/fulfillment");
  revalidatePath("/admin/orders");
  revalidatePath("/account/orders");
  redirect("/admin/fulfillment?notice=Fulfillment%20update%20recorded.");
}
