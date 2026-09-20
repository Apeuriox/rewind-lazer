import {
  AUTO_HIGH_PRECISION_AUDIO_MAX_DURATION_MS,
  HIGH_PRECISION_AUDIO_MAX_DURATION_MS,
  canUseHighPrecisionAudio,
  encodePcm16Wav,
  highPrecisionAudioUnavailableReason,
  inspectMp3SeekRisk,
} from "./AudioService";

function ascii(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

describe("encodePcm16Wav", () => {
  it("encodes an interleaved stereo PCM WAV with a valid header", () => {
    const wav = encodePcm16Wav([new Float32Array([-1, 0.5]), new Float32Array([1, -0.5])], 44_100);
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
    expect(() => encodePcm16Wav([new Float32Array(1), new Float32Array(2)], 44_100)).toThrow("different lengths");
  });
});

describe("high-precision audio availability", () => {
  it("allows MP3 tracks up to fifteen minutes", () => {
    expect(canUseHighPrecisionAudio("song.MP3")).toBe(true);
    expect(highPrecisionAudioUnavailableReason("song.mp3", HIGH_PRECISION_AUDIO_MAX_DURATION_MS)).toBeUndefined();
  });

  it("keeps the automatic threshold at ten minutes", () => {
    expect(AUTO_HIGH_PRECISION_AUDIO_MAX_DURATION_MS).toBe(10 * 60 * 1_000);
  });

  it("rejects tracks longer than fifteen minutes", () => {
    expect(highPrecisionAudioUnavailableReason("song.mp3", HIGH_PRECISION_AUDIO_MAX_DURATION_MS + 1)).toBe("TOO_LONG");
  });

  it("does not offer conversion for non-MP3 audio", () => {
    expect(highPrecisionAudioUnavailableReason("song.wav", 60_000)).toBe("NOT_MP3");
  });
});

function makeMp3(marker?: "Info" | "Xing" | "VBRI", secondFrameHeader = 0xfffb9000) {
  const firstFrameSize = 417;
  const data = new ArrayBuffer(firstFrameSize + 522);
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo, no CRC.
  view.setUint32(0, 0xfffb9000, false);
  view.setUint32(firstFrameSize, secondFrameHeader, false);
  if (marker) {
    const offset = marker === "VBRI" ? 36 : 36;
    marker.split("").forEach((character, index) => {
      bytes[offset + index] = character.charCodeAt(0);
    });
  }
  return data;
}

describe("MP3 seek risk detection", () => {
  it("keeps CBR files carrying an Info seek header on the normal audio path", () => {
    expect(inspectMp3SeekRisk(makeMp3("Info"))).toEqual({ requiresHighPrecision: false, header: "INFO" });
  });

  it.each([
    ["headerless CBR", undefined, "NONE"],
    ["Xing VBR", "Xing", "XING"],
    ["VBRI VBR", "VBRI", "VBRI"],
  ] as const)("marks %s audio as risky", (_description, marker, header) => {
    expect(inspectMp3SeekRisk(makeMp3(marker))).toEqual({ requiresHighPrecision: true, header });
  });

  it("does not trust an Info header when the actual frame bitrates vary", () => {
    // MPEG-1 Layer III, 160 kbps, 44.1 kHz, stereo, no CRC.
    expect(inspectMp3SeekRisk(makeMp3("Info", 0xfffba000))).toEqual({
      requiresHighPrecision: true,
      header: "INFO",
    });
  });
});
