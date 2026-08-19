# Instrumentation

You cannot optimise a workflow you have not measured. This file covers how to get a
command history out of each major application, what fidelity it gives, what it costs
to set up and — most importantly — what it silently misses.

Read the blind spots column before you quote any number. Every method here has a hole
in it, and in most cases the hole is navigation, which is the largest cost in the log.

## The three tiers

| Tier | Method | Action coverage | Timestamps | Setup | Use it for |
| --- | --- | --- | --- | --- | --- |
| A | Application action or script log | 60–95% | Yes, to the second | 2–30 min | Frequencies, sequences, payback |
| B | The app's own macro recorder over a representative task | 50–70% | No | 5–15 min | Sequence discovery only |
| B | OS-level hotkey logger scoped to the app | Chords near 100%, menus 0% | Yes | 20–60 min | Hotkey tax, apps with no log |
| C | Structured self-report walk-through | 40–60% | No | 20 min | Hypotheses, never counts |

Tier C is not a measurement. Designers reliably over-report the interesting actions
and under-report zoom, pan, tool toggles and undo — which is the expensive population.
Use it to decide what to instrument, then instrument.

## Per application

### Photoshop — Tier A

**Preferences → History Log.** Set *Save Log Items To* to Text File (metadata leaks
into delivered files, so prefer a text file outside the project folder), and *Edit Log
Items* to **Detailed**. Detailed records one line per history state with a timestamp
and the command text.

- **Captures:** every command that produces a history state — layer creation, adjustments,
  filters, transforms, blend mode changes, masks, brush strokes as discrete states.
- **Blind spots:** tool selection that does not alter the document (pressing B, V, E),
  zoom and pan, panel navigation, brush size and hardness changes, layer selection,
  visibility toggles. This is a serious gap. Pair it with a Tier B hotkey logger if
  navigation tax is the question.
- **Also useful:** the History panel's own state list for a single session, and Script
  Events Manager to timestamp document open, save and export events.

### Blender — Tier A, highest fidelity of any application here

Switch an area to the **Info editor** (or use the Scripting workspace). It prints every
executed operator as a `bpy.ops.*` call with its full arguments. Select all and copy.

- **Captures:** essentially every operator, including those invoked from menus, search
  (F3) and keymaps, with arguments. 90–95% coverage.
- **Blind spots:** the Info editor does not record which input triggered the operator,
  so a keymap press and a menu click look identical. Modal operations — a grab, a
  rotate, a knife cut — appear as one operator regardless of how long they took. View
  navigation is not logged as operators.
- **Higher fidelity option:** launch with `blender --debug-wm` to print window-manager
  event and operator handling to the console. Verbose, but it recovers the input source.

### Figma — Tier A, but of effects rather than commands

Figma plugins run sandboxed with no keystroke access. A small logging plugin using
`figma.on("documentchange", ...)` plus `figma.on("selectionchange", ...)` records what
changed, not which command changed it.

- **Captures:** node property deltas, creation and deletion, selection changes, with
  timestamps, while the plugin is running.
- **Blind spots:** no keystrokes, no menu or quick-action usage, no zoom or pan, no
  panel interaction. Several distinct commands collapse to the same document change.
  Effective command-level fidelity is around 60%.
- **Do not use** version history as a log. Its checkpoints are far too coarse.
- **Privacy:** a document-change listener sees node names. Hash or discard them before
  writing anything out. Log the property name, never the value.

### After Effects — no native action log

There is no UI action log and no macro recorder. Be straight with the designer about
this rather than inventing a source.

- **Best available:** an OS-level hotkey logger scoped to the AE process (Tier B).
  AE is heavily keyboard-driven, so this recovers more than it would elsewhere.
- **Partial supplement:** a ScriptUI panel can timestamp scripted operations, and
  `app.beginUndoGroup` names appear in the Edit menu, but neither yields a stream.
- Third-party logging panels exist. Verify what a given one actually captures before
  trusting counts from it — several record only their own button presses.
- **Otherwise Tier C**, clearly labelled as self-report.

### Illustrator — Tier B

No passive log. The **Actions panel** records a representative task, but only
recordable commands; many tool operations are not recordable, and *Insert Menu Item*
is a workaround, not coverage. Expect 50–70%, no timing.

### Everything else

Most DCC and editor applications fall into one of the patterns above. Ask in order:
is there a script or action log; is there a macro recorder; can the app be scoped by
an OS-level logger. If all three fail, it is Tier C.

## OS-level hotkey logging

| Platform | Tool | Approach |
| --- | --- | --- |
| Windows | AutoHotkey | `#HotIf WinActive("ahk_exe Photoshop.exe")`, pass-through hotkeys prefixed with `~`, append the key name and timestamp to a file |
| macOS | Hammerspoon | `hs.eventtap` on `keyDown`, filtered by `hs.application.frontmostApplication()`, requires Accessibility permission |
| macOS | Keyboard Maestro | Logs its own macro executions in the Engine log — useful for measuring existing macros, not for arbitrary keys |
| Any | Stream Deck | Every press is already a named action; a Stream Deck-heavy workflow is partly instrumented for free |

Non-negotiable rules for any keystroke capture:

1. **Record only modified chords, function keys and known single-key tool shortcuts.**
   Discard every unmodified alphanumeric. You will lose some tool switches. Accept it.
2. **Never record characters typed into a text field.** If the tool cannot distinguish
   text entry from tool shortcuts, discard all unmodified keys.
3. **A global stop hotkey**, and stop it before anything under NDA.
4. **Log key names only** — `ctrl+alt+shift+e`, never the document, layer or file it
   applied to.
5. Write to a local file. Nothing leaves the machine.

## The self-report walk-through, when it is all you have

Ask the designer to narrate the last finished piece start to finish, in order, and
write down actions only. Then prompt explicitly for the three categories people forget:

- "How often were you zooming or panning between those steps?"
- "Where did you undo, and what had you just done?"
- "Which tool were you switching back to each time?"

Label the result a hypothesis list. Convert it into an instrumentation plan naming the
specific sequences to confirm, then measure.

## Log format

One action per line. Aim for exactly this, and nothing more:

```
2026-08-14T10:04:12  photoshop  layer.new
2026-08-14T10:04:13  photoshop  edit.fill:50_grey
2026-08-14T10:04:15  photoshop  layer.blend_mode:soft_light
```

Timestamp, application, action name. No document name, no layer name, no file path, no
selection contents. If the raw log carries any of those, strip them before analysis and
delete the original.
