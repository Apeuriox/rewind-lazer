import { BeatmapDifficulty } from "../beatmap/BeatmapDifficulty";

/**
 * Lazer Difficulty Adjust (DA) overrides. Unspecified fields keep the current
 * beatmap values. Unlike Hard Rock, these are not capped at 10.
 */
export type DifficultyAdjustSettings = {
  circleSize?: number;
  approachRate?: number;
  overallDifficulty?: number;
  drainRate?: number;
};

export class DifficultyAdjustMod {
  static apply(base: BeatmapDifficulty, settings?: DifficultyAdjustSettings): BeatmapDifficulty {
    if (!settings) return base;

    return {
      ...base,
      circleSize: settings.circleSize ?? base.circleSize,
      approachRate: settings.approachRate ?? base.approachRate,
      overallDifficulty: settings.overallDifficulty ?? base.overallDifficulty,
      drainRate: settings.drainRate ?? base.drainRate,
    };
  }
}
