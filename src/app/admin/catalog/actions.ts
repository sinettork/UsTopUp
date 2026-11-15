"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const currencyPattern = /^[A-Z]{3}$/;

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=%2Fadmin%2Fcatalog");

  const [owner, administrator] = await Promise.all([
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "owner" }),
    supabase.rpc("has_role", { _profile_id: user.id, _role_key: "administrator" }),
  ]);
  if (owner.error || administrator.error || (!owner.data && !administrator.data)) {
    redirect("/?admin=forbidden");
  }
  return supabase;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function resultPath(message: string): never {
  redirect(`/admin/catalog?notice=${encodeURIComponent(message)}`);
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/admin/catalog");
  if (slug) revalidatePath(`/games/${slug}`);
}

const productSchema = z.object({
  slug: z.string().regex(slugPattern, "Use lowercase letters, numbers, and hyphens for the slug."),
  title: z.string().min(1).max(100),
  publisher: z.string().max(100),
  category: z.string().min(1).max(40),
  creditLabel: z.string().min(1).max(40),
  currency: z.string().regex(currencyPattern, "Currency must be a three-letter uppercase code."),
  imageUrl: z.union([z.literal(""), z.string().url()]),
  fulfillmentMethod: z.enum(["automatic", "manual"]),
  sortOrder: z.number().int().min(0).max(100000),
});

export async function createProduct(formData: FormData) {
  const data = productSchema.safeParse({
    slug: readString(formData, "slug"),
    title: readString(formData, "title"),
    publisher: readString(formData, "publisher"),
    category: readString(formData, "category"),
    creditLabel: readString(formData, "credit_label"),
    currency: readString(formData, "currency").toUpperCase(),
    imageUrl: readString(formData, "image_url"),
    fulfillmentMethod: readString(formData, "fulfillment_method"),
    sortOrder: Number(readString(formData, "sort_order") || 0),
  });
  if (!data.success) resultPath(data.error.issues[0]?.message ?? "Check the product details.");

  const supabase = await getAdminClient();
  const { error } = await supabase.from("games").insert({
    slug: data.data.slug,
    title: data.data.title,
    publisher: data.data.publisher,
    category: data.data.category,
    credit_label: data.data.creditLabel,
    currency: data.data.currency,
    image_url: data.data.imageUrl || null,
    fulfillment_method: data.data.fulfillmentMethod,
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  });
  if (error) resultPath(error.code === "23505" ? "That slug is already in use." : "Could not create the product. Check the details and try again.");

  revalidateCatalog(data.data.slug);
  resultPath("Product created.");
}

export async function updateProduct(formData: FormData) {
  const id = readString(formData, "id");
  const data = productSchema.extend({ id: z.string().uuid() }).safeParse({
    id,
    slug: readString(formData, "slug"),
    title: readString(formData, "title"),
    publisher: readString(formData, "publisher"),
    category: readString(formData, "category"),
    creditLabel: readString(formData, "credit_label"),
    currency: readString(formData, "currency").toUpperCase(),
    imageUrl: readString(formData, "image_url"),
    fulfillmentMethod: readString(formData, "fulfillment_method"),
    sortOrder: Number(readString(formData, "sort_order") || 0),
  });
  if (!data.success) resultPath(data.error.issues[0]?.message ?? "Check the product details.");

  const supabase = await getAdminClient();
  const { error } = await supabase.from("games").update({
    slug: data.data.slug,
    title: data.data.title,
    publisher: data.data.publisher,
    category: data.data.category,
    credit_label: data.data.creditLabel,
    currency: data.data.currency,
    image_url: data.data.imageUrl || null,
    fulfillment_method: data.data.fulfillmentMethod,
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  }).eq("id", data.data.id);
  if (error) resultPath(error.code === "23505" ? "That slug is already in use." : "Could not update the product. Check the details and try again.");

  revalidateCatalog(data.data.slug);
  resultPath("Product saved.");
}

const packageSchema = z.object({
  gameId: z.string().uuid(),
  packageCode: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores for the plan code."),
  amountLabel: z.string().min(1).max(100),
  bonusLabel: z.string().max(100),
  priceMinor: z.number().int().min(0).max(1000000000),
  supplierCostMinor: z.number().int().min(0).max(1000000000),
  currency: z.string().regex(currencyPattern),
  sortOrder: z.number().int().min(0).max(100000),
});

