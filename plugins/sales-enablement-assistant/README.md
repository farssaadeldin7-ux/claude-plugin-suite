# Sales Enablement Assistant

Research a B2B account, find the real reason to reach out now, and write outreach that
reads like a person wrote it.

Part of a 14-plugin suite.

## What it does

An amateur starts with the message and hunts for a reason to justify it. A good account
executive starts with the reason. This plugin enforces that order and refuses to write
a message when there is no reason.

- A ranked trigger hierarchy, from funding rounds down to public commentary, with
  verification sources and a freshness window for each
- A hard stop when the only available "trigger" is firmographics, which is where most
  cold outreach actually comes from
- The find-and-replace test: an opening line that survives a company-name swap is a
  template and gets rewritten
- Structural constraints with real thresholds, not preferences: under 120 words, one
  idea, one link, one question, a two-to-five-word lowercase subject
- A list of the specific markers that make a message read as AI-written, each with a
  before and after rewrite, plus a ten-point self-audit
- A three-touch sequence where every follow-up must add information the previous one
  did not contain, and a breakup rule that ends it
- A GDPR, PECR, CAN-SPAM and CASL checklist that flags missing opt-out and sender
  identification

## Who it is for

B2B sales teams and account executives. The skill you have to bring is **prospecting
psychology**: judgement about what a busy stranger will and will not answer, and the
willingness to drop an account when the reason to contact it does not exist. The plugin
enforces the order of operations. It cannot supply the judgement.

## Components

| Component | Purpose |
| --- | --- |
| Skill `sales-enablement-assistant` | The research procedure, the writing constraints, the sequence design, the compliance pass |
| `references/trigger-hierarchy.md` | Ranked triggers, where to verify each, what makes one stale |
| `references/message-anatomy.md` | Structure, worked good and bad examples, the find-and-replace test |
| `references/ai-tells.md` | The tells with rewrites, and the pre-send self-audit |

This is a skill-only plugin. There is no MCP server, nothing to install, and no network
access of its own: it works with whatever research you or the assistant can reach.

## Free and paid

Everything in this plugin is free. There is nothing gated and no licence key.

What costs money is elsewhere: the data sources you research with, your sending
infrastructure, and your CRM. The plugin does not require, integrate with or resell any
of them.

## What this is not

- **Not a reply-rate predictor.** No percentage can be read off a draft. Anyone quoting
  you one from the text alone is inventing it.
- **Not an intent signal.** A verified trigger means something changed at the account,
  not that anyone there is shopping. Most triggered accounts will still not reply.
- **Not a research database.** It tells you what to look for and where to verify it. If
  the account is private or uncovered, the honest output is "no verifiable trigger".
- **Not a sending tool.** No lists, no automation, no deliverability. Domain warm-up and
  authentication decide whether the message is seen at all, and are out of scope.
- **Not legal advice.** The compliance checklist is a prompt to ask someone qualified.
- **Not willing to fabricate.** It will not invent a mutual connection, a referral, a
  deadline, or a prior conversation, and it will say so if asked.

## The skill you bring

**Prospecting Psychology.** Refine the output until it reads like a person wrote it. A personalised email that survives find-and-replace is a template, and reply rates punish templates.

## Plans

Pricing is defined in the suite catalog for when this plugin's tool server ships:
pro $500/month (2 seats) and team $2,000/month (10 seats), with a 14-day single-seat
trial. Until the server exists, the skill content is open and nothing is gated.
