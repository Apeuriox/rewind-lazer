// TODO: Rename this to replay or something
import { DifficultyAdjustSettings, OsuClassicMod, ReplayClient, ReplayFrame } from "@osujs/core";

export type RosuApiMod = {
  acronym: string;
  settings?: Record<string, unknown>;
};

export type OsuReplay = {
  md5hash: string;
  beatmapMd5: string;
  gameVersion: number;
  client: ReplayClient;
  mods: OsuClassicMod[];
  /** The full clock rate stored in a lazer replay's mod settings. */
  clockRate?: number;
  /** Lazer Difficulty Adjust (DA) overrides for CS/AR/OD/HP. */
  difficultyAdjust?: DifficultyAdjustSettings;
  /** Lazer score-info mods (`{ acronym, settings }`), when present. */
  lazerMods?: RosuApiMod[];
  player: string; // Could be useful to draw
  frames: ReplayFrame[];
};
