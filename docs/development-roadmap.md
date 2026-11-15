# UsTopUp Development Roadmap

## Product and design baseline

Keep the supplied NexusPay storefront as the visual reference: near-black
background, zinc borders and surfaces, compact controls, subtle transitions,
responsive grids, and concise labels. Customer and staff screens reuse this
design language. The catalog supports games and digital AI subscriptions such as
ChatGPT, Gemini, and Claude; only list plans that UsTopUp is authorized to sell.

## Phase status

| Phase | Status | Delivered |
| --- | --- | --- |
| 1. Foundation | Implemented | Next.js 16 App Router, Supabase SSR authentication, profile roles, PostgreSQL schema, RLS, and local Docker database. |
| 2. Catalog | Implemented | Database backed public catalog, admin product/package/required-field CRUD, pricing snapshots, and supplier cost records. |
| 3. Ordering | Implemented | Server validated customer fields, atomic idempotent orders, immutable price snapshots, receipts, and customer order history. |
| 4. Payments | Implemented, credentials required | Bakong KHQR generation and server verification; ABA PayWay signed checkout, signed callback validation, and independent transaction status verification; refund records. |
| 5. Fulfillment | Implemented as an operations boundary | Supplier mapping, queued jobs, manual fulfillment status changes, completion tracking, and auditable failure/review states. Automatic supplier APIs need individual vendor credentials and contracts. |
| 6. Admin operations | Implemented | Protected dashboard, orders, catalog, suppliers, fulfillment, refunds, and audit history. |
| 7. Production readiness | Code and configuration guidance delivered; external launch steps remain | Rate limits, service-only verification, audit events, environment template, and this launch checklist. Cloud credentials, provider onboarding, production-like payment verification, and deployment belong to the account owner. |

## Local setup

1. Install dependencies with `npm ci` and copy `.env.example` to `.env.local`.
2. Set the Supabase public URL and anon key. Keep `SUPABASE_SERVICE_ROLE_KEY`
   server-only; never use a `NEXT_PUBLIC_` prefix for secrets.
3. Apply the ordered files in `supabase/migrations/` to the target Supabase
   project. The development database in this workspace has these migrations
   applied locally.
4. Create an owner account, then grant its role through a trusted Supabase
   administrative session. Public signup cannot assign staff roles.
5. Add Bakong SIT credentials and PayWay sandbox credentials before testing
   those provider flows. `APP_BASE_URL` must be the public HTTPS site origin
   registered with PayWay. Local HTTP development is allowed on `localhost`.
6. Keep `NEXT_PUBLIC_CATALOG_PREVIEW=true` while the catalog contains sample
   offers; order creation and payment are blocked in this mode. Change it to
   `false` only after verifying product availability and prices.
7. Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` before deployment.

## Provider onboarding and operational requirements

### Bakong

- Register/enable the merchant account and obtain the Bakong Open API token.
- Configure `BAKONG_API_BASE_URL` to the SIT endpoint for sandbox, then the
  production endpoint after approval. Set merchant account ID, display name,
  and city accurately.
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set: provider verification uses a
  trusted database function and is not callable by customer sessions.

### ABA PayWay

- Register a sandbox merchant to receive Merchant ID and API key; obtain live
  production credentials separately.
- Set `ABA_PAYWAY_API_BASE_URL` to the sandbox endpoint first. Set
  `ABA_PAYWAY_MERCHANT_ID`, `ABA_PAYWAY_API_KEY`, and `APP_BASE_URL`.
- Ask ABA to whitelist the deployed domain/IP and configure
  `https://<your-domain>/api/payments/payway/callback` as the callback URL.
- After end-to-end sandbox payment and callback checks, switch the API base and
  credentials together to production. Do not treat a browser redirect or the
  callback's status field alone as proof of payment; the server checks PayWay's
  transaction-status API and then compares the exact amount and currency.

### Catalog and fulfillment

- Replace sample catalog entries and prices with supplier-approved current
  offerings; prices shown in preview data are not real offers.
- Add a supplier mapping only after confirming the supplier's API, delivery
  semantics, retry rules, and credentials. Until then, orders remain in manual
  review and staff mark completion only after delivery is confirmed.
- Process refunds in the external payment provider first, then record the
  confirmed amount and reference in UsTopUp. The refund screen does not move
  money itself.

## Security and state boundaries

- Payment confirmation is separate from order processing and product delivery.
- Customer data is read under RLS. Trusted service credentials are used only in
  server code and verification RPCs.
- Audit events cover sensitive catalog and supplier changes. Staff actions
  require server-side role checks.
- Do not activate automatic fulfillment until a real provider adapter and its
  reconciliation behavior are implemented and configured.
