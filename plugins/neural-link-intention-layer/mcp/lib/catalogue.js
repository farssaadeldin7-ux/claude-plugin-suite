/**
 * The automation catalogue: what each mechanism can actually do, what it
 * cannot, and the break-even arithmetic. Ported from
 * references/automation-catalogue.md — data only, no judgement.
 */

export const STANDING_RULES = [
  'Prefer the in-app mechanism. It understands document state, it survives updates better, ' +
    'and it fails visibly rather than silently.',
  'An OS-level macro that clicks screen coordinates is a maintenance liability. It breaks on ' +
    'panel moves, display scaling changes, monitor swaps and every version update. Prefer one ' +
    'that only sends keystrokes the application already binds.',
];

export const MECHANISMS = {
  photoshop: {
    label: 'Photoshop',
    mechanisms: [
      {
        mechanism: 'Actions',
        can: 'Record most menu commands, adjustments, filters, layer operations, transforms; toggle a modal dialogue to pause for input; nest actions',
        cannot: 'Record brush strokes, tool drags, most Pen work, or anything with variable geometry. No real branching',
      },
      {
        mechanism: 'Conditional Actions',
        can: 'Branch on a small fixed set of document conditions such as layer type or document mode',
        cannot: 'Anything outside that fixed list',
      },
      {
        mechanism: 'Droplets',
        can: 'Turn an action into a file-drop executable for batch work',
        cannot: 'Interact with an open document',
      },
      {
        mechanism: 'Batch / Image Processor',
        can: 'Apply an action across a folder with output format and sizing',
        cannot: "Vary behaviour per file beyond the action's own conditionals",
      },
      {
        mechanism: 'Script Events Manager',
        can: 'Fire a script or action on document open, new document, save or print',
        cannot: 'Fire on arbitrary user actions',
      },
      {
        mechanism: 'Scripts (UXP or JSX)',
        can: 'Full logic, loops, dialogues, layer inspection',
        cannot: 'Anything requiring live tool interaction',
      },
    ],
    notes:
      'Setup cost: an action ~5 min, a script from 30 min. Actions are the highest-value, ' +
      'lowest-effort automation available in any application on this list. Script Events ' +
      'Manager is the most underused item here and is usually an elimination tool rather than ' +
      'an automation one — it removes the setup ritual at the start of every document instead ' +
      'of speeding it up.',
  },
  illustrator: {
    label: 'Illustrator',
    mechanisms: [
      {
        mechanism: 'Actions',
        can: 'Work the same way as Photoshop Actions but cover less; "Insert Menu Item" lets an action call an unrecordable menu command. Batch runs from the Actions panel menu',
        cannot: 'Record many tool operations; "Insert Menu Item" records no parameters for the command it calls',
      },
    ],
    notes:
      'Expect to hit the recordability ceiling quickly. Above it, the options are scripting or ' +
      'an OS-level macro that drives keystrokes.',
  },
  figma: {
    label: 'Figma',
    mechanisms: [
      {
        mechanism: 'Components and variants',
        can: 'Remove the repeated construction entirely — the highest-payoff move in Figma',
        cannot: 'Help with one-off layout work',
      },
      {
        mechanism: 'Auto layout',
        can: 'Eliminate manual repositioning after every content change',
        cannot: 'Do anything about canvas navigation',
      },
      {
        mechanism: 'Styles and variables',
        can: 'Eliminate repeated colour, type and spacing edits',
        cannot: 'Apply retroactively without a pass',
      },
      {
        mechanism: 'Plugin API (TypeScript)',
        can: 'Read and write the document, batch-edit selections, respond to document and selection events',
        cannot: 'Read keystrokes, drive the UI, or bind its own arbitrary hotkeys',
      },
      {
        mechanism: 'Quick actions (Cmd+/)',
        can: 'Reach almost any command in three or four keystrokes',
        cannot: 'Chain commands',
      },
    ],
    notes:
      "Figma's real answer to repetition is structural, not procedural. A component set is " +
      'expensive to build — call it 15 minutes — but saves far more than 3 seconds per use, so ' +
      'the break-even table must be rescaled: at 40 seconds saved it repays after roughly four ' +
      'uses a week. Note the hotkey gap: Figma gives you one shortcut for re-running the last ' +
      'plugin, and nothing per-plugin. If a plugin needs its own key, an OS-level macro that ' +
      'sends the run-last-plugin chord is the standard workaround, and it is fragile the moment ' +
      'another plugin is run in between.',
  },
  blender: {
    label: 'Blender',
    mechanisms: [
      {
        mechanism: 'Keymap editor',
        can: 'Bind any operator, with preset arguments, to any key in any context',
        cannot: 'Bind a multi-step sequence — one entry is one operator',
      },
      {
        mechanism: 'Right-click → Assign Shortcut',
        can: 'Bind almost any UI control in seconds',
        cannot: 'Same single-operator limit',
      },
      {
        mechanism: 'Custom pie menus (small Python add-on)',
        can: 'Group 4-8 related operators under one key with directional selection',
        cannot: 'Replace a genuine sequence',
      },
      {
        mechanism: 'Operator search (F3)',
        can: 'Reach anything without memorising it',
        cannot: 'Be fast for something used forty times a day',
      },
      {
        mechanism: 'Python add-on',
        can: 'Chain operators, add real logic, add UI',
        cannot: 'Be cheap. Budget an hour minimum',
      },
    ],
    notes:
      'Keymap entries are the cheapest useful automation anywhere in this catalogue: about ' +
      'three minutes, break-even around ten uses a week. Exhaust them before writing Python.',
  },
  after_effects: {
    label: 'After Effects',
    mechanisms: [
      {
        mechanism: 'Expressions',
        can: 'Remove repeated keyframing entirely by deriving one property from another — an elimination tool',
        cannot: 'Perform project or comp-level operations',
      },
      {
        mechanism: 'Animation presets (.ffx)',
        can: 'Reapply a saved effect and property stack in one drag',
        cannot: 'Carry comp structure or layer relationships',
      },
      {
        mechanism: 'Essential Graphics',
        can: 'Surface the handful of parameters actually being changed, killing the panel hunt',
        cannot: 'Automate anything',
      },
      {
        mechanism: 'Scripting (ExtendScript / CEP / UXP)',
        can: 'Full project automation, ScriptUI panels, render setup',
        cannot: 'Interact with tools mid-drag',
      },
      {
        mechanism: 'Third-party button bars',
        can: 'Put script and menu calls on one click',
        cannot: 'More than the underlying script can do',
      },
    ],
    notes:
      'No macro recorder exists — the mechanisms are different in kind. AE is the application ' +
      'where an OS-level macro tool most clearly earns its keep, because there is no in-app ' +
      'alternative for chaining keyboard commands.',
  },
  os_level: {
    label: 'OS-level macro tools',
    mechanisms: [
      {
        mechanism: 'AutoHotkey (Windows)',
        can: 'Free, scriptable, #HotIf WinActive(...) scopes per application. The default choice on Windows',
        cannot: 'See document state',
      },
      {
        mechanism: 'Keyboard Maestro (macOS)',
        can: 'Paid, deep application-aware triggering, clipboard history, its own execution log',
        cannot: 'See document state',
      },
      {
        mechanism: 'Hammerspoon (macOS)',
        can: 'Free, Lua, precise control',
        cannot: 'Work without Accessibility permission and real code',
      },
      {
        mechanism: 'espanso (any platform)',
        can: 'Text expansion only, but that covers a surprising amount of naming and metadata work',
        cannot: 'Anything beyond text expansion',
      },
    ],
    notes:
      'Reach for one of these when, and only when: the application has no macro system; the ' +
      'sequence crosses applications; the sequence is only keystrokes the app already binds; or ' +
      'one key must mean different things in different applications. Do not reach for one when ' +
      'the in-app mechanism can do the job. An OS-level macro cannot see document state, so it ' +
      'cannot check whether the last step succeeded, and a failure halfway through leaves the ' +
      'document in an undefined condition.',
  },
  hardware: {
    label: 'Hardware',
    mechanisms: [
      {
        mechanism: 'Stream Deck',
        can: 'Chords too awkward to remember; multi-action for short fixed sequences',
        cannot: 'Beat the keyboard for anything the hand is already on the keyboard for — the reach costs the saving back',
      },
      {
        mechanism: 'Tablet ExpressKeys, rocker ring, pen buttons',
        can: 'Modifier holds, zoom, brush size, undo. The genuine fix for navigation tax',
        cannot: 'Long sequences',
      },
      {
        mechanism: 'Radial and on-screen menus',
        can: 'Tool switching without leaving the canvas',
        cannot: 'Precision parameter entry',
      },
    ],
    notes:
      'Navigation and modifier work is where hardware beats every software mechanism in this ' +
      'catalogue. When the audit shows a navigation share above about 25%, the recommendation ' +
      'is a hardware and habit change, not a macro.',
  },
};

