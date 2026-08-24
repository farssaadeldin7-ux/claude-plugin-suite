/**
 * Timecode arithmetic. Accepts "SS", "M:SS", "H:MM:SS" or a plain number of
 * seconds; everything downstream works in seconds and formats back on the way
 * out.
 */

export function toSeconds(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const match = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(text);
  if (!match) return null;
  return match[3] !== undefined
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : Number(match[1]) * 60 + Number(match[2]);
}

export function toTimecode(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
