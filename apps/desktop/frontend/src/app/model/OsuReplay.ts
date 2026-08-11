// TODO: Rename this to replay or something
import { OsuClassicMod, ReplayClient, ReplayFrame } from "@osujs/core";

export type OsuReplay = {
  md5hash: string;
  beatmapMd5: string;
  gameVersion: number;
  client: ReplayClient;
  mods: OsuClassicMod[];
  /** The full clock rate stored in a lazer replay's mod settings. */
  clockRate?: number;
  player: string; // Could be useful to draw
  frames: ReplayFrame[];
};
