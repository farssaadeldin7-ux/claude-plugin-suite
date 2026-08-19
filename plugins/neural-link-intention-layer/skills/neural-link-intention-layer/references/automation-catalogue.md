# Automation catalogue

What each mechanism can actually do, what it cannot, and when to stop trying to make
the in-app tool work and reach for an OS-level macro instead.

Two standing rules:

- **Prefer the in-app mechanism.** It understands document state, it survives updates
  better, and it fails visibly rather than silently.
- **An OS-level macro that clicks screen coordinates is a maintenance liability.** It
  breaks on panel moves, display scaling changes, monitor swaps and every version
  update. Prefer one that only sends keystrokes the application already binds.

## Photoshop

| Mechanism | Can | Cannot |
| --- | --- | --- |
| **Actions** | Record most menu commands, adjustments, filters, layer operations, transforms; toggle a modal dialogue to pause for input; nest actions | Record brush strokes, tool drags, most Pen work, or anything with variable geometry. No real branching |
| **Conditional Actions** | Branch on a small fixed set of document conditions such as layer type or document mode | Anything outside that fixed list |
| **Droplets** | Turn an action into a file-drop executable for batch work | Interact with an open document |
| **Batch / Image Processor** | Apply an action across a folder with output format and sizing | Vary behaviour per file beyond the action's own conditionals |
| **Script Events Manager** | Fire a script or action on document open, new document, save or print | Fire on arbitrary user actions |
| **Scripts (UXP or JSX)** | Full logic, loops, dialogues, layer inspection | Anything requiring live tool interaction |

Setup cost: an action ~5 min, a script from 30 min. Actions are the highest-value,
lowest-effort automation available in any application on this list.

Script Events Manager is the most underused item here and is usually an **elimination**
tool rather than an automation one — it removes the setup ritual at the start of every
document instead of speeding it up.

## Illustrator

Actions work the same way but cover less. Many tool operations are simply not
recordable; *Insert Menu Item* lets an action call an unrecordable menu command but
records no parameters for it. Batch runs from the Actions panel menu.

Expect to hit the recordability ceiling quickly. Above it, the options are scripting or
an OS-level macro that drives keystrokes.

## Figma

Figma's real answer to repetition is structural, not procedural.

| Mechanism | Can | Cannot |
| --- | --- | --- |
| **Components and variants** | Remove the repeated construction entirely — the highest-payoff move in Figma | Help with one-off layout work |
| **Auto layout** | Eliminate manual repositioning after every content change | Do anything about canvas navigation |
| **Styles and variables** | Eliminate repeated colour, type and spacing edits | Apply retroactively without a pass |
| **Plugin API (TypeScript)** | Read and write the document, batch-edit selections, respond to document and selection events | Read keystrokes, drive the UI, or bind its own arbitrary hotkeys |
| **Quick actions (Cmd+/)** | Reach almost any command in three or four keystrokes | Chain commands |

A component set is expensive to build — call it 15 minutes — but saves far more than
3 seconds per use, so the break-even table in `sequence-analysis.md` must be rescaled.
At 40 seconds saved it repays after roughly four uses a week.

Note the hotkey gap. Figma gives you one shortcut for re-running the last plugin, and
nothing per-plugin. If a plugin needs its own key, an OS-level macro that sends the
run-last-plugin chord is the standard workaround, and it is fragile the moment another
plugin is run in between.

## Blender

| Mechanism | Can | Cannot |
| --- | --- | --- |
| **Keymap editor** | Bind any operator, with preset arguments, to any key in any context | Bind a multi-step sequence — one entry is one operator |
| **Right-click → Assign Shortcut** | Bind almost any UI control in seconds | Same single-operator limit |
| **Custom pie menus (small Python add-on)** | Group 4–8 related operators under one key with directional selection | Replace a genuine sequence |
| **Operator search (F3)** | Reach anything without memorising it | Be fast for something used forty times a day |
| **Python add-on** | Chain operators, add real logic, add UI | Cheap. Budget an hour minimum |

Keymap entries are the cheapest useful automation anywhere in this document: about
three minutes, break-even around ten uses a week. Exhaust them before writing Python.

## After Effects

No macro recorder exists. The mechanisms are different in kind.

| Mechanism | Can | Cannot |
| --- | --- | --- |
| **Expressions** | Remove repeated keyframing entirely by deriving one property from another — an elimination tool | Perform project or comp-level operations |
| **Animation presets (.ffx)** | Reapply a saved effect and property stack in one drag | Carry comp structure or layer relationships |
| **Essential Graphics** | Surface the handful of parameters actually being changed, killing the panel hunt | Automate anything |
| **Scripting (ExtendScript / CEP / UXP)** | Full project automation, ScriptUI panels, render setup | Interact with tools mid-drag |
| **Third-party button bars** | Put script and menu calls on one click | More than the underlying script can do |

AE is the application where an OS-level macro tool most clearly earns its keep, because
there is no in-app alternative for chaining keyboard commands.

## OS-level macro tools

| Tool | Platform | Notes |
| --- | --- | --- |
| **AutoHotkey** | Windows | Free, scriptable, `#HotIf WinActive(...)` scopes per application. The default choice on Windows |
| **Keyboard Maestro** | macOS | Paid, deep application-aware triggering, clipboard history, its own execution log |
| **Hammerspoon** | macOS | Free, Lua, precise control, needs Accessibility permission and real code |
| **espanso** | Any | Text expansion only, but that covers a surprising amount of naming and metadata work |

Reach for one of these when, and only when: the application has no macro system; the
sequence crosses applications; the sequence is only keystrokes the app already binds;
or one key must mean different things in different applications.

Do not reach for one when the in-app mechanism can do the job. An OS-level macro cannot
see document state, so it cannot check whether the last step succeeded, and a failure
halfway through leaves the document in an undefined condition.

## Hardware

| Device | Best for | Worst for |
| --- | --- | --- |
| **Stream Deck** | Chords too awkward to remember; multi-action for short fixed sequences | Anything the hand is already on the keyboard for — the reach costs the saving back |
| **Tablet ExpressKeys, rocker ring, pen buttons** | Modifier holds, zoom, brush size, undo. The genuine fix for navigation tax | Long sequences |
| **Radial and on-screen menus** | Tool switching without leaving the canvas | Precision parameter entry |

Navigation and modifier work is where hardware beats every software mechanism in this
document. When the audit shows a navigation share above about 25%, the recommendation
is a hardware and habit change, not a macro.

## Choosing quickly

1. Can the step be **eliminated** by a default, preset, template, component, style or
   expression? Do that. No maintenance, no failure mode.
2. Can it be **batched** across many items at once? Do that next.
3. Otherwise automate, cheapest mechanism first: keymap entry, then in-app action, then
   hardware button, then OS-level macro, then script.
4. Re-measure after two weeks and delete whatever is not firing.
