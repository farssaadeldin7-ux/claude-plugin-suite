/**
 * Instrumentation data: how to get a command history out of each application,
 * what fidelity each method gives, and what it silently misses. Ported from
 * references/instrumentation.md — data only, no judgement.
 */

export const TIERS = [
  {
    tier: 'A',
    method: 'Application action or script log',
    action_coverage: '60-95%',
    timestamps: 'Yes, to the second',
    setup: '2-30 min',
    use_for: 'Frequencies, sequences, payback',
  },
  {
    tier: 'B',
    method: "The app's own macro recorder over a representative task",
    action_coverage: '50-70%',
    timestamps: 'No',
    setup: '5-15 min',
    use_for: 'Sequence discovery only',
  },
  {
    tier: 'B',
    method: 'OS-level hotkey logger scoped to the app',
    action_coverage: 'Chords near 100%, menus 0%',
    timestamps: 'Yes',
    setup: '20-60 min',
    use_for: 'Hotkey tax, apps with no log',
  },
  {
    tier: 'C',
    method: 'Structured self-report walk-through',
    action_coverage: '40-60%',
    timestamps: 'No',
    setup: '20 min',
    use_for: 'Hypotheses, never counts',
  },
];

export const TIER_C_WARNING =
  'Tier C is not a measurement. Designers reliably over-report the interesting actions and ' +
  'under-report zoom, pan, tool toggles and undo — which is the expensive population. ' +
  'Use it to decide what to instrument, then instrument.';

export const APPLICATIONS = {
  photoshop: {
    label: 'Photoshop',
    tier: 'A',
    method:
      'Preferences → History Log. Set "Save Log Items To" to Text File (metadata leaks into ' +
      'delivered files, so prefer a text file outside the project folder), and "Edit Log Items" ' +
      'to Detailed. Detailed records one line per history state with a timestamp and the command text.',
    captures:
      'Every command that produces a history state — layer creation, adjustments, filters, ' +
      'transforms, blend mode changes, masks, brush strokes as discrete states.',
    blind_spots:
      'Tool selection that does not alter the document (pressing B, V, E), zoom and pan, panel ' +
      'navigation, brush size and hardness changes, layer selection, visibility toggles. This is ' +
      'a serious gap. Pair it with a Tier B hotkey logger if navigation tax is the question.',
    also_useful:
      "The History panel's own state list for a single session, and Script Events Manager to " +
      'timestamp document open, save and export events.',
  },
  blender: {
    label: 'Blender',
    tier: 'A — highest fidelity of any application here',
    method:
      'Switch an area to the Info editor (or use the Scripting workspace). It prints every ' +
      'executed operator as a bpy.ops.* call with its full arguments. Select all and copy.',
    captures:
      'Essentially every operator, including those invoked from menus, search (F3) and keymaps, ' +
      'with arguments. 90-95% coverage.',
    blind_spots:
      'The Info editor does not record which input triggered the operator, so a keymap press and ' +
      'a menu click look identical. Modal operations — a grab, a rotate, a knife cut — appear as ' +
      'one operator regardless of how long they took. View navigation is not logged as operators.',
    also_useful:
      'Launch with "blender --debug-wm" to print window-manager event and operator handling to ' +
      'the console. Verbose, but it recovers the input source.',
  },
  figma: {
    label: 'Figma',
    tier: 'A — but of effects rather than commands',
    method:
      'Figma plugins run sandboxed with no keystroke access. A small logging plugin using ' +
      'figma.on("documentchange", ...) plus figma.on("selectionchange", ...) records what ' +
      'changed, not which command changed it.',
    captures:
      'Node property deltas, creation and deletion, selection changes, with timestamps, while ' +
      'the plugin is running.',
    blind_spots:
      'No keystrokes, no menu or quick-action usage, no zoom or pan, no panel interaction. ' +
      'Several distinct commands collapse to the same document change. Effective command-level ' +
      'fidelity is around 60%. Do not use version history as a log — its checkpoints are far too coarse.',
    privacy:
      'A document-change listener sees node names. Hash or discard them before writing anything ' +
      'out. Log the property name, never the value.',
  },
  after_effects: {
    label: 'After Effects',
    tier: 'No native action log',
    method:
      'There is no UI action log and no macro recorder. Be straight about this rather than ' +
      'inventing a source. Best available: an OS-level hotkey logger scoped to the AE process ' +
      '(Tier B). AE is heavily keyboard-driven, so this recovers more than it would elsewhere.',
    captures: 'With a scoped hotkey logger: chords near 100%, menus 0%.',
    blind_spots:
      'A ScriptUI panel can timestamp scripted operations, and app.beginUndoGroup names appear ' +
      'in the Edit menu, but neither yields a stream. Third-party logging panels exist — verify ' +
      'what a given one actually captures before trusting counts from it; several record only ' +
      'their own button presses. Otherwise Tier C, clearly labelled as self-report.',
  },
  illustrator: {
    label: 'Illustrator',
    tier: 'B',
    method:
      'No passive log. The Actions panel records a representative task, but only recordable ' +
      'commands; many tool operations are not recordable, and "Insert Menu Item" is a ' +
      'workaround, not coverage.',
    captures: 'Expect 50-70% of recordable commands, no timing.',
    blind_spots: 'Unrecordable tool operations, and everything a macro recorder cannot see.',
  },
  other: {
    label: 'Everything else',
    tier: 'Varies',
    method:
      'Most DCC and editor applications fall into one of the patterns above. Ask in order: is ' +
      'there a script or action log; is there a macro recorder; can the app be scoped by an ' +
      'OS-level logger. If all three fail, it is Tier C.',
  },
};