function parsePackage(formData: FormData) {
  return packageSchema.safeParse({
    gameId: readString(formData, "game_id"),
    packageCode: readString(formData, "package_code"),
    amountLabel: readString(formData, "amount_label"),
    bonusLabel: readString(formData, "bonus_label"),
    priceMinor: Number(readString(formData, "price_minor")),
    supplierCostMinor: Number(readString(formData, "supplier_cost_minor")),
    currency: readString(formData, "currency").toUpperCase(),
    sortOrder: Number(readString(formData, "sort_order") || 0),
  });
}

export async function createPlan(formData: FormData) {
  const data = parsePackage(formData);
  if (!data.success) resultPath(data.error.issues[0]?.message ?? "Check the plan details.");
  const supabase = await getAdminClient();
  const { error } = await supabase.from("game_packages").insert({
    game_id: data.data.gameId,
    package_code: data.data.packageCode,
    amount_label: data.data.amountLabel,
    bonus_label: data.data.bonusLabel || null,
    price_minor: data.data.priceMinor,
    supplier_cost_minor: data.data.supplierCostMinor,
    currency: data.data.currency,
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  });
  if (error) resultPath(error.code === "23505" ? "That plan code already exists for this product." : "Could not create the plan. Check the details and try again.");

  revalidateCatalog();
  resultPath("Plan created.");
}

export async function updatePlan(formData: FormData) {
  const id = readString(formData, "id");
  const data = parsePackage(formData);
  if (!z.string().uuid().safeParse(id).success || !data.success) {
    resultPath(data.success ? "Invalid plan." : data.error.issues[0]?.message ?? "Check the plan details.");
  }
  const supabase = await getAdminClient();
  const { error } = await supabase.from("game_packages").update({
    package_code: data.data.packageCode,
    amount_label: data.data.amountLabel,
    bonus_label: data.data.bonusLabel || null,
    price_minor: data.data.priceMinor,
    supplier_cost_minor: data.data.supplierCostMinor,
    currency: data.data.currency,
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  }).eq("id", id);
  if (error) resultPath(error.code === "23505" ? "That plan code already exists for this product." : "Could not update the plan. Check the details and try again.");

  revalidateCatalog();
  resultPath("Plan saved.");
}

const fieldSchema = z.object({
  gameId: z.string().uuid(),
  fieldKey: z.string().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/, "Use a lowercase key starting with a letter."),
  label: z.string().min(1).max(80),
  fieldType: z.enum(["text", "email", "number"]),
  placeholder: z.string().max(100),
  helpText: z.string().max(240),
  validationPattern: z.string().max(240),
  sortOrder: z.number().int().min(0).max(100000),
});

function parseField(formData: FormData) {
  return fieldSchema.safeParse({
    gameId: readString(formData, "game_id"),
    fieldKey: readString(formData, "field_key"),
    label: readString(formData, "label"),
    fieldType: readString(formData, "field_type"),
    placeholder: readString(formData, "placeholder"),
    helpText: readString(formData, "help_text"),
    validationPattern: readString(formData, "validation_pattern"),
    sortOrder: Number(readString(formData, "sort_order") || 0),
  });
}

export async function createProductField(formData: FormData) {
  const data = parseField(formData);
  if (!data.success) resultPath(data.error.issues[0]?.message ?? "Check the field details.");
  const supabase = await getAdminClient();
  const { error } = await supabase.from("game_fields").insert({
    game_id: data.data.gameId,
    field_key: data.data.fieldKey,
    label: data.data.label,
    field_type: data.data.fieldType,
    placeholder: data.data.placeholder || null,
    help_text: data.data.helpText || null,
    validation_pattern: data.data.validationPattern || null,
    is_required: formData.get("is_required") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  });
  if (error) resultPath(error.code === "23505" ? "That field key already exists for this product." : "Could not create the field. Check the details and try again.");
  revalidateCatalog();
  resultPath("Required field added.");
}

export async function updateProductField(formData: FormData) {
  const id = readString(formData, "id");
  const data = parseField(formData);
  if (!z.string().uuid().safeParse(id).success || !data.success) {
    resultPath(data.success ? "Invalid field." : data.error.issues[0]?.message ?? "Check the field details.");
  }
  const supabase = await getAdminClient();
  const { error } = await supabase.from("game_fields").update({
    field_key: data.data.fieldKey,
    label: data.data.label,
    field_type: data.data.fieldType,
    placeholder: data.data.placeholder || null,
    help_text: data.data.helpText || null,
    validation_pattern: data.data.validationPattern || null,
    is_required: formData.get("is_required") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: data.data.sortOrder,
  }).eq("id", id);
  if (error) resultPath(error.code === "23505" ? "That field key already exists for this product." : "Could not update the field. Check the details and try again.");
  revalidateCatalog();
  resultPath("Field saved.");
}
