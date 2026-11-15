"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/preview-mode";

export type CheckoutActionState = {
  message: string;
  orderNumber?: string;
};

const orderSchema = z.object({
  packageId: z.string().uuid(),
  expectedPriceMinor: z.number().int().nonnegative(),
  expectedCurrency: z.string().length(3),
  inputs: z.record(z.string(), z.string().max(500)),
}).strict();

export async function createOrder(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const idempotencyKey = z.string().uuid().safeParse(formData.get("idempotency_key"));
  const orderPayload = z.string().min(2).max(20_000).safeParse(formData.get("order_payload"));
  if (!idempotencyKey.success || !orderPayload.success) {
    return { message: "Your checkout session is invalid. Reload the page and try again." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(orderPayload.data);
  } catch {
    return { message: "Your order could not be read. Return to the product page and try again." };
  }
  const parsedOrder = orderSchema.safeParse(parsedJson);
  if (!parsedOrder.success) {
    return { message: "Your order details are invalid. Return to the product page and try again." };
  }

  if (isFrontendPreview()) {
    return { message: "Ordering is paused in frontend preview. Checkout will be connected later." };
  }

  if (process.env.NEXT_PUBLIC_CATALOG_PREVIEW === "true") {
    return { message: "Checkout is disabled while the catalog is in preview mode. Configure verified live products and prices first." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fcheckout");

  const { data: allowed, error: rateLimitError } = await supabase.rpc("check_user_rate_limit", {
    _action_key: "order_create",
    _limit: 8,
    _window_seconds: 3600,
  });
  if (rateLimitError || !allowed) {
    return { message: "Too many checkout attempts. Please wait a while and try again." };
  }

  const { data, error } = await supabase.rpc("create_order_from_cart", {
    _items: [{
      package_id: parsedOrder.data.packageId,
      expected_price_minor: parsedOrder.data.expectedPriceMinor,
      expected_currency: parsedOrder.data.expectedCurrency,
      inputs: parsedOrder.data.inputs,
    }],
    _idempotency_key: idempotencyKey.data,
  });

  if (error || !data?.[0]?.order_number) {
    const safeMessage = error?.code === "22023" && error.message.length < 240
      ? error.message
      : "We could not place this order. Review your details and try again.";
    return { message: safeMessage };
  }

  revalidatePath("/account/orders");
  revalidatePath(`/orders/${data[0].order_number}`);
  return { message: "", orderNumber: data[0].order_number };
}
