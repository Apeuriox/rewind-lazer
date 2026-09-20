export const DIFFICULTY_SLIDER_STEP = 0.1;
export const DIFFICULTY_HIGH_COLOR = "#ff66aa";

export type DifficultySliderDimension = "approachRate" | "overallDifficulty" | "circleSize";

export type ViewerDifficultyFields = {
  approachRate?: number;
  overallDifficulty?: number;
  circleSize?: number;
  extendedLimits: boolean;
};

export type DifficultySliderSegment = {
  min: number;
  max: number;
  color?: string;
};

export function roundDifficultySliderValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatDifficultySliderValue(value: number) {
  const rounded = roundDifficultySliderValue(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function isIncompleteDifficultyInput(cleaned: string) {
  return cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-." || cleaned.endsWith(".");
}

export function sanitizeDifficultyInput(raw: string, min: number, max: number): string {
  const allowNegative = min < 0;
  let cleaned = "";
  let index = 0;
  if (allowNegative && raw.startsWith("-")) {
    cleaned = "-";
    index = 1;
  }
  let seenDot = false;
  let decimals = 0;
  for (; index < raw.length; index += 1) {
    const character = raw[index];
    if (character >= "0" && character <= "9") {
      if (seenDot) {
        if (decimals >= 1) continue;
        decimals += 1;
      }
      cleaned += character;
    } else if (character === "." && !seenDot) {
      seenDot = true;
      cleaned += ".";
    }
  }

  if (isIncompleteDifficultyInput(cleaned)) return cleaned;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return cleaned;
  if (parsed > max) return formatDifficultySliderValue(max);
  if (parsed < min) {
    if (allowNegative && cleaned.startsWith("-") && !cleaned.includes(".")) {
      const minDigits = String(Math.trunc(min));
      if (minDigits.startsWith(cleaned)) return cleaned;
    }
    return formatDifficultySliderValue(min);
  }
  return cleaned;
}

export function commitDifficultyInput(raw: string, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return Math.min(max, Math.max(min, roundDifficultySliderValue(fallback)));
  return Math.min(max, Math.max(min, roundDifficultySliderValue(parsed)));
}

export function difficultySliderSegments(
  dimension: DifficultySliderDimension,
  extendedLimits: boolean,
): DifficultySliderSegment[] {
  const main: DifficultySliderSegment = { min: 0, max: 10 };
  if (!extendedLimits) return [main];

  const high: DifficultySliderSegment = { min: 10, max: 11, color: DIFFICULTY_HIGH_COLOR };
  if (dimension === "approachRate") {
    return [{ min: -10, max: 0 }, main, high];
  }
  return [main, high];
}

export function difficultySliderRange(dimension: DifficultySliderDimension, extendedLimits: boolean) {
  const segments = difficultySliderSegments(dimension, extendedLimits);
  return { min: segments[0].min, max: segments[segments.length - 1].max };
}

export function clampDifficultySliderValue(
  dimension: DifficultySliderDimension,
  value: number,
  extendedLimits: boolean,
) {
  const { min, max } = difficultySliderRange(dimension, extendedLimits);
  return Math.min(max, Math.max(min, roundDifficultySliderValue(value)));
}

export function nudgeDifficultySliderValue(
  dimension: DifficultySliderDimension,
  value: number,
  delta: number,
  extendedLimits: boolean,
) {
  return clampDifficultySliderValue(dimension, value + delta, extendedLimits);
}

/** Shared boundaries belong to the main 0–10 capsule. */
export function segmentOwnsValue(segment: DifficultySliderSegment, value: number): boolean {
  const isMain = segment.min === 0 && segment.max === 10;
  const aboveMin = isMain || segment.min < 0 ? value >= segment.min : value > segment.min;
  const belowMax = isMain || segment.max > 10 ? value <= segment.max : value < segment.max;
  return aboveMin && belowMax;
}

export function segmentTrackPercent(segment: DifficultySliderSegment, value: number) {
  const span = segment.max - segment.min;
  if (span <= 0) return 0;
  return ((value - segment.min) / span) * 100;
}

export function difficultyTrackPercent(value: number, min: number, max: number) {
  const span = max - min;
  if (span <= 0) return 0;
  return ((value - min) / span) * 100;
}

export function difficultyRequiresExtendedLimits(...values: Array<number | undefined>) {
  return values.some((value) => typeof value === "number" && Number.isFinite(value) && (value < 0 || value > 10));
}
