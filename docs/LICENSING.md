# Licensing

One billing service across all fourteen plugins. A user holds a single account; entitlements
are per plugin, or one suite entitlement covering all of them. The service itself lives in
[`services/billing/`](../services/billing/), with the plan catalog in its `catalog.js`.

## Resolution order

The client looks for a key in this order and stops at the first hit:

1. `<PLUGIN_ENV_PREFIX>_LICENSE_KEY` — for example `DIAGNOSE_BY_SOUND_LICENSE_KEY`
2. `PLUGIN_SUITE_LICENSE_KEY` — one key for the whole suite
3. `~/.config/plugin-suite/<plugin-id>.json` — written by the `license_activate` tool

The billing host comes from `PLUGIN_SUITE_BILLING_URL`, falling back to the default compiled
in at build time.

## Device identity

Derived, not random: a SHA-256 of hostname, username, platform and architecture, truncated to
32 characters. It survives a reinstall, which means a user who reinstalls does not burn a
seat. Config is written to `~/.config/plugin-suite/` with mode `0600` in a `0700` directory.

## Free versus paid

The split is the same principle everywhere in the suite:

- **Free** — everything needed to establish that the plugin's judgement is worth having. The
  taxonomy, the procedure, the main analysis call. A free user should get a real answer.
- **Paid** — what saves time once the user already trusts the answer. Plans, ordered
  sequences, parts and labour, persistent history, batch operations, exports.

A free tier that produces a deliberately crippled answer teaches the user the tool is bad.
The free tier should be genuinely useful and obviously incomplete, which is a different thing.

## Failure behaviour

Entitlement is cached for five minutes, and network calls time out at eight seconds. If the
billing service is unreachable:

- A previously valid cached entitlement continues to work. Do not lock a paying user out
  because a server is down.
- An unknown state degrades to the free tier with a clear message, never to an error.
- Nothing about the licence check is written to stdout, which carries the MCP protocol.

## Enforcement scope

Licensing gates MCP tools, not skill content. Skills are markdown inside an installed
archive and are readable by anyone who has the file; pretending otherwise would be theatre.
The defensible product is the tool server, the knowledge base it queries, and the updates.
Price accordingly.
