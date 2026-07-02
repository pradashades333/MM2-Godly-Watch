# Accounts & Premium — setup guide

The account system (sign in, $5 premium unlock, synced favorites, price alerts)
is fully feature-flagged: until you finish these steps, the site looks and works
exactly as before. There are 3 things to set up: **Supabase**, **env vars**, and
(optionally) a **Stripe webhook**.

## 1. Create the Supabase project (~5 min, free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**
   (any name, e.g. `godlywatch`; pick a region close to your Render server).
2. In the dashboard, open **SQL Editor → New query**, paste the whole contents of
   [`server/supabase-setup.sql`](server/supabase-setup.sql), and click **Run**.
   This creates the `profiles`, `favorites`, and `notifications` tables.
3. Go to **Authentication → Providers → Email** and make sure Email is enabled
   (it is by default). Leave "Confirm email" on — users get a confirmation email.
4. Go to **Project Settings → API** and copy three values:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key  → for the client
   - **service_role** key → for the server (keep this secret!)

## 2. Set environment variables

**Render** (server) — Dashboard → your service → Environment:

| Key | Value |
| --- | --- |
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |

`STRIPE_SECRET_KEY` should already be set from the marketplace.

**Vercel** (client) — Project → Settings → Environment Variables:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | the anon public key |

Then **redeploy both**. (For local dev, put the same values in `server/.env`
and `client/.env.local` — see the `.env.example` files.)

## 3. (Optional but recommended) Stripe webhook

Without this, premium still unlocks — the site verifies the payment with Stripe
when the buyer lands back on the success page. The webhook just makes it
bulletproof (works even if the buyer closes the tab):

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://mm2-godly-watch.onrender.com/api/account/stripe-webhook`
3. Event: `checkout.session.completed`
4. Copy the **Signing secret** (`whsec_...`) → add it on Render as
   `STRIPE_WEBHOOK_SECRET`.

## What users get

- **Free** — everything the site does today (boards, trade checker, local favorites).
- **Sign in (free)** — an account, plus the premium upsell in the account menu.
- **Premium ($5 one-time, Stripe)** —
  - favorites synced to their account across devices/browsers
  - a 🔔 price-alert inbox: whenever an hourly refresh detects a value change on
    a favorited item, they get an alert (generated server-side, deduplicated)

## Pricing knobs

Defaults: **$5.00 USD**. Override on Render with `PREMIUM_PRICE_CENTS` (e.g.
`499`) and `PREMIUM_CURRENCY` (e.g. `eur`) — no code change needed.
