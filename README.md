# NexusPay

NexusPay is a game top-up and digital subscription storefront built with Next.js
16, TypeScript, Tailwind CSS, Supabase, and PostgreSQL.

The app is currently in **frontend-only preview mode**. It uses a local sample
catalog and does not contact Supabase. Sign-in, orders, payments, and admin
routes are paused; cart interactions stay in the browser, and checkout is a
non-purchasable preview. Sample names and prices are not live offers.

## Local setup

1. Install Node.js 20.9 or newer and npm.
2. Install project dependencies:

   ```powershell
   npm install
   ```

3. Start the frontend preview. `.env.example` enables it by default; make sure
   `.env.local` contains:

   ```powershell
   NEXT_PUBLIC_FRONTEND_PREVIEW=true
   ```

4. Run the frontend:

   ```powershell
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). Frontend preview mode can
be turned off later by setting `NEXT_PUBLIC_FRONTEND_PREVIEW=false` and
configuring the Supabase keys below.

## Reconnect Supabase later

When ready to reconnect, install the Supabase CLI and Docker Desktop. This repo
uses isolated Supabase stack mode so its local database can run beside another
Supabase project. Start the core local services, create `.env.local` from the
local API URL and anon key, then apply migrations:

```powershell
npx supabase start --exclude realtime,storage,functions,studio,mail,analytics --eager
npx supabase status --env --output-format text --override-name API_URL=NEXT_PUBLIC_SUPABASE_URL,ANON_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY > .env.local
Add-Content .env.local 'NEXT_PUBLIC_FRONTEND_PREVIEW=false'
Add-Content .env.local 'NEXT_PUBLIC_CATALOG_PREVIEW=true'
npx supabase db reset
```

The CLI assigns this app its own stable local ports. Use `npx supabase status`
to view its local API URL and service state. The database reset loads a small
local-only catalog. Keep catalog preview enabled until supplier offers and
prices are verified.

Set the Supabase URL and public key in `.env.local`. Never put a Supabase
service-role key in a `NEXT_PUBLIC_*` variable or browser code. Authentication
is available at `/login`; email confirmation redirects through `/auth/callback`.

The local migration creates a customer role on signup. To grant the first owner
role, use the Supabase SQL editor with the trusted user's profile UUID:

```sql
INSERT INTO public.profile_roles (profile_id, role_id)
SELECT '<trusted-profile-uuid>', id
FROM public.roles
WHERE role_key = 'owner';
```

Do not expose role assignment through public registration or client-side code.

## Checks

```powershell
npm run lint
npm run build
```

The phase-by-phase scope and completion gates are in
[docs/development-roadmap.md](docs/development-roadmap.md).
