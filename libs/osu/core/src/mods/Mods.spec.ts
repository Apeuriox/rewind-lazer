import { DEFAULT_BEATMAP_DIFFICULTY } from "../beatmap/BeatmapDifficulty";
import { HardRockMod } from "./HardRockMod";
import { EasyMod } from "./EasyMod";
import { DifficultyAdjustMod } from "./DifficultyAdjustMod";

describe("HardRock", function () {
  describe("BeatmapDifficulty adjusting", function () {
    it("should adjust to 10 max", function () {
      const original = {
        ...DEFAULT_BEATMAP_DIFFICULTY,
        approachRate: 8,
        drainRate: 9,
        overallDifficulty: 8,
        circleSize: 4,
      };
      const expected = {
        ...DEFAULT_BEATMAP_DIFFICULTY,
        approachRate: 10,
        drainRate: 10,
        overallDifficulty: 10,
        circleSize: 5.2,
      };
      const actual = HardRockMod.difficultyAdjuster(original);
      expect(actual).toEqual(expected);
    });
  });
});

test("EasyMod should half AR, OD, CS, HP ", () => {
  const original = {
    ...DEFAULT_BEATMAP_DIFFICULTY,
    approachRate: 8,
    drainRate: 9,
    overallDifficulty: 8,
    circleSize: 4,
  };
  const expected = {
    ...DEFAULT_BEATMAP_DIFFICULTY,
    approachRate: 4,
    drainRate: 4.5,
    overallDifficulty: 4,
    circleSize: 2,
  };
  const actual = EasyMod.difficultyAdjuster(original);
  expect(actual).toEqual(expected);

  // Test immutability
  expect(original.approachRate).toEqual(8);
});

describe("DifficultyAdjust", function () {
  const original = {
    ...DEFAULT_BEATMAP_DIFFICULTY,
    approachRate: 8,
    drainRate: 9,
    overallDifficulty: 8,
    circleSize: 4,
  };

  it("overrides only the specified difficulty values", function () {
    const actual = DifficultyAdjustMod.apply(original, { circleSize: 6.5, approachRate: 9.2 });
    expect(actual).toEqual({
      ...original,
      circleSize: 6.5,
      approachRate: 9.2,
    });
    expect(original.circleSize).toEqual(4);
  });

  it("does not cap values at the stable limit of 10", function () {
    const actual = DifficultyAdjustMod.apply(original, {
      circleSize: 11,
      approachRate: 11,
      overallDifficulty: 11,
      drainRate: 11,
    });
    expect(actual.circleSize).toEqual(11);
    expect(actual.approachRate).toEqual(11);
    expect(actual.overallDifficulty).toEqual(11);
    expect(actual.drainRate).toEqual(11);
  });

  it("allows a negative approach rate from extended limits", function () {
    const actual = DifficultyAdjustMod.apply(original, { approachRate: -10 });
    expect(actual.approachRate).toEqual(-10);
  });

  it("returns the original difficulty when no settings are given", function () {
    expect(DifficultyAdjustMod.apply(original)).toBe(original);
  });
});
