import { injectable } from "inversify";
import { mimeTypeFor } from "../local/LazerFileStore";

const WAV_HEADER_SIZE = 44;
const PCM_BITS_PER_SAMPLE = 16;
const PCM_BYTES_PER_SAMPLE = PCM_BITS_PER_SAMPLE / 8;
export const HIGH_PRECISION_AUDIO_MAX_DURATION_MS = 10 * 60 * 1_000;

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
      if (!canUseHighPrecisionAudio(filename)) throw new Error(`High-precision audio is not supported for '${filename}'`);

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
