# Billing service

One deployment licenses all fourteen plugins. It implements exactly the API the vendored
`license-client.js` speaks, plus the Stripe webhook that turns a completed checkout into a
licence key.

No npm dependencies — `node services/billing/server.js` is the whole deployment. State is a
single JSON file (atomic writes, `0600`); the `Store` class in `lib/store.js` is the seam to
swap in a real database later.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /v1/entitlement?plugin_id&device_id` | Entitlement check (Bearer licence key). Registers the device against a seat. |
| `POST /v1/usage` | Metered usage, idempotent per `idempotency_key`. |
| `POST /v1/license/activate` | Bind a key to a device. |
| `POST /v1/checkout` | Create a Stripe Checkout session for a paid plan. |
| `GET /v1/catalog/:plugin_id` | Plans, prices, features, limits, seats. |
| `POST /v1/portal` | Stripe billing portal session for a paid licence. |
| `POST /v1/stripe/webhook` | Signature-verified; issues keys on `checkout.session.completed`, tracks subscription updates and cancellations. |
| `GET /success?session_id=` | Post-checkout page that shows the licence key once. |
| `GET /health` | Liveness. |

## Plans — Diagnose by Sound

| Plan | Price | Seats | Diagnoses / month | Includes |
| --- | --- | --- | --- | --- |
| `pro` | $40/mo | 2 | unlimited | `diagnose`, `repair_plan`, `history` |
| `team` | $70/mo | 10 | unlimited | `diagnose`, `repair_plan`, `history` |

**Ghost Post Preview** sells the same shape: pro $40/mo (2 seats, unlimited) · team
$70/mo (10 seats, unlimited), gating the
`draft_lint` pass and the prediction log (`STRIPE_PRICE_GPP_PRO` / `_TEAM`).

The other twelve plugins sell the same shape — pro (2 seats) and team (10 seats),
each gating the `tools` feature its MCP server checks. Standard tier is pro $40/mo ·
team $70/mo; the two premium plugins — Customer Sales Support and Predictive
Resource Allocation — are pro $500/mo · team $2,000/mo. Env
keys follow the plugin codes: `STRIPE_PRICE_<CODE>_PRO` / `_TEAM` for PMR, FMF, BCS,
PVS, CSS, HFM, MHC, NLI, DTC, ERA, CVI and PRA.

No plugin has a free plan or a trial — every gated tool needs a paid licence. (A plugin
that wants client-side free features can declare them via `LicenseClient`'s `freeTier`
option; see `docs/LICENSING.md`.)

## Going live — two commands

Everything Stripe-side is provisioned by script; nothing is clicked together in the
dashboard. With the account's secret key and the URL the service will live at:

```bash
STRIPE_SECRET_KEY=sk_live_... BILLING_PUBLIC_URL=https://billing.yourdomain.com \
  node services/billing/scripts/setup-stripe.mjs
```

Idempotent — it ensures a Product and recurring Price per paid plan (found again by
deterministic product id and price lookup key; a repriced plan gets a new Price that takes
over the lookup key), ensures the webhook endpoint subscribed to the three events the
server handles, and writes the resulting ids and secrets to `.env` (git-ignored, `0600`).
Re-run it after changing `catalog.js` prices. `--recreate-webhook` rotates a lost signing
secret.

Then start the service:

```bash
node --env-file=services/billing/.env services/billing/server.js
```

or as a container on any host (Cloud Run, Fly, Railway, a VPS):

```bash
docker build -t plugin-suite-billing services/billing
docker run -p 8787:8787 --env-file services/billing/.env -v billing-data:/data plugin-suite-billing
```

Finally point the plugins at the deployment — baked into the archives in one command:

```bash
node scripts/bake-billing-url.mjs https://billing.yourdomain.com
node scripts/build.mjs
```

(Users can still override with `PLUGIN_SUITE_BILLING_URL` at runtime.)

## Configuration reference

`.env.example` lists the variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_DBS_PRO`, `STRIPE_PRICE_DBS_TEAM`, `BILLING_PUBLIC_URL` — all written by
`setup-stripe.mjs` — plus `BILLING_ALLOWED_ORIGINS` (comma-separated browser origins
allowed to call checkout/catalog, i.e. the storefront site), optional `PORT`
(default 8787), `BILLING_STORE_FILE` (default `data/store.json` beside the server,
`/data/store.json` in the container), and `STRIPE_API_BASE` (tests point this at a mock;
leave unset in production).

## Tests

`node services/billing/test/e2e.mjs` boots the real server against a mock Stripe and walks
every flow: key issuance through signed webhooks, entitlement and seat enforcement,
plugin scoping, usage idempotency, checkout session creation, webhook signature
rejection and replay dedupe, portal, cancellation, and the
`setup-stripe.mjs` provisioning script (including that re-runs create nothing new). CI
runs it on every push.
