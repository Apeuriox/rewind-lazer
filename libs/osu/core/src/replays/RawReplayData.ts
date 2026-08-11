/**
 * The one that gets parsed from an .osr file
 * This is exactly like the one you would get from osr-node
 */
import { OsuClassicMod, OsuClassicMods } from "../mods/Mods";

/**
 * osu!lazer uses a reserved version range when exporting scores to the legacy
 * .osr container. Stable versions use their YYYYMMDD build number instead.
 *
 * Keep this in sync with LegacyScoreEncoder.FIRST_LAZER_VERSION in osu!lazer.
 */
export const FIRST_LAZER_REPLAY_VERSION = 30_000_000;

export type ReplayClient = "STABLE" | "LAZER";

export function replayClientFromVersion(gameVersion: number): ReplayClient {
  return gameVersion >= FIRST_LAZER_REPLAY_VERSION ? "LAZER" : "STABLE";
}

export class RawReplayData {
  gameMode = 0;
  gameVersion = 0;
  beatmapMD5 = "";
  playerName = "";
  replayMD5 = "";
  number_300s = 0;
  number_100s = 0;
  number_50s = 0;
  gekis = 0;
  katus = 0;
  misses = 0;
  score = 0;
  max_combo = 0;
  perfect_combo = 0;
  mods = 0;
  life_bar = "";
  timestamp = 0;
  replay_length = 0;
  replay_data = "";
  unknown = 0;
}

// https://github.com/ppy/osu/blob/7654df94f6f37b8382be7dfcb4f674e03bd35427/osu.Game/Beatmaps/Legacy/LegacyMods.cs
export const ReplayModBit: Record<OsuClassicMod, number> = {
  NO_FAIL: 1 << 0,
  EASY: 1 << 1,
  // "TOUCH_DEVICE": 1 << 2,
  HIDDEN: 1 << 3,
  HARD_ROCK: 1 << 4,
  SUDDEN_DEATH: 1 << 5,
  DOUBLE_TIME: 1 << 6,
  RELAX: 1 << 7,
  HALF_TIME: 1 << 8,
  NIGHT_CORE: 1 << 9,
  FLASH_LIGHT: 1 << 10,
  AUTO_PLAY: 1 << 11,
  SPUN_OUT: 1 << 12,
  AUTO_PILOT: 1 << 13,
  PERFECT: 1 << 14,
  SCORE_V2: 1 << 29,
};

export function modsFromBitmask(modMask: number): OsuClassicMod[] {
  const list: OsuClassicMod[] = [];
  for (const mod of OsuClassicMods) {
    const bit = ReplayModBit[mod];
    if ((modMask & bit) > 0) {
      list.push(mod);
    }
  }
  return list;
}

export function modsToBitmask(mods: OsuClassicMod[]): number {
  let mask = 0;
  for (const mod of mods) {
    mask |= 1 << ReplayModBit[mod];
  }
  return mask;
}
