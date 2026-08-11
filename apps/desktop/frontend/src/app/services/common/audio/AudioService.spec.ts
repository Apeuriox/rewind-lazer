import {
  HIGH_PRECISION_AUDIO_MAX_DURATION_MS,
  canUseHighPrecisionAudio,
  encodePcm16Wav,
  highPrecisionAudioUnavailableReason,
} from "./AudioService";

function ascii(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

describe("encodePcm16Wav", () => {
  it("encodes an interleaved stereo PCM WAV with a valid header", () => {
    const wav = encodePcm16Wav(
      [new Float32Array([-1, 0.5]), new Float32Array([1, -0.5])],
      44_100,
    );
    const view = new DataView(wav);

    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(-32_768);
    expect(view.getInt16(46, true)).toBe(32_767);
    expect(view.getInt16(48, true)).toBe(16_383);
    expect(view.getInt16(50, true)).toBe(-16_384);
  });

  it("rejects invalid channel layouts", () => {
    expect(() => encodePcm16Wav([], 44_100)).toThrow("without audio channels");
    expect(() => encodePcm16Wav([new Float32Array(1), new Float32Array(2)], 44_100)).toThrow(
      "different lengths",
    );
  });
});

describe("high-precision audio availability", () => {
  it("allows MP3 tracks up to ten minutes", () => {
    expect(canUseHighPrecisionAudio("song.MP3")).toBe(true);
    expect(highPrecisionAudioUnavailableReason("song.mp3", HIGH_PRECISION_AUDIO_MAX_DURATION_MS)).toBeUndefined();
  });

  it("rejects tracks longer than ten minutes", () => {
    expect(highPrecisionAudioUnavailableReason("song.mp3", HIGH_PRECISION_AUDIO_MAX_DURATION_MS + 1)).toBe(
      "TOO_LONG",
    );
  });

  it("does not offer conversion for non-MP3 audio", () => {
    expect(highPrecisionAudioUnavailableReason("song.wav", 60_000)).toBe("NOT_MP3");
  });
});
