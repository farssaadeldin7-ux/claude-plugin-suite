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

## Plans

Every plugin sells the same two-plan shape — `pro` (2 seats) and `team` (10 seats),
each gating the features its MCP server checks — priced per plugin on the value the
tool returns, not a flat tier. From `catalog.js`:

| Plugin | Pro | Team |
| --- | --- | --- |
| Customer Sales Support | $1,000/mo | $5,000/mo |
| Ghost Post Preview (Sales and Outreach) | $500/mo | $2,000/mo |
| Predictive Resource Allocation | $500/mo | $2,500/mo |
| Emotional Resonance Analyzer | $500/mo | $1,500/mo |
| Generative Digital Twin | $200/mo | $500/mo |
| Code-to-Visual Interpreter | $150/mo | $400/mo |
| Podcast & Video Studio | $100/mo | $300/mo |
| Haptic Feedback Mapper | $100/mo | $300/mo |
| Neural-Link Intention Layer | $100/mo | $300/mo |
| Diagnose by Sound | $50/mo | $150/mo |
| Professor Mind-Reader | $50/mo | $150/mo |
| Mental-Health Chatbot | $20/mo | $50/mo |
| 5-Minute Fluency | $10/mo | $30/mo |
| Basecamp Split | $5/mo | $15/mo |

Env keys follow the plugin codes: `STRIPE_PRICE_<CODE>_PRO` / `_TEAM` for DBS, GPP,
PMR, FMF, BCS, PVS, CSS, HFM, MHC, NLI, GDT, ERA, CVI and PRA.

## Usage-based pricing inside the plans

Where the honest unit is a thing processed rather than a month, the plan carries an
included quota on the existing usage meters (`limits` in the catalog, enforced by
`checkQuota`/`recordUsage` and `/v1/usage`) — no extra plans, the unit economics live
inside pro and team:

| Plugin | Meter | Pro includes | Team includes | Effective unit price |
| --- | --- | --- | --- | --- |
| Ghost Post Preview | `previews_per_month` | 10 | 40 | ≈ $50 per reviewed draft — the per-lead economics of the outreach it powers |
| Podcast & Video Studio | `episodes_per_month` | 20 | 60 | ≈ $5 per episode processed |

Two more price on units without a meter: Emotional Resonance Analyzer is per editor
seat (pro ≈ $250/seat at 2 seats, team ≈ $150/seat at 10 — the "$500 per project"
framing is the pitch, one project a month at pro); Basecamp Split's per-trip
alternative ($20/trip) is storefront framing — at $5/mo flat, one trip a month already
beats it. Everything else is flat: the value returned does not divide into countable
units. Exhausted quotas return `quota_exceeded` with the counts; the reset is the
subscription period.

## The three tiers

Every plugin ships three tiers without three plan objects:

| Tier | What it is | Price |
| --- | --- | --- |
| **Starter** | The open tier that already exists: the skill content and every reference/browse tool, no licence needed. Enough to run the method by hand and evaluate before buying. No compute tools, no history. | $0 |
| **Pro** | The `pro` plan: every tool, 2 seats, the included usage above. | Per-plugin table |
| **Enterprise** | The `team` plan: every tool, 10 seats, the larger quotas, priority support, and custom integration by arrangement — volume beyond 10 seats or bespoke quotas are a conversation, priced against the same catalog. | Per-plugin table |

There is no free *paid-features* plan and no trial of the gated tools — Starter is free
because the method is open, not because the compute is. (A plugin that wants additional
client-side free features can declare them via `LicenseClient`'s `freeTier` option; see
`docs/LICENSING.md`.)

## The pilot motion

The three highest-priced plugins — Customer Sales Support, Ghost Post Preview (Sales
and Outreach) and Predictive Resource Allocation — are never sold cold into an annual
commitment. Month one of `pro` **is** the paid pilot, with no separate SKU: agree the
success metric before checkout (regression-set accuracy on the buyer's own tickets;
replies logged against the outreach log; a prevented out-of-memory failure on a real
job), run the month, then the subscription either continues on the measured result or
is cancelled at period end — Stripe subscriptions make the exit free. The pilot price
is therefore the pro price ($1,000 / $500 / $500), and the pitch is the fraction-of-
value rule: the tool asks for a slice of what the pilot just measured it returning.

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
