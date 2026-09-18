# Objection practice

Objections are finite. Almost every one a rep will hear is a variant of five, so the
answers can be rehearsed — and a rep who first hears "we already have a vendor for this"
in a live meeting has chosen the most expensive possible place to practise.

## The taxonomy

| Objection | The tell | What it usually means |
| --- | --- | --- |
| Price | "Too expensive", "there's no budget for this" | The value was not established before the price landed, or the scope is too big for a first commitment. Rarely about the number itself |
| Timing | "Not right now", "come back next quarter" | No cost of waiting has been shown. Waiting is currently free, so waiting wins |
| Incumbent | "We already use X", "we handle this in-house" | The perceived cost of switching exceeds the perceived gain. The incumbent's actual performance is usually unexamined |
| Authority | "I need to run this by my boss / the team" | This is not the buyer, or the buyer is hiding behind one. Either way, the real decision-maker has not heard the case |
| No-need | "We're fine", "this isn't a priority" | The problem as pitched is not one they recognise as theirs. The pitch described the seller's problem, not the prospect's |

The tell matters because objections arrive dressed as each other: "too expensive" from
someone who has not seen the value is a no-need objection wearing price's clothes, and
answering it with a discount answers the wrong objection.

## The drill

Claude plays the prospect. One objection per drill.

1. **Pick the objection.** The user names one from the taxonomy, or asks for one at
   random — random is harder and closer to the meeting.
2. **Set the scene.** Claude states the role it is playing (title, company, how far into
   the conversation this is), then raises the objection in its natural phrasing — the
   tell, not the taxonomy label.
3. **Stay in character.** The rep answers; Claude responds as the prospect would,
   without coaching, without softening, and without breaking character mid-drill.
4. **Escalate once.** Whatever the rep's first answer, the prospect pushes back on it
   once — the way a real prospect does when the first answer sounds rehearsed. The
   second answer is the one that reveals whether the rep understands the objection or
   memorised a script. The escalation is mandatory.
5. **Break character and score.** After the rep's second answer, Claude drops the role,
   scores the exchange against the rubric below, quotes the rep's exact lines as
   evidence for each score, and rewrites the weakest moment once.

## The scoring rubric

Four criteria, scored 0–2 each, 8 total.

| Criterion | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Acknowledge | Argued with the objection or talked past it | Acknowledged it in passing ("I understand, but...") on the way to the counter | Restated the objection in the prospect's own words before answering, and the prospect would agree with the restatement |
| Isolate | Answered without finding out whether this is the only blocker | Asked about other concerns but let the answer stay vague | Pinned it down: "if this were solved, is there anything else in the way?" — and got an answer |
| Evidence | Offered no evidence, or invented a claim | A generic assertion ("our customers see great results") with nothing checkable | One specific, sourceable fact — a named comparable, a real number, a checkable mechanism |
| Advance | The exchange ended with no next step | A vague next step ("I'll send some information") | One concrete, dated next step the prospect agreed to |

**Thresholds, stated:**

- **7–8**: meeting-ready for this objection. Move to the next objection in the taxonomy.
- **5–6**: re-run the same objection with a different escalation before moving on.
- **4 or below**: script the answer in writing first — acknowledge, isolate, evidence,
  advance, one line each — then re-run the drill from the script.
- **An invented claim caps the total at 3** regardless of the other scores. A fabricated
  customer, metric or deadline that surfaces in a live meeting does not lose the
  exchange, it loses the account, so the drill treats it as a failing answer on its own.

A price objection scored here should land on the same answer as the reply-handling step:
shrink the scope to a smaller paid pilot rather than discounting — a discount concedes
the price was padded; a smaller pilot concedes nothing.

## Limits

- The score measures the exchange against these four criteria, not the deal. A rep can
  score 8 and lose, or 4 and win; the rubric builds the habit, not the outcome.
- Claude plays a plausible prospect, not this prospect. The real buyer's temperament,
  history and constraints are not in the room, so a drill passed is preparation, not a
  prediction.
