import { DifficultyAdjustSettings, FIRST_LAZER_REPLAY_VERSION, OsuClassicMod, ReplayModBit } from "@osujs/core";
import type { OsuReplay, RosuApiMod } from "../model/OsuReplay";
import type { ViewerDifficultyFields } from "./difficulty-slider";

/** Lazer .osr versions are reserved above 30000000. */
export function isLazerReplayVersion(gameVersion: number) {
  return gameVersion > FIRST_LAZER_REPLAY_VERSION;
}

export type CalculateOsuStrainsOptions = {
  mods?: number | string | RosuApiMod[];
  clockRate?: number;
  ar?: number;
  cs?: number;
  od?: number;
  hp?: number;
  fixedAr?: boolean;
  fixedCs?: boolean;
  fixedOd?: boolean;
  fixedHp?: boolean;
  lazer?: boolean;
};

export function sanitizeLazerMods(mods: unknown): RosuApiMod[] {
  if (!Array.isArray(mods)) return [];
  const sanitized: RosuApiMod[] = [];
  for (const entry of mods) {
    if (!entry || typeof entry !== "object") continue;
    const acronym = (entry as RosuApiMod).acronym;
    if (typeof acronym !== "string" || acronym.length === 0) continue;
    const settings = (entry as RosuApiMod).settings;
    if (settings && typeof settings === "object" && !Array.isArray(settings)) {
      sanitized.push({ acronym, settings: { ...settings } });
    } else {
      sanitized.push({ acronym });
    }
  }
  return sanitized;
}

function applyDifficultyAdjust(
  options: CalculateOsuStrainsOptions,
  settings?: DifficultyAdjustSettings,
) {
  if (!settings) return;
  if (settings.approachRate !== undefined) {
    options.ar = settings.approachRate;
    options.fixedAr = true;
  }
  if (settings.circleSize !== undefined) {
    options.cs = settings.circleSize;
    options.fixedCs = true;
  }
  if (settings.overallDifficulty !== undefined) {
    options.od = settings.overallDifficulty;
    options.fixedOd = true;
  }
  if (settings.drainRate !== undefined) {
    options.hp = settings.drainRate;
    options.fixedHp = true;
  }
}

function mergeViewerIntoDifficultyAdjust(
  replayDa: DifficultyAdjustSettings | undefined,
  viewer: ViewerDifficultyFields | undefined,
): DifficultyAdjustSettings | undefined {
  const merged: DifficultyAdjustSettings = { ...replayDa };
  if (viewer?.approachRate !== undefined) merged.approachRate = viewer.approachRate;
  if (viewer?.overallDifficulty !== undefined) merged.overallDifficulty = viewer.overallDifficulty;
  if (viewer?.circleSize !== undefined) merged.circleSize = viewer.circleSize;
  if (
    merged.approachRate === undefined &&
    merged.overallDifficulty === undefined &&
    merged.circleSize === undefined &&
    merged.drainRate === undefined
  ) {
    return undefined;
  }
  return merged;
}

function viewerDifficultyAdjust(viewer: ViewerDifficultyFields | undefined): DifficultyAdjustSettings | undefined {
  if (!viewer) return undefined;
  const settings: DifficultyAdjustSettings = {};
  if (viewer.approachRate !== undefined) settings.approachRate = viewer.approachRate;
  if (viewer.overallDifficulty !== undefined) settings.overallDifficulty = viewer.overallDifficulty;
  if (viewer.circleSize !== undefined) settings.circleSize = viewer.circleSize;
  return settings.approachRate !== undefined ||
    settings.overallDifficulty !== undefined ||
    settings.circleSize !== undefined
    ? settings
    : undefined;
}

function mergeViewerDaMod(mods: RosuApiMod[], settings: DifficultyAdjustSettings): RosuApiMod[] {
  const next = sanitizeLazerMods(mods);
  let da = next.find((mod) => mod.acronym === "DA");
  if (!da) {
    da = { acronym: "DA", settings: {} };
    next.push(da);
  }
  da.settings = { ...da.settings };
  if (settings.circleSize !== undefined) da.settings.circle_size = settings.circleSize;
  if (settings.approachRate !== undefined) da.settings.approach_rate = settings.approachRate;
  if (settings.overallDifficulty !== undefined) da.settings.overall_difficulty = settings.overallDifficulty;
  if (settings.drainRate !== undefined) da.settings.drain_rate = settings.drainRate;
  return next;
}

export function buildRosuCalcOptions(
  replay: Pick<OsuReplay, "mods" | "clockRate" | "difficultyAdjust" | "client" | "lazerMods" | "gameVersion">,
  viewer?: ViewerDifficultyFields,
): CalculateOsuStrainsOptions {
  const options: CalculateOsuStrainsOptions = {
    lazer: isLazerReplayVersion(replay.gameVersion) || replay.client === "LAZER",
  };

  if (isLazerReplayVersion(replay.gameVersion)) {
    // Pass the score-info mods array itself, not a bitmask and not `{ mods: [...] }`.
    const mods = sanitizeLazerMods(replay.lazerMods);
    const viewerDa = viewerDifficultyAdjust(viewer);
    options.mods = viewerDa ? mergeViewerDaMod(mods, viewerDa) : mods;
    return options;
  }

  const mergedDa = mergeViewerIntoDifficultyAdjust(replay.difficultyAdjust, viewer);
  options.mods = replay.mods.reduce((mask, mod) => mask | ReplayModBit[mod as OsuClassicMod], 0);
  applyDifficultyAdjust(options, mergedDa);
  if (replay.clockRate !== undefined) options.clockRate = replay.clockRate;
  return options;
}
