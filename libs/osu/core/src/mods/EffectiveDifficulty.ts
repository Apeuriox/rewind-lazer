import {
  approachDurationToApproachRate,
  approachRateToApproachDuration,
  hitWindowGreatToOD,
  overallDifficultyToHitWindowGreat,
} from "@osujs/math";
import { BeatmapDifficulty } from "../beatmap/BeatmapDifficulty";
import { DifficultyAdjustSettings } from "./DifficultyAdjustMod";
import { OsuClassicMod } from "./Mods";

export type EffectiveDifficultyValues = {
  approachRate: number;
  overallDifficulty: number;
  circleSize: number;
  drainRate: number;
};

export type DifficultyStatChange = "none" | "up" | "down";

export type DifficultyHudLine = {
  text: string;
  change: DifficultyStatChange;
};

export const OsuModAcronym: Record<OsuClassicMod, string> = {
  NO_FAIL: "NF",
  EASY: "EZ",
  HIDDEN: "HD",
  HARD_ROCK: "HR",
  SUDDEN_DEATH: "SD",
  DOUBLE_TIME: "DT",
  RELAX: "RX",
  HALF_TIME: "HT",
  NIGHT_CORE: "NC",
  FLASH_LIGHT: "FL",
  AUTO_PLAY: "AT",
  SPUN_OUT: "SO",
  AUTO_PILOT: "AP",
  PERFECT: "PF",
  SCORE_V2: "SV2",
};

const MOD_DISPLAY_ORDER = ["NF", "EZ", "HT", "HD", "HR", "SD", "PF", "DT", "NC", "FL", "RX", "AT", "AP", "SO", "SV2", "DA"];

/**
 * Effective CS/AR/OD/HP after EZ/HR/DA, then clock-rate (DT/HT/NC).
 * Rate only changes AR and OD, matching ModCalculatorUtil.calcAllValues for osu!std.
 */
export function effectiveDifficultyValues(
  difficulty: BeatmapDifficulty,
  clockRate: number,
): EffectiveDifficultyValues {
  const rate = clockRate > 0 ? clockRate : 1;
  if (rate === 1) {
    return {
      approachRate: difficulty.approachRate,
      overallDifficulty: difficulty.overallDifficulty,
      circleSize: difficulty.circleSize,
      drainRate: difficulty.drainRate,
    };
  }

  return {
    approachRate: approachDurationToApproachRate(approachRateToApproachDuration(difficulty.approachRate) / rate),
    overallDifficulty: hitWindowGreatToOD(overallDifficultyToHitWindowGreat(difficulty.overallDifficulty) / rate),
    circleSize: difficulty.circleSize,
    drainRate: difficulty.drainRate,
  };
}

export function roundDifficultyValue(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatDifficultyValue(value: number): string {
  const rounded = roundDifficultyValue(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

export function formatDifficultyStatLine(label: string, current: number, reference: number): DifficultyHudLine {
  const currentRounded = roundDifficultyValue(current);
  const referenceRounded = roundDifficultyValue(reference);
  if (currentRounded === referenceRounded) {
    return { text: `${label}: ${formatDifficultyValue(current)}`, change: "none" };
  }
  return {
    text: `${label}: ${formatDifficultyValue(current)} (${formatDifficultyValue(reference)})`,
    change: currentRounded > referenceRounded ? "up" : "down",
  };
}

function daOverrideValue(
  settings: DifficultyAdjustSettings | undefined,
  key: keyof DifficultyAdjustSettings,
): number | undefined {
  const value = settings?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Parenthetical value: DA's override when rate (DT/HT) further changes that field,
 * otherwise the map's original value.
 */
function referenceDifficultyValue(current: number, nominal: number, mapOriginal: number, daValue?: number): number {
  if (daValue !== undefined && roundDifficultyValue(current) !== roundDifficultyValue(nominal)) {
    return nominal;
  }
  return mapOriginal;
}

export function formatReplayModsLine(mods: OsuClassicMod[], hasDifficultyAdjust: boolean): string {
  const acronyms = mods.map((mod) => OsuModAcronym[mod]);
  if (hasDifficultyAdjust) acronyms.push("DA");
  acronyms.sort((a, b) => MOD_DISPLAY_ORDER.indexOf(a) - MOD_DISPLAY_ORDER.indexOf(b));
  return `Mods: ${acronyms.length === 0 ? "NM" : acronyms.join(" ")}`;
}

export function difficultyHudLines(beatmap: {
  difficulty: BeatmapDifficulty;
  originalDifficulty: BeatmapDifficulty;
  gameClockRate: number;
  appliedMods: OsuClassicMod[];
  difficultyAdjust?: DifficultyAdjustSettings;
}): DifficultyHudLine[] {
  const current = effectiveDifficultyValues(beatmap.difficulty, beatmap.gameClockRate);
  const nominal = beatmap.difficulty;
  const original = beatmap.originalDifficulty;
  const da = beatmap.difficultyAdjust;
  return [
    formatDifficultyStatLine(
      "AR",
      current.approachRate,
      referenceDifficultyValue(
        current.approachRate,
        nominal.approachRate,
        original.approachRate,
        daOverrideValue(da, "approachRate"),
      ),
    ),
    formatDifficultyStatLine(
      "OD",
      current.overallDifficulty,
      referenceDifficultyValue(
        current.overallDifficulty,
        nominal.overallDifficulty,
        original.overallDifficulty,
        daOverrideValue(da, "overallDifficulty"),
      ),
    ),
    formatDifficultyStatLine(
      "CS",
      current.circleSize,
      referenceDifficultyValue(
        current.circleSize,
        nominal.circleSize,
        original.circleSize,
        daOverrideValue(da, "circleSize"),
      ),
    ),
    formatDifficultyStatLine(
      "HP",
      current.drainRate,
      referenceDifficultyValue(current.drainRate, nominal.drainRate, original.drainRate, daOverrideValue(da, "drainRate")),
    ),
    { text: formatReplayModsLine(beatmap.appliedMods, da !== undefined), change: "none" },
  ];
}
