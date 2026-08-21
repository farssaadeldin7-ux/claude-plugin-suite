# Plugin Suite

Fourteen domain-expert plugins for Claude Code and Cowork. Each one encodes how a
specialist in that field actually works — the order they do things in, the question that
splits the field fastest, and the point at which they say they do not know.

Installable as a marketplace:

```
/plugin marketplace add farssaadeldin7-ux/claude-plugin-suite
/plugin install diagnose-by-sound@plugin-suite
```

## The plugins

| Plugin | For | The judgement it encodes |
| --- | --- | --- |
| [`diagnose-by-sound`](plugins/diagnose-by-sound) | Mechanics, DIY | Characterise the noise before naming a cause; report calibrated confidence, not a guess |
| [`ghost-post-preview`](plugins/ghost-post-preview) | Creators, social teams | Name the most likely reason a post underperforms; never fabricate an engagement number |
| [`professor-mind-reader`](plugins/professor-mind-reader) | Students, professionals | Answer at the level the rubric verb demands; find the sentence that satisfies each criterion |
| [`five-minute-fluency`](plugins/five-minute-fluency) | Competitive players | Three changes maximum, ranked by rating gain per unit of practice |
| [`basecamp-split`](plugins/basecamp-split) | Guides, expedition leaders | Every critical system has a named owner and a stated backup, or the plan is not finished |
| [`podcast-video-studio`](plugins/podcast-video-studio) | Agencies, solo creators | A clip that needs context is disqualified however good it was in the room |
| [`support-agent-architect`](plugins/support-agent-architect) | E-commerce, SaaS | Hallucination is a knowledge-architecture defect; "I don't know" is a first-class outcome |
| [`sales-enablement-assistant`](plugins/sales-enablement-assistant) | B2B sales | No trigger, no email; if it survives find-and-replace it is a template |
| [`wellbeing-companion`](plugins/wellbeing-companion) | Telehealth, HR wellness | Escalation is never a judgement call the model makes about severity |
| [`neural-link-intention-layer`](plugins/neural-link-intention-layer) | Designers, UI/UX | Eliminate, then batch, then automate — in that order |
| [`digital-twin-collaborator`](plugins/digital-twin-collaborator) | Creative directors | A style is defined by what you never do; the "never" list matters most |
| [`emotional-resonance-analyzer`](plugins/emotional-resonance-analyzer) | Editors, documentarians | Flat stretches are the problem, not low stretches; real retention data always wins |
| [`code-to-visual-interpreter`](plugins/code-to-visual-interpreter) | Creative technologists | Structure, modulation, surface — and a seeded PRNG or the piece is unreviewable |
| [`predictive-resource-allocation`](plugins/predictive-resource-allocation) | 3D, VFX, ML | Find the binding constraint first; buying hardware is the last remedy, not the first |

Audiences, the skill each user must bring, and the monetisation shape are in
[`docs/AUDIENCES.md`](docs/AUDIENCES.md).

## Design rules

These are enforced by review, and partly by `scripts/validate.mjs`.

1. **No overclaiming.** If the premise implies a capability that does not exist — reading
   minds, measuring an audience that was never asked, predicting a number from text — the
   plugin says so in its first paragraph and reframes as what it honestly is. A user who
   trusts a meaningless number is worse off than one who got nothing.
2. **Thresholds, not vibes.** "Under 15% separation, do not present a winner" beats
   "consider carefully". Every judgement in a skill should be checkable.
3. **The limits section is mandatory.** Every skill states what it cannot answer and when
   to say so.
4. **References carry the tables.** SKILL.md holds the procedure; lookup tables,
   taxonomies and worked examples live in `references/` and are pointed at from the step
   where they become relevant.
5. **British spelling. No emoji, no hype vocabulary.** The validator warns on both.

## Layout

```
.claude-plugin/marketplace.json   the marketplace manifest
plugins/<id>/                     one directory per plugin
  .claude-plugin/plugin.json      plugin manifest
  skills/<id>/SKILL.md            the procedure
  skills/<id>/references/*.md     tables, taxonomies, worked examples
  .mcp.json, mcp/                 only where a plugin ships a tool server
packages/suite-runtime/           shared MCP + licensing runtime, vendored into plugins
services/billing/                 the Stripe-backed licensing service the runtime talks to
scripts/                          validate, vendor, build
docs/                             architecture, audiences, licensing
```

## Working on it

```bash
node scripts/validate.mjs        # structure, manifests, frontmatter, dead references
node scripts/vendor-runtime.mjs  # after editing packages/suite-runtime
node scripts/build.mjs           # .plugin archives into dist/
```

CI runs all three on every push. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how
to add a plugin, and [`docs/LICENSING.md`](docs/LICENSING.md) for the free/paid split.

## Status

Version 0.1.0. `diagnose-by-sound` and `ghost-post-preview` ship working MCP servers;
the other twelve are skill-only and are the reference content the tool servers will be
built against.

## Licence

Proprietary. See [LICENSE](LICENSE).
