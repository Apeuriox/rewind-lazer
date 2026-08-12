import { injectable } from "inversify";
import { mimeTypeFor } from "../local/LazerFileStore";

const WAV_HEADER_SIZE = 44;
const PCM_BITS_PER_SAMPLE = 16;
const PCM_BYTES_PER_SAMPLE = PCM_BITS_PER_SAMPLE / 8;
export const AUTO_HIGH_PRECISION_AUDIO_MAX_DURATION_MS = 10 * 60 * 1_000;
export const HIGH_PRECISION_AUDIO_MAX_DURATION_MS = 15 * 60 * 1_000;

export type Mp3SeekHeader = "INFO" | "XING" | "VBRI" | "NONE" | "UNKNOWN";

export interface Mp3SeekRisk {
  requiresHighPrecision: boolean;
  header: Mp3SeekHeader;
}

interface Mp3Frame {
  offset: number;
  size: number;
  bitrate: number;
  sampleRate: number;
  version: 1 | 2 | 2.5;
  layer: 1 | 2 | 3;
  channelMode: number;
  hasCrc: boolean;
}

const MPEG_1_BITRATES = {
  1: [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  2: [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  3: [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
} as const;
const MPEG_2_BITRATES = {
  1: [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  2: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  3: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;

function asciiAt(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return "";
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function id3v2End(bytes: Uint8Array) {
  if (asciiAt(bytes, 0).slice(0, 3) !== "ID3" || bytes.length < 10) return 0;
  if ([bytes[6], bytes[7], bytes[8], bytes[9]].some((value) => (value & 0x80) !== 0)) return 0;
  const tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
  const footerSize = (bytes[5] & 0x10) !== 0 ? 10 : 0;
  return 10 + tagSize + footerSize;
}

function parseMp3Frame(view: DataView, offset: number): Mp3Frame | undefined {
  if (offset < 0 || offset + 4 > view.byteLength) return undefined;
  const header = view.getUint32(offset, false);
  if ((header & 0xffe00000) >>> 0 !== 0xffe00000) return undefined;

  const versionBits = (header >>> 19) & 0b11;
  const layerBits = (header >>> 17) & 0b11;
  const bitrateIndex = (header >>> 12) & 0b1111;
  const sampleRateIndex = (header >>> 10) & 0b11;
  if (versionBits === 0b01 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return undefined;
  }

  const version = ({ 0: 2.5, 2: 2, 3: 1 } as const)[versionBits as 0 | 2 | 3];
  const layer = ({ 1: 3, 2: 2, 3: 1 } as const)[layerBits as 1 | 2 | 3];
  const bitrates = version === 1 ? MPEG_1_BITRATES[layer] : MPEG_2_BITRATES[layer];
  const bitrate = bitrates[bitrateIndex - 1] * 1_000;
  const baseSampleRates = [44_100, 48_000, 32_000] as const;
  const sampleRate = baseSampleRates[sampleRateIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4);
  const padding = (header >>> 9) & 1;
  const size =
    layer === 1
      ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
      : Math.floor(((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / sampleRate) + padding;

  return {
    offset,
    size,
    bitrate,
    sampleRate,
    version,
    layer,
    channelMode: (header >>> 6) & 0b11,
    hasCrc: ((header >>> 16) & 1) === 0,
  };
}

function findFirstMp3Frame(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  const start = id3v2End(bytes);
  const searchEnd = Math.min(view.byteLength - 4, start + 4 * 1024 * 1024);
  for (let offset = start; offset <= searchEnd; offset += 1) {
    const frame = parseMp3Frame(view, offset);
    if (!frame) continue;
    const next = parseMp3Frame(view, offset + frame.size);
    if (next && next.version === frame.version && next.layer === frame.layer && next.sampleRate === frame.sampleRate) {
      return frame;
    }
  }
  return undefined;
}

/**
 * Chromium may seek MP3 files inaccurately when they do not provide a reliable
 * byte/time table. Our known-safe CBR samples carry an Info header; Xing/VBRI
 * files and headerless files use the high-precision PCM path automatically.
 */
export function inspectMp3SeekRisk(data: ArrayBuffer): Mp3SeekRisk {
  const bytes = new Uint8Array(data);
  const frame = findFirstMp3Frame(data);
  if (!frame || frame.layer !== 3) return { requiresHighPrecision: true, header: "UNKNOWN" };

  const sideInfoSize = frame.version === 1 ? (frame.channelMode === 3 ? 17 : 32) : frame.channelMode === 3 ? 9 : 17;
  const xingOffset = frame.offset + 4 + (frame.hasCrc ? 2 : 0) + sideInfoSize;
  const xingMarker = asciiAt(bytes, xingOffset);
  const header: Mp3SeekHeader = xingMarker === "Info" ? "INFO" : xingMarker === "Xing" ? "XING" : "NONE";

  const view = new DataView(data);
  let offset = frame.offset;
  let scannedFrames = 0;
  while (offset + 4 <= view.byteLength) {
    const current = parseMp3Frame(view, offset);
    if (
      !current ||
      current.version !== frame.version ||
      current.layer !== frame.layer ||
      current.sampleRate !== frame.sampleRate
    ) {
      break;
    }
    if (current.bitrate !== frame.bitrate) return { requiresHighPrecision: true, header };
    offset += current.size;
    scannedFrames += 1;
  }

  if (scannedFrames < 2) return { requiresHighPrecision: true, header: "UNKNOWN" };
  if (header === "INFO") return { requiresHighPrecision: false, header };
  if (header === "XING") return { requiresHighPrecision: true, header };

  const vbriMarker = asciiAt(bytes, frame.offset + 36);
  if (vbriMarker === "VBRI") return { requiresHighPrecision: true, header: "VBRI" };
  return { requiresHighPrecision: true, header: "NONE" };
}

export function canUseHighPrecisionAudio(filename: string) {
  return mimeTypeFor(filename) === "audio/mpeg";
}

export function highPrecisionAudioUnavailableReason(filename: string, durationInMs: number) {
  if (!canUseHighPrecisionAudio(filename)) return "NOT_MP3" as const;
  if (durationInMs > HIGH_PRECISION_AUDIO_MAX_DURATION_MS) return "TOO_LONG" as const;
  return undefined;
}

export function encodePcm16Wav(channelData: Float32Array[], sampleRate: number): ArrayBuffer {
  if (channelData.length === 0) throw new Error("Cannot encode WAV without audio channels");
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error(`Invalid WAV sample rate: ${sampleRate}`);

  const frameCount = channelData[0].length;
  if (channelData.some((channel) => channel.length !== frameCount)) {
    throw new Error("Cannot encode WAV channels with different lengths");
  }

  const channelCount = channelData.length;
  const blockAlign = channelCount * PCM_BYTES_PER_SAMPLE;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, PCM_BITS_PER_SAMPLE, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = WAV_HEADER_SIZE;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += PCM_BYTES_PER_SAMPLE;
    }
  }

  return buffer;
}

/**
 * Only one AudioService?
 * Only one AudioContext.
 */
@injectable()
export class AudioService {
  private audioContext: AudioContext;
  private temporaryAudioUrl?: string;

  audios: Record<string, HTMLAudioElement> = {};

  constructor() {
    this.audioContext = new AudioContext();
  }

  async loadAudio(source: string | ArrayBuffer, filename: string, highPrecision = false) {
    this.releaseTemporaryAudio();

    let songUrl: string;

    if (highPrecision) {
      if (typeof source === "string") throw new Error("High-precision audio requires the original audio data");
      if (!canUseHighPrecisionAudio(filename))
        throw new Error(`High-precision audio is not supported for '${filename}'`);

      console.log(`Decoding '${filename}' to a temporary PCM WAV`);
      const decoded = await this.audioContext.decodeAudioData(source.slice(0));
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
      const mediaData = encodePcm16Wav(channels, decoded.sampleRate);
      songUrl = URL.createObjectURL(new Blob([mediaData], { type: "audio/wav" }));
      this.temporaryAudioUrl = songUrl;
      console.log(
        `Temporary WAV created: ${decoded.numberOfChannels} channels, ${decoded.sampleRate}Hz, ${mediaData.byteLength} bytes`,
      );
    } else if (typeof source === "string") {
      songUrl = source;
    } else {
      songUrl = URL.createObjectURL(new Blob([source], { type: mimeTypeFor(filename) }));
      this.temporaryAudioUrl = songUrl;
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.src = songUrl;
    await new Promise<void>((resolve, reject) => {
      const handleLoadedMetadata = () => {
        audio.removeEventListener("error", handleError);
        resolve();
      };
      const handleError = () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        reject(new Error(`Could not load audio '${filename}'`));
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });
      audio.addEventListener("error", handleError, { once: true });
      audio.load();
    });
    return audio;
  }

  releaseTemporaryAudio() {
    if (!this.temporaryAudioUrl) return;
    URL.revokeObjectURL(this.temporaryAudioUrl);
    this.temporaryAudioUrl = undefined;
  }
}
