const osuUniDiscord = "https://discord.gg/QubdHdnBVg";
export const discordUrl = osuUniDiscord;
export const twitterUrl = "https://twitter.com/osuuniversity";
export const youtubeUrl = "https://www.youtube.com/channel/UCzW2Z--fEw0LWKgVTmO-b6w";
export const RewindLinks = {
  OsuPpyShAbstrakt: "https://osu.ppy.sh/users/5773957",
  OsuUniDiscord: osuUniDiscord,
  Guide: "https://bit.ly/3BOF3P2",
};
export const RewindLazerRepository = {
  owner: "Apeuriox",
  name: "rewind",
  url: "https://github.com/Apeuriox/rewind",
};
export const ALLOWED_SPEEDS = [0.25, 0.75, 1.0, 1.5, 2.0, 4.0];

export const PLAYBACK_SPEED_MIN = 0.25;
export const PLAYBACK_SPEED_MAX = 2;
export const PLAYBACK_SPEED_NUDGE = 0.05;
export const HT_PLAYBACK_SPEED = 0.75;
export const DT_PLAYBACK_SPEED = 1.5;
const PLAYBACK_SPEED_SNAP_THRESHOLD = 0.008;

export type PlaybackSpeedMark = {
  value: number;
  label: string;
  placement: "above" | "below";
  isReplay: boolean;
};

function speedsAlmostEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.005;
}

export function roundPlaybackSpeed(value: number) {
  return Math.round(value * 100) / 100;
}

export function clampPlaybackSpeed(value: number) {
  return Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, roundPlaybackSpeed(value)));
}

export function formatPlaybackSpeed(value: number) {
  return `${roundPlaybackSpeed(value).toFixed(2)}x`;
}

export function playbackSpeedTrackPercent(value: number) {
  return ((value - PLAYBACK_SPEED_MIN) / (PLAYBACK_SPEED_MAX - PLAYBACK_SPEED_MIN)) * 100;
}

export function playbackSpeedMarks(replaySpeed?: number): PlaybackSpeedMark[] {
  const marks: PlaybackSpeedMark[] = [
    { value: HT_PLAYBACK_SPEED, label: "HT", placement: "below", isReplay: false },
    { value: DT_PLAYBACK_SPEED, label: "DT", placement: "below", isReplay: false },
  ];

  if (
    typeof replaySpeed === "number" &&
    Number.isFinite(replaySpeed) &&
    replaySpeed >= PLAYBACK_SPEED_MIN &&
    replaySpeed <= PLAYBACK_SPEED_MAX
  ) {
    const existing = marks.find((mark) => speedsAlmostEqual(mark.value, replaySpeed));
    if (existing) {
      existing.label = `${existing.label} · RP`;
      existing.isReplay = true;
    } else {
      marks.push({ value: roundPlaybackSpeed(replaySpeed), label: "RP", placement: "above", isReplay: true });
    }
  }

  return marks.sort((a, b) => a.value - b.value);
}

export function snapPlaybackSpeed(value: number, marks: Array<{ value: number }>) {
  const rounded = roundPlaybackSpeed(value);
  let nearest = rounded;
  let bestDistance = PLAYBACK_SPEED_SNAP_THRESHOLD;
  for (const mark of marks) {
    const distance = Math.abs(mark.value - rounded);
    if (distance <= bestDistance) {
      bestDistance = distance;
      nearest = mark.value;
    }
  }
  return clampPlaybackSpeed(nearest);
}

export function nudgePlaybackSpeed(value: number, delta: number) {
  if (value > PLAYBACK_SPEED_MAX && delta < 0) return PLAYBACK_SPEED_MAX;
  if (value < PLAYBACK_SPEED_MIN && delta > 0) return PLAYBACK_SPEED_MIN;
  return clampPlaybackSpeed(value + delta);
}

/** Keeps only a non-negative decimal with at most 2 places, clamped to the slider max. */
export function sanitizePlaybackSpeedInput(raw: string): string {
  let cleaned = "";
  let seenDot = false;
  let decimals = 0;
  for (const character of raw) {
    if (character >= "0" && character <= "9") {
      if (seenDot) {
        if (decimals >= 2) continue;
        decimals += 1;
      }
      cleaned += character;
    } else if (character === "." && !seenDot) {
      seenDot = true;
      cleaned += character;
    }
  }

  if (cleaned === "" || cleaned === ".") return cleaned;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return cleaned;
  if (parsed > PLAYBACK_SPEED_MAX) return PLAYBACK_SPEED_MAX.toFixed(2);
  if (parsed < PLAYBACK_SPEED_MIN && cleaned !== "0" && cleaned !== "0." && cleaned !== "0.2") {
    return PLAYBACK_SPEED_MIN.toFixed(2);
  }
  return cleaned;
}

export function commitPlaybackSpeedInput(raw: string, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return clampPlaybackSpeed(fallback);
  return clampPlaybackSpeed(parsed);
}

export function playbackSpeedOptions(currentSpeed: number, replaySpeed?: number) {
  return [
    ...new Set([...ALLOWED_SPEEDS, currentSpeed, replaySpeed].filter((speed): speed is number => speed !== undefined)),
  ]
    .filter((speed) => Number.isFinite(speed) && speed > 0)
    .sort((a, b) => a - b);
}

export function nextPlaybackSpeed(currentSpeed: number, replaySpeed?: number) {
  const speeds = playbackSpeedOptions(currentSpeed, replaySpeed);
  return speeds.find((speed) => speed > currentSpeed) ?? speeds[speeds.length - 1];
}

export function previousPlaybackSpeed(currentSpeed: number, replaySpeed?: number) {
  const speeds = playbackSpeedOptions(currentSpeed, replaySpeed);
  return [...speeds].reverse().find((speed) => speed < currentSpeed) ?? speeds[0];
}
// The legacy electron-updater dependency is incompatible with the packaged
// dependency layout. Keep updater IPC disabled until the updater is replaced.
export const ELECTRON_UPDATE_FLAG = false;
export const PlaybarColors = {
  MISS: "rgb(255,0,0)",
  SLIDER_BREAK: "rgb(255,89,0)",
  MEH: "rgb(255,221,0)",
  OK: "rgb(102,255,0)",
};
