import {
  clampDifficultySliderValue,
  commitDifficultyInput,
  difficultyRequiresExtendedLimits,
  difficultySliderSegments,
  sanitizeDifficultyInput,
  segmentOwnsValue,
} from "./difficulty-slider";

describe("difficulty slider segments", () => {
  it("uses a single 0–10 capsule by default", () => {
    expect(difficultySliderSegments("circleSize", false)).toEqual([{ min: 0, max: 10 }]);
    expect(difficultySliderSegments("approachRate", false)).toEqual([{ min: 0, max: 10 }]);
  });

  it("splits CS/OD into 0–10 and a high 10–11 capsule", () => {
    expect(difficultySliderSegments("circleSize", true)).toEqual([
      { min: 0, max: 10 },
      { min: 10, max: 11, color: "#ff66aa" },
    ]);
  });

  it("adds a low AR capsule from -10 to 0 when extended", () => {
    expect(difficultySliderSegments("approachRate", true)).toEqual([
      { min: -10, max: 0, color: "#e3faff" },
      { min: 0, max: 10 },
      { min: 10, max: 11, color: "#ff66aa" },
    ]);
  });

  it("gives shared boundaries to the main capsule", () => {
    const [low, main, high] = difficultySliderSegments("approachRate", true);
    expect(segmentOwnsValue(low, -0.1)).toBe(true);
    expect(segmentOwnsValue(low, 0)).toBe(false);
    expect(segmentOwnsValue(main, 0)).toBe(true);
    expect(segmentOwnsValue(main, 10)).toBe(true);
    expect(segmentOwnsValue(high, 10)).toBe(false);
    expect(segmentOwnsValue(high, 10.5)).toBe(true);
  });

  it("clamps back to 0–10 when extended limits are off", () => {
    expect(clampDifficultySliderValue("approachRate", -4, false)).toBe(0);
    expect(clampDifficultySliderValue("circleSize", 11, false)).toBe(10);
    expect(clampDifficultySliderValue("approachRate", -4, true)).toBe(-4);
    expect(clampDifficultySliderValue("overallDifficulty", 10.6, true)).toBe(10.6);
  });

  it("detects DA values outside the default 0–10 range", () => {
    expect(difficultyRequiresExtendedLimits(9, 8, 4)).toBe(false);
    expect(difficultyRequiresExtendedLimits(10, 10, 10)).toBe(false);
    expect(difficultyRequiresExtendedLimits(10.3)).toBe(true);
    expect(difficultyRequiresExtendedLimits(-4, 8, 4)).toBe(true);
    expect(difficultyRequiresExtendedLimits(undefined, 11, undefined)).toBe(true);
  });

  it("sanitizes typed difficulty values", () => {
    expect(sanitizeDifficultyInput("9.8x", 0, 10)).toBe("9.8");
    expect(sanitizeDifficultyInput("11.2", 0, 11)).toBe("11");
    expect(sanitizeDifficultyInput("-4", 0, 10)).toBe("4");
    expect(sanitizeDifficultyInput("-4", -10, 11)).toBe("-4");
    expect(sanitizeDifficultyInput("-11", -10, 11)).toBe("-10");
    expect(sanitizeDifficultyInput("9.", 0, 10)).toBe("9.");
    expect(sanitizeDifficultyInput("-", -10, 11)).toBe("-");
  });

  it("commits typed difficulty values into range", () => {
    expect(commitDifficultyInput("9.8", 5, 0, 10)).toBe(9.8);
    expect(commitDifficultyInput("-4", 5, 0, 10)).toBe(0);
    expect(commitDifficultyInput("", 9.2, -10, 11)).toBe(9.2);
  });
});
