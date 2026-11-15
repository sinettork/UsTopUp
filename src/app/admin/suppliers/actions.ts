"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fadmin%2Fsuppliers");
  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) redirect("/admin");
  return supabase;
}

function notice(message: string): never {
  redirect(`/admin/suppliers?notice=${encodeURIComponent(message)}`);
}

const supplierSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]),
  code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(100),
  adapter: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  email: z.union([z.literal(""), z.string().email()]),
});

export async function saveSupplier(formData: FormData) {
  const parsed = supplierSchema.safeParse({
    id: value(formData, "id"), code: value(formData, "code"),
    name: value(formData, "name"), adapter: value(formData, "adapter_key"),
    email: value(formData, "contact_email"),
  });
  if (!parsed.success) notice(parsed.error.issues[0]?.message ?? "Check supplier details.");
  const supabase = await getAdmin();
  const values = {
    code: parsed.data.code, name: parsed.data.name,
    adapter_key: parsed.data.adapter, contact_email: parsed.data.email,
    is_active: formData.get("is_active") === "on",
  };
  const result = parsed.data.id
    ? await supabase.from("suppliers").update(values).eq("id", parsed.data.id)
    : await supabase.from("suppliers").insert(values);
  if (result.error) notice(result.error.code === "23505" ? "That supplier code is already in use." : "Could not save the supplier.");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/fulfillment");
  notice("Supplier saved.");
}

const mappingSchema = z.object({
  packageId: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierProductCode: z.string().min(1).max(120),
});

export async function savePackageMapping(formData: FormData) {
  const parsed = mappingSchema.safeParse({
    packageId: value(formData, "package_id"),
    supplierId: value(formData, "supplier_id"),
    supplierProductCode: value(formData, "supplier_product_code"),
  });
  if (!parsed.success) notice(parsed.error.issues[0]?.message ?? "Check the mapping details.");
  const supabase = await getAdmin();
  const { error } = await supabase.from("package_supplier_mappings").upsert({
    package_id: parsed.data.packageId,
    supplier_id: parsed.data.supplierId,
    supplier_product_code: parsed.data.supplierProductCode,
    is_active: formData.get("is_active") === "on",
  }, { onConflict: "package_id" });
  if (error) notice(error.code === "23505" ? "That supplier product code is already mapped." : "Could not save the product mapping.");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/fulfillment");
  notice("Product mapping saved.");
}
