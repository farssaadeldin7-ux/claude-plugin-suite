# Runbooks

Four incidents that will happen, written before they do. Each one names the
symptom you will actually see first, not the cause.

The billing service is one process with one JSON store and no third-party
dependency. That shape makes most of these shorter than they would otherwise
be, and it is also the reason the store file matters more than anything else
here: it *is* the customer list.

---

## Stripe webhooks are failing

**You will notice** customers paying and not receiving a key, or the Stripe
dashboard's webhook endpoint showing a climbing failure count.

1. **Confirm it is the webhook, not checkout.** Stripe Dashboard →
   Developers → Webhooks → your endpoint. A 4xx is our fault; a timeout or
   connection error is the host.
2. **Check the signing secret first.** A rotated endpoint secret that was not
   redeployed produces a 400 on every delivery with a correct-looking payload.
   `STRIPE_WEBHOOK_SECRET` must be the endpoint's secret (`whsec_…`), never
   the API key.
3. **Nothing is lost while you fix it.** Stripe retries a failed delivery for
   up to three days. Once the endpoint is healthy, use *Resend* on the failed
   events; the service claims each `event.id` before handling it and answers
   a replay with `deduplicated`, so resending is safe and cannot double-issue.
4. **If a customer needs their key now**, do not wait for the retry:
   `node services/billing/scripts/find-license.mjs --email <their email>`
   reads the store directly.

**Do not** disable signature verification to "unblock" a queue. An unsigned
endpoint will issue licences to anyone who posts to it.

---

## The wrong billing URL shipped

**You will notice** every paid tool in every plugin failing for every
customer at once, with a licence-check error naming `billing.example.com`.

1. Confirm: unpack any published archive and look — `unzip -p <file>.plugin
   packages/suite-runtime/license-client.js | grep -n 'billing\.'`, or just run
   `node test/shipped-artifacts.test.mjs`, which does it for all fourteen.
2. `node scripts/bake-billing-url.mjs https://<your billing host>`
3. `node scripts/build.mjs`
4. `RELEASE=1 node test/shipped-artifacts.test.mjs` — this fails if any
   archive still carries the placeholder. It is the gate that should have
   caught it, and it runs on every tagged release.
5. Republish. Customers do not need to reinstall if the host is reachable at
   the URL already baked into what they have; they do if the baked URL is
   wrong, which is why this is worth a fast turnaround.

---

## Restore the store

**You will notice** licence checks returning `missing_license` for customers
who definitely have one, or the service refusing to start with
`store_unreadable`.

The store is a single JSON file at `BILLING_STORE_FILE`. It is the whole
customer list. It is written with a lock, an fsync and a rename, so a crash
mid-write cannot truncate it — but nothing protects against the disk going
away.

1. **Do not restart the service repeatedly.** It refuses to start on an
   unreadable store precisely so that the next write cannot replace it with
   an empty one. That refusal is protecting the file.
2. Move the damaged file aside, never delete it: `mv store.json
   store.json.broken-$(date +%s)`.
3. Restore the most recent backup to `BILLING_STORE_FILE` and start the
   service.
4. **Reconcile against Stripe**, which is the real source of truth for who
   has paid: every active subscription should correspond to a licence. Any
   that does not, re-issue by resending that customer's
   `checkout.session.completed` from the Stripe dashboard — the service is
   idempotent on the session id and will not create a duplicate.
5. Record how far back the backup was and how many licences had to be
   re-issued.

**If there is no backup**, Stripe still has every paying customer. The
licence keys themselves are unrecoverable and each affected customer needs a
new one issued and emailed.

---

## Rotate a key

**Do this** whenever a key has been pasted into a chat, a ticket, a log, a
screenshot, or a document — not only when you know it leaked.

**Stripe secret key**
1. Stripe Dashboard → Developers → API keys → *Roll key*. Stripe keeps the
   old one working for a grace window you choose; pick the shortest one that
   lets you deploy.
2. Update `STRIPE_SECRET_KEY` in the host's secret manager, not in a file.
3. Redeploy. The service refuses to start if the new value is malformed, so a
   paste error surfaces at boot rather than at the next sale.
4. Expire the old key before its window ends.

**Webhook signing secret**
1. Add a *second* signing secret on the endpoint before removing the first —
   the service accepts either during rotation, so no delivery is lost.
2. Deploy with the new one, confirm deliveries are succeeding, then remove
   the old secret in Stripe.

**A licence key a customer exposed**: `POST /v1/license/release` frees the
seat; issue a replacement and mark the old key inactive in the store.

---

## Before you need any of this

- `BILLING_STORE_FILE` must point at a persistent disk, not a path inside the
  container. The service refuses to start in production without it set,
  because the default is inside the container and every licence is lost on
  the next deploy.
- Back that file up daily, and **restore it once, on purpose**, before you
  need to. A backup nobody has restored is a hypothesis.
- Keep `sk_test_` out of production. The service refuses to start on a test
  key when `BILLING_ENV=production`: a test key issues real licences against
  payments that never happened, and nothing looks wrong until the month's
  revenue is compared with the licence count.
