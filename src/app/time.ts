/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Turns "last time we saw the network" into a badge number and a clock.
 */

const DAY_MS = 86_400_000;

export interface QuietParts {
  /** Whole days, or null when the device has no record of being online. */
  days: number | null;
  /** Remainder as HH:MM:SS. Dashes when there is no record. */
  hms: string;
}

/** Days since `lastOnlineAt`, clamped so a clock skew cannot go negative. */
export function quietParts(lastOnlineAt: number | null, now: number): QuietParts {
  if (lastOnlineAt == null || Number.isNaN(lastOnlineAt)) {
    return { days: null, hms: '--:--:--' };
  }
  const elapsed = Math.max(0, now - lastOnlineAt);
  const days = Math.floor(elapsed / DAY_MS);
  const rest = elapsed % DAY_MS;
  const hours = Math.floor(rest / 3_600_000);
  const minutes = Math.floor((rest % 3_600_000) / 60_000);
  const seconds = Math.floor((rest % 60_000) / 1_000);
  return { days, hms: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}

/** The line under the big number on the badge. */
export function quietCaption(days: number | null): string {
  if (days == null) return 'NO RECORD OF THE SIGNAL';
  if (days === 0) return 'THE QUIET JUST STARTED';
  if (days === 1) return 'ONE FULL DAY IN THE BUNKER';
  return 'THE BUNKER HELD';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
