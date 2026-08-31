# 5-Minute Fluency

Turns a described gameplay problem into a one-page cheat sheet you can absorb before
the next match.

Part of a 14-plugin suite sharing one Stripe-backed licensing service.

## What it does

Anyone can produce twelve true pieces of advice about a plateau. A coach produces three,
in the right order, and discards nine things that were also correct. The constraint is
the product: **one page, five minutes, three changes maximum.**

- Diagnoses before it prescribes. "I keep dying" has four common root causes and they
  need four different sheets, so the skill asks the discriminating question first.
- Ranks every candidate change by expected rating gain per unit of practice effort,
  keeps the top three, and shows you what was cut and why.
- Frames advice on the genre's primary skill axis — macro and rotations for MOBAs, ult
  economy for hero shooters, utility and trade discipline for tactical FPS, neutral and
  frame data for fighting games, build order and economy for RTS and auto-battlers,
  braking points for racing.
- Attaches a five-word trigger phrase to each change, so it can be recalled mid-fight
  rather than only remembered afterwards.
- Ends with a drill under ten minutes and a countable success check for next session.

## Components

| Component | Purpose |
| --- | --- |
| Skill `five-minute-fluency` | The interview, the diagnosis, the judgement calls, writing the sheet |
| MCP server | Symptom map, genre axes, sheet format, yield scoring, sheet lint, sheet log, licensing |

### Tools

**Open** — no licence needed, enough to evaluate the method before buying

- `symptom_map` — complaints, candidate root causes, and the discriminating question for each
- `genre_axes` — per-genre primary axis, plateau, drill, and what is patch-sensitive
- `sheet_format` — the fixed one-page format, trigger rules and the failure table

**Licensed** — requires a pro or team key

- `score_changes` — Yield = (Impact × Transfer) ÷ Cost, thresholds, top three, constraint checks
- `sheet_lint` — mechanical checks on a drafted sheet, with the evidence quoted
- `log_sheet` / `record_session` / `review_sheets` — the local sheet log and success-check tally

**Licensing** — `license_status`, `license_activate`, `start_checkout`, `list_plans`,
`billing_portal`

The server is deterministic throughout: it scores arithmetic the caller supplies, checks a
draft against the fixed format, and counts results. It never diagnoses a player, invents a
score, or judges a sheet.

## Setup

The MCP server has no npm dependencies and needs no install step.

Point it at your billing service:

```bash
export PLUGIN_SUITE_BILLING_URL=https://billing.yourdomain.com
```

Then buy a plan from the pricing page (or with `start_checkout` from inside a
conversation) and paste the key — it will be stored at
`~/.config/plugin-suite/five-minute-fluency.json`.

A key can also be supplied by environment variable, which takes precedence:

```bash
export FIVE_MINUTE_FLUENCY_LICENSE_KEY=PS-FMF-...
# or, shared across the whole suite:
export PLUGIN_SUITE_LICENSE_KEY=PS-FMF-...
```

## Who it is for

Competitive players who want to improve and do not want to spend an evening on research
to do it. It is built for the twenty minutes before a ranked session, not for a
structured coaching programme.

## What using it well requires

Honest self-report. The whole diagnosis runs on your description of your own play, so
the sheet is only as good as your answers to three questions. "I die early, usually
alone, usually after we lost the last fight" produces a useful sheet. "I'm just bad"
does not.

You also need to bring the patch. The skill has no live feed, so tell it what season or
version you are on and check anything it marks `[verify]` in your own client.

## Free and paid

The knowledge base is open: the symptom map, the genre axes and the sheet format can be
browsed without a key, which is enough to run the method by hand and decide whether the
judgement is worth having. A licence buys the tools that save time once it is — the yield
scoring, the sheet lint, and the local sheet log that scores each success check against
the next session.

## Version honesty

**There is no live patch feed and no meta database.** The skill does not know the
current tier list, the current cooldowns or this week's costs, and it will not pretend
otherwise. Anything patch-sensitive is either asked from you or written on the sheet as
`[verify]`. The sheets it produces are weighted towards structural advice — trade
discipline, wave state, ult economy, braking consistency — because that is what stays
correct across patches.

## What this is not

- **Not a replacement for VOD review.** A human watching your replay is more accurate
  than any description-based diagnosis. This trades accuracy for speed.
- **Not a rank checker.** It has no access to your account, match history or MMR.
- **Not mechanical training.** Aim, execution and combo consistency come from weeks of
  reps. The sheet points at the drill; it cannot do the reps.
- **Not a tier list or a build guide.** See version honesty above.
- **Not a fix for tilt in one page.** If the problem is mostly frustration, the sheet
  will be about session structure instead of tactics, and it will say so.

## The skill you bring

**Scalable Backend Architecture.** The build-out skill behind this plugin's most scalable form: an on-demand coach serving live game state to many concurrent players is a low-latency streaming problem, and solving it is the defensible moat. As a player, what you bring today is simpler — an accurate self-report of what actually happens in your matches.

## Plans

Pricing is defined in the suite catalog: pro $10/month (2 seats) and team $30/month
(10 seats). Both include the same tools — the licence gates `score_changes`,
`sheet_lint` and the sheet log (`log_sheet`, `record_session`, `review_sheets`); the
knowledge-base tools stay open.

## Privacy

The sheet log — games, diagnoses, success checks, results — is written only to
`~/.config/plugin-suite/five-minute-fluency-sheets.json` on the machine that created it.
The billing service sees a licence key, a plugin id and a hashed device identifier. It
never sees a sheet.
