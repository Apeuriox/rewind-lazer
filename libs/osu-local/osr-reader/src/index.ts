import { promises as fs } from "fs";
import { read, Replay as OsrReplay } from "node-osr";

// node-osr deliberately stops after the legacy online id. lazer replay files
// append another LZMA-compressed block containing the full score information,
// including settings which cannot be represented by the stable mod bitmask.
type Decompress = (
  input: Buffer,
  callback: (result: string | Uint8Array, error: Error | number | null) => void,
) => void;
// lzma is a CommonJS dependency of node-osr and does not publish TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decompress } = require("lzma") as { decompress: Decompress };

const FIRST_LAZER_SCORE_INFO_VERSION = 30_000_001;

export interface LazerReplayMod {
  acronym: string;
  settings?: {
    speed_change?: number;
    circle_size?: number;
    approach_rate?: number;
    overall_difficulty?: number;
    drain_rate?: number;
    extended_limits?: boolean;
    [key: string]: unknown;
  };
}

export type DifficultyAdjustSettings = {
  circleSize?: number;
  approachRate?: number;
  overallDifficulty?: number;
  drainRate?: number;
};

export interface LazerReplayScoreInfo {
  client_version?: string;
  mods?: LazerReplayMod[];
  [key: string]: unknown;
}

export interface ExtendedOsrReplay extends OsrReplay {
  lazerScoreInfo?: LazerReplayScoreInfo;
  /** Raw lazer score-info mods array (`[{ acronym, settings? }, ...]`). */
  lazerMods?: LazerReplayMod[];
  clockRate?: number;
  difficultyAdjust?: DifficultyAdjustSettings;
}

class ReplayBufferReader {
  offset = 0;

  constructor(private readonly buffer: Buffer) {}

  readByte() {
    this.ensureAvailable(1);
    return this.buffer.readUInt8(this.offset++);
  }

  readInt32() {
    this.ensureAvailable(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  skip(length: number) {
    if (!Number.isInteger(length) || length < 0) throw new Error(`Invalid replay field length: ${length}`);
    this.ensureAvailable(length);
    this.offset += length;
  }

  readString() {
    const marker = this.readByte();
    if (marker === 0) return;
    if (marker !== 0x0b) throw new Error(`Invalid osu! string marker: ${marker}`);
    this.skip(this.readUnsignedLeb128());
  }

  readByteArray() {
    const length = this.readInt32();
    if (length < 0) return undefined;
    this.ensureAvailable(length);
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private readUnsignedLeb128() {
    let value = 0;
    let shift = 0;

    while (shift <= 28) {
      const current = this.readByte();
      value += (current & 0x7f) * 2 ** shift;
      if ((current & 0x80) === 0) return value;
      shift += 7;
    }

    throw new Error("Invalid osu! string length");
  }

  private ensureAvailable(length: number) {
    if (this.offset + length > this.buffer.length) throw new Error("Unexpected end of replay file");
  }
}

function decompressScoreInfo(data: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    decompress(data, (result, error) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(`Could not decompress lazer score info (${error})`));
        return;
      }

      resolve(typeof result === "string" ? result : Buffer.from(result).toString("utf8"));
    });
  });
}

export function clockRateFromScoreInfo(scoreInfo: LazerReplayScoreInfo): number | undefined {
  for (const mod of scoreInfo.mods ?? []) {
    const speedChange = mod.settings?.speed_change;
    if (typeof speedChange === "number" && Number.isFinite(speedChange) && speedChange > 0) return speedChange;
  }
  return undefined;
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Reads lazer Difficulty Adjust (DA) overrides. Unspecified fields stay at the beatmap values. */
export function difficultyAdjustFromScoreInfo(scoreInfo: LazerReplayScoreInfo): DifficultyAdjustSettings | undefined {
  const mod = (scoreInfo.mods ?? []).find((m) => m.acronym === "DA");
  if (!mod) return undefined;

  const settings = mod.settings ?? {};
  const circleSize = readOptionalFiniteNumber(settings.circle_size);
  const approachRate = readOptionalFiniteNumber(settings.approach_rate);
  const overallDifficulty = readOptionalFiniteNumber(settings.overall_difficulty);
  const drainRate = readOptionalFiniteNumber(settings.drain_rate);

  if (
    circleSize === undefined &&
    approachRate === undefined &&
    overallDifficulty === undefined &&
    drainRate === undefined
  ) {
    return undefined;
  }

  return {
    ...(circleSize !== undefined ? { circleSize } : {}),
    ...(approachRate !== undefined ? { approachRate } : {}),
    ...(overallDifficulty !== undefined ? { overallDifficulty } : {}),
    ...(drainRate !== undefined ? { drainRate } : {}),
  };
}

export async function parseLazerScoreInfo(buffer: Buffer): Promise<LazerReplayScoreInfo | undefined> {
  const reader = new ReplayBufferReader(buffer);

  reader.skip(1); // game mode
  const version = reader.readInt32();
  if (version < FIRST_LAZER_SCORE_INFO_VERSION) return undefined;

  reader.readString(); // beatmap MD5
  reader.readString(); // player name
  reader.readString(); // replay MD5
  reader.skip(2 * 6); // judgement counts
  reader.skip(4); // score
  reader.skip(2); // maximum combo
  reader.skip(1); // perfect combo
  reader.skip(4); // legacy mod bitmask
  reader.readString(); // life bar
  reader.skip(8); // timestamp
  reader.readByteArray(); // replay frames
  reader.skip(8); // legacy online id

  const compressedScoreInfo = reader.readByteArray();
  if (!compressedScoreInfo?.length) return undefined;

  return JSON.parse(await decompressScoreInfo(compressedScoreInfo)) as LazerReplayScoreInfo;
}

/** Reads both the stable-compatible replay fields and lazer's appended score information. */
export async function readExtendedReplay(input: string | Buffer): Promise<ExtendedOsrReplay> {
  const buffer = typeof input === "string" ? await fs.readFile(input) : input;
  const replay = (await read(buffer)) as ExtendedOsrReplay;
  const scoreInfo = await parseLazerScoreInfo(buffer);

  if (scoreInfo) {
    replay.lazerScoreInfo = scoreInfo;
    replay.lazerMods = Array.isArray(scoreInfo.mods) ? scoreInfo.mods : [];
    replay.clockRate = clockRateFromScoreInfo(scoreInfo);
    replay.difficultyAdjust = difficultyAdjustFromScoreInfo(scoreInfo);
  } else if (replay.gameVersion > 30_000_000) {
    replay.lazerMods = [];
  }

  return replay;
}

export { readSync, read } from "node-osr";
export { OsrReplay };