export const OS_HOTKEY_LOGGING = [
  {
    platform: 'Windows',
    tool: 'AutoHotkey',
    approach:
      '#HotIf WinActive("ahk_exe Photoshop.exe"), pass-through hotkeys prefixed with ~, append ' +
      'the key name and timestamp to a file',
  },
  {
    platform: 'macOS',
    tool: 'Hammerspoon',
    approach:
      'hs.eventtap on keyDown, filtered by hs.application.frontmostApplication(), requires ' +
      'Accessibility permission',
  },
  {
    platform: 'macOS',
    tool: 'Keyboard Maestro',
    approach:
      'Logs its own macro executions in the Engine log — useful for measuring existing macros, ' +
      'not for arbitrary keys',
  },
  {
    platform: 'Any',
    tool: 'Stream Deck',
    approach:
      'Every press is already a named action; a Stream Deck-heavy workflow is partly ' +
      'instrumented for free',
  },
];

export const CAPTURE_RULES = [
  'Record only modified chords, function keys and known single-key tool shortcuts. Discard ' +
    'every unmodified alphanumeric. You will lose some tool switches. Accept it.',
  'Never record characters typed into a text field. If the tool cannot distinguish text entry ' +
    'from tool shortcuts, discard all unmodified keys.',
  'A global stop hotkey, and stop it before anything under NDA.',
  'Log key names only — "ctrl+alt+shift+e", never the document, layer or file it applied to.',
  'Write to a local file. Nothing leaves the machine.',
];

export const SELF_REPORT = {
  procedure:
    'Ask the designer to narrate the last finished piece start to finish, in order, and write ' +
    'down actions only. Then prompt explicitly for the three categories people forget.',
  prompts: [
    'How often were you zooming or panning between those steps?',
    'Where did you undo, and what had you just done?',
    'Which tool were you switching back to each time?',
  ],
  label:
    'Label the result a hypothesis list. Convert it into an instrumentation plan naming the ' +
    'specific sequences to confirm, then measure. Never quote a frequency from it.',
};

export const LOG_FORMAT = {
  rule: 'One action per line: timestamp, application, action name — and nothing more.',
  example: [
    '2026-08-14T10:04:12  photoshop  layer.new',
    '2026-08-14T10:04:13  photoshop  edit.fill:50_grey',
    '2026-08-14T10:04:15  photoshop  layer.blend_mode:soft_light',
  ],
  never:
    'No document name, no layer name, no file path, no selection contents. If the raw log ' +
    'carries any of those, strip them before analysis and delete the original.',
};

export function applicationFor(name) {
  const key = String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return APPLICATIONS[key] ?? null;
}
