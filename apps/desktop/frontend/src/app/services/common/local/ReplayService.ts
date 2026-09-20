import { modsFromBitmask, parseReplayFramesFromRaw, replayClientFromVersion } from "@osujs/core";
import { injectable } from "inversify";
import { OsuReplay } from "../../../model/OsuReplay";
import { ipcRenderer } from "electron";

export type REPLAY_SOURCES = "OSU_API" | "FILE";

function readLazerMods(res: {
  gameVersion?: number;
  lazerMods?: unknown;
  lazerScoreInfo?: { mods?: unknown };
}) {
  if (Array.isArray(res.lazerMods)) return res.lazerMods;
  if (Array.isArray(res.lazerScoreInfo?.mods)) return res.lazerScoreInfo.mods;
  if (typeof res.gameVersion === "number" && res.gameVersion > 30_000_000) return [];
  return undefined;
}

@injectable()
export class ReplayService {
  async retrieveReplay(replayId: string, source: REPLAY_SOURCES = "FILE"): Promise<OsuReplay> {
    const filePath = replayId;
    // const res = await readOsr(filePath);
    // Currently using readOsr is bugged, so we need to use it from the main process
    const res = await ipcRenderer.invoke("readOsr", filePath);
    return {
      gameVersion: res.gameVersion,
      client: replayClientFromVersion(res.gameVersion),
      frames: parseReplayFramesFromRaw(res.replay_data),
      mods: modsFromBitmask(res.mods),
      clockRate: res.clockRate,
      difficultyAdjust: res.difficultyAdjust,
      lazerMods: readLazerMods(res),
      md5hash: res.replayMD5,
      beatmapMd5: res.beatmapMD5,
      player: res.playerName,
    };
  }
}
