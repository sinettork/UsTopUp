import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";
import { isFrontendPreview } from "@/lib/preview-mode";

export const metadata: Metadata = { title: "Shopping cart | NexusPay" };

export default function CartRoute() {
  return <CartPage previewMode={isFrontendPreview()} />;
}