/** Break-even frequencies at a typical 3 seconds saved per occurrence. */
export const BREAK_EVEN = {
  assumes: '3 seconds saved per occurrence — rescale when the saving differs',
  rows: [
    { mechanism: 'Blender keymap entry', setup: '~3 min', break_even_f_per_week: '~10' },
    { mechanism: 'Stream Deck button', setup: '~4 min', break_even_f_per_week: '~13' },
    { mechanism: 'Photoshop or Illustrator Action', setup: '~5 min', break_even_f_per_week: '~16' },
    { mechanism: 'Figma component set', setup: '~15 min', break_even_f_per_week: '~49' },
    { mechanism: 'Keyboard Maestro or AutoHotkey macro', setup: '~20 min', break_even_f_per_week: '~65' },
    { mechanism: 'Scripted plugin', setup: '~1.4 h', break_even_f_per_week: '~270' },
  ],
  floor:
    'Below roughly 15 occurrences per week a custom macro does not repay its setup and ' +
    'maintenance. Rescale when the saving is not 3 seconds — a Figma component set saving ' +
    '40 seconds each time breaks even at four uses a week.',
};

export const CHOOSING = [
  'Can the step be eliminated by a default, preset, template, component, style or expression? ' +
    'Do that. No maintenance, no failure mode.',
  'Can it be batched across many items at once? Do that next.',
  'Otherwise automate, cheapest mechanism first: keymap entry, then in-app action, then ' +
    'hardware button, then OS-level macro, then script.',
  'Re-measure after two weeks and delete whatever is not firing.',
];

export function catalogueFor(name) {
  const key = String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return MECHANISMS[key] ?? null;
}
