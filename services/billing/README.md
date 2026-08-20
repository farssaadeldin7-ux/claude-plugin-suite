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
| `POST /v1/trial` | Issue a 14-day trial key (one per email per plugin). |
| `POST /v1/checkout` | Create a Stripe Checkout session for a paid plan. |
| `GET /v1/catalog/:plugin_id` | Plans, prices, features, limits, seats. |
| `POST /v1/portal` | Stripe billing portal session for a paid licence. |
| `POST /v1/stripe/webhook` | Signature-verified; issues keys on `checkout.session.completed`, tracks subscription updates and cancellations. |
| `GET /success?session_id=` | Post-checkout page that shows the licence key once. |
| `GET /health` | Liveness. |

## Plans — Diagnose by Sound

| Plan | Price | Seats | Diagnoses / month | Includes |
| --- | --- | --- | --- | --- |
| free (client-side) | $0 | — | unmetered | `diagnose`, vocabulary, signature browsing |
| `trial` (14 days) | $0 | 1 | 25 | everything |
| `pro` | $29/mo | 2 | unlimited | `diagnose`, `repair_plan`, `history` |
| `team` | $79/mo | 10 | unlimited | `diagnose`, `repair_plan`, `history` |

The free tier is not a plan the service issues — it is what the client grants on its own when
no key is configured (see `docs/LICENSING.md`). Plans for the other thirteen plugins are
added in `catalog.js` as they launch.

## Configuration

Copy `.env.example`. Required in production:

- `STRIPE_SECRET_KEY` — the account's secret key
- `STRIPE_WEBHOOK_SECRET` — the endpoint secret for `/v1/stripe/webhook`
- `STRIPE_PRICE_DBS_PRO`, `STRIPE_PRICE_DBS_TEAM` — Price ids created in the Stripe
  dashboard for the two paid plans
- `BILLING_PUBLIC_URL` — the public https URL of this service (used for checkout
  success/cancel URLs)

Optional: `PORT` (default 8787), `BILLING_STORE_FILE` (default `data/store.json` beside the
server), `STRIPE_API_BASE` (tests point this at a mock; leave unset in production).

Once deployed, either bake the URL into `DEFAULT_BILLING_URL` in each plugin's `server.js`
before building archives, or have users set `PLUGIN_SUITE_BILLING_URL`.

## Stripe setup

1. Create two recurring Prices ($29/mo, $79/mo) and put their ids in the env.
2. Add a webhook endpoint for `https://<host>/v1/stripe/webhook` subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Tests

`node services/billing/test/e2e.mjs` boots the real server against a mock Stripe and walks
every flow: trial issue and re-issue refusal, entitlement and seat enforcement, plugin
scoping, usage idempotency, checkout session creation, webhook signature rejection and
replay dedupe, key issuance on completed checkout, portal, and cancellation. CI runs it on
every push.
