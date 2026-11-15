import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, Copy, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { checkBakongPayment } from "@/app/payments/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pay by Bakong | NexusPay" };

function formatPrice(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** digits);
}

async function BakongPaymentContent({ params }: PageProps<"/payments/[paymentId]">) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/payments/${paymentId}`)}`);

  const { data: payment, error } = await supabase.from("payments")
    .select("id, order_id, provider, provider_reference, status, amount_minor, currency, qr_payload, expires_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment && !error) notFound();
  if (error || !payment || payment.provider !== "bakong") {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-center text-zinc-100"><div><h1 className="text-xl font-semibold">Payment details unavailable</h1><Link href="/" className="mt-5 inline-flex text-sm text-zinc-200 underline underline-offset-4">Back to catalog</Link></div></main>;
  }
  const { data: order } = await supabase.from("orders").select("order_number")
    .eq("id", payment.order_id).maybeSingle();
  if (!order) notFound();

  let qrImage: string | null = null;
  if (payment.qr_payload) qrImage = await QRCode.toDataURL(payment.qr_payload, { errorCorrectionLevel: "M", margin: 2, width: 320 });

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800"><div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6"><Link href={`/orders/${order.order_number}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100"><ArrowLeft className="size-4" aria-hidden="true" /> Order {order.order_number}</Link></div></header>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 p-5 sm:p-6"><div className="flex items-center gap-2 text-xs text-zinc-500"><QrCode className="size-4" aria-hidden="true" /> Bakong payment</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Scan to pay</h1><p className="mt-2 text-sm text-zinc-400">Order {order.order_number}</p></div>
          <div className="grid gap-6 p-5 sm:grid-cols-[1fr_1fr] sm:p-6">
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-white p-4">
              {payment.status === "paid" ? <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-emerald-800"><CircleCheck className="size-12" aria-hidden="true" /><span className="font-semibold">Payment verified</span></div> : qrImage ? <Image src={qrImage} alt="Bakong payment QR code" width={320} height={320} unoptimized className="h-auto w-full max-w-72" /> : <p className="p-10 text-center text-sm text-zinc-700">QR code is being prepared. Return to the order and retry if this continues.</p>}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-zinc-400">Amount due</p><p className="mt-1 text-3xl font-semibold tracking-tight">{formatPrice(payment.amount_minor, payment.currency.trim())}</p>
              <p className="mt-4 text-sm leading-6 text-zinc-400">Open a Bakong enabled bank app and scan this code. When the transfer is complete, check the transaction here to verify it against the exact amount, currency and merchant account.</p>
              <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"><p className="text-[11px] text-zinc-500">Payment reference</p><code className="mt-1 block break-all text-xs text-zinc-300">{payment.provider_reference}</code></div>
              {payment.status === "pending" && <form action={checkBakongPayment} className="mt-5"><input type="hidden" name="payment_id" value={payment.id} /><button type="submit" className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">I have paid · Check payment</button></form>}
              {payment.status === "paid" && <Link href={`/orders/${order.order_number}`} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white">View order receipt</Link>}
              <p className="mt-3 text-center text-xs text-zinc-500">Order remains pending until Bakong confirms this payment.</p>
            </div>
          </div>
          {payment.qr_payload && payment.status === "pending" && <details className="border-t border-zinc-800 px-5 py-4 sm:px-6"><summary className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500"><Copy className="size-3.5" aria-hidden="true" /> Show QR payload</summary><code className="mt-3 block break-all rounded-md bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-400">{payment.qr_payload}</code></details>}
        </section>
      </div>
    </main>
  );
}

function PaymentFallback() {
  return <main className="min-h-screen bg-[#09090b] px-4 py-8 text-zinc-100" aria-busy="true"><div className="mx-auto max-w-3xl space-y-5"><div className="h-14 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" /><div className="h-[30rem] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/70" /></div></main>;
}

export default function BakongPaymentPage(props: PageProps<"/payments/[paymentId]">) {
  return <Suspense fallback={<PaymentFallback />}><BakongPaymentContent {...props} /></Suspense>;
}
