import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#2e2742] bg-[#08060f]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-x-10 gap-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <p className="text-base font-bold tracking-tight text-[#f5f2fb]">
            Nexus<span className="text-[#bda5ff]">Pay</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-[#a79dbc]">
            Game top-ups and digital subscriptions. Payments by Bakong KHQR and ABA PayWay.
          </p>
        </div>

        <nav aria-label="Shop" className="text-sm">
          <h3 className="font-semibold text-[#f5f2fb]">Shop</h3>
          <ul className="mt-2.5 space-y-2 text-[#a79dbc]">
            <li><Link href="/#catalog" className="hover:text-[#f5f2fb]">Catalog</Link></li>
          </ul>
        </nav>

        <nav aria-label="Support" className="text-sm">
          <h3 className="font-semibold text-[#f5f2fb]">Support</h3>
          <ul className="mt-2.5 space-y-2 text-[#a79dbc]">
            <li><Link href="/account/orders" className="hover:text-[#f5f2fb]">Order status</Link></li>
            <li><Link href="/login" className="hover:text-[#f5f2fb]">Log in</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[#2e2742]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[#8d84a3] sm:px-6 lg:px-8">
          <p>© 2026 NexusPay. Game names and logos belong to their respective publishers.</p>
          <p>Frontend preview — sample prices, ordering is paused.</p>
        </div>
      </div>
    </footer>
  );
}
