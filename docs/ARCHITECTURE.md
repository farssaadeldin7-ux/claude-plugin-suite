# Architecture

## Repository shape

A single marketplace repository. `.claude-plugin/marketplace.json` at the root lists every
plugin by relative path, so `/plugin marketplace add <owner>/<repo>` exposes all fourteen at
once and each can be installed independently.

Plugins are self-contained. Nothing in `plugins/<id>/` may import from outside that
directory at runtime, because a plugin is distributed as a standalone `.plugin` archive and
installed without an npm step. Shared code is **vendored**, not depended on.

## Anatomy of a plugin

```
plugins/<id>/
  .claude-plugin/plugin.json     name (must equal directory), version, description, author,
                                 license, keywords
  README.md                      what it does, who for, what it is not, tiers
  skills/<id>/
    SKILL.md                     frontmatter + the procedure, 120–200 lines
    references/*.md              tables, taxonomies, worked examples, 60–150 lines each
  .mcp.json                      only if the plugin ships a tool server
  mcp/
    server.js                    tool definitions and handlers
    mcp-lite.js                  vendored from packages/suite-runtime
    license-client.js            vendored from packages/suite-runtime
    lib/, data/                  plugin-specific logic and knowledge base
```

### SKILL.md contract

Frontmatter needs `name` (matching the directory) and a `description` written for *matching*,
not marketing: it should contain the phrases a user actually types. Descriptions under 120
characters trigger a validator warning, because short descriptions match unreliably.

The body follows a fixed shape: framing paragraph, **The one rule**, a numbered **Sequence**
with explicit thresholds, and a **limits** section. Reference files are pointed at by name
from the step where they become relevant — the validator errors on a pointer to a file that
does not exist, and warns on a reference file nothing points at.

### Why references are separate

Everything in SKILL.md competes for attention on every invocation. Lookup tables are needed
in one step out of six. Splitting them keeps the procedure legible and lets the tables be as
long as the domain requires.

## The shared runtime

`packages/suite-runtime/` holds two files:

- **`mcp-lite.js`** — a dependency-free MCP server over stdio. Implements `initialize`,
  `tools/list`, `tools/call` and `ping` on newline-delimited JSON-RPC 2.0. Nothing may be
  written to stdout except protocol messages; use `logDiagnostic()`, which goes to stderr.
- **`license-client.js`** — talks to the shared billing service. Resolves a licence key from
  `<PLUGIN>_LICENSE_KEY`, then `PLUGIN_SUITE_LICENSE_KEY`, then
  `~/.config/plugin-suite/<plugin-id>.json`. Derives a stable device id from hostname, user,
  platform and arch so it survives reinstalls, and caches entitlement for five minutes.

Edit these here, then run `node scripts/vendor-runtime.mjs` to copy them into every plugin
that has an `mcp/` directory. CI fails if the copies are stale.

## Adding a plugin

1. Create `plugins/<id>/.claude-plugin/plugin.json` and `skills/<id>/SKILL.md`.
2. Add the entry to `.claude-plugin/marketplace.json` with a category.
3. Write the README, including a "what this is not" section.
4. `node scripts/validate.mjs` until clean.
5. If it needs tools, add `.mcp.json` and `mcp/server.js`, then vendor the runtime.

The validator will not let you forget the marketplace entry — a directory that is not listed
is an error, and so is a listing with no directory.

## Adding a tool server to an existing skill

Skills and MCP servers are separable on purpose. All fourteen plugins now ship servers; the
skill content is the specification each server was built against. When adding one:

- Free-tier tools should be the ones that make the skill work at all. Paid tools are the
  ones that save the user time once they are already getting value.
- Tool results are read by a model, not a human. Return structured data with explicit
  confidence and provenance fields rather than prose.
- Never return a bare number where the skill's own honesty rules require a caveat. Put the
  caveat in the payload, where it cannot be dropped.
