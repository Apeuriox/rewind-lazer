import { DEFAULT_BEATMAP_DIFFICULTY } from "../beatmap/BeatmapDifficulty";
import { Beatmap } from "../beatmap/Beatmap";
import { ControlPointInfo } from "../beatmap/ControlPoints/ControlPointInfo";
import { HardRockMod } from "./HardRockMod";
import {
  difficultyHudLines,
  effectiveDifficultyValues,
  formatDifficultyStatLine,
  formatReplayModsLine,
} from "./EffectiveDifficulty";

describe("effectiveDifficultyValues", () => {
  const base = {
    ...DEFAULT_BEATMAP_DIFFICULTY,
    approachRate: 9.8,
    overallDifficulty: 9,
    circleSize: 4,
    drainRate: 5,
  };

  it("leaves values unchanged at 1x", () => {
    expect(effectiveDifficultyValues(base, 1)).toEqual({
      approachRate: 9.8,
      overallDifficulty: 9,
      circleSize: 4,
      drainRate: 5,
    });
  });

  it("raises AR and OD with DT but not CS or HP", () => {
    const actual = effectiveDifficultyValues(base, 1.5);
    expect(actual.approachRate).toBeCloseTo(10.87, 2);
    expect(actual.overallDifficulty).toBeCloseTo(10.44, 2);
    expect(actual.circleSize).toEqual(4);
    expect(actual.drainRate).toEqual(5);
  });

  it("lowers AR and OD with HT", () => {
    const actual = effectiveDifficultyValues({ ...base, approachRate: 10, overallDifficulty: 10 }, 0.75);
    expect(actual.approachRate).toBeCloseTo(9, 2);
    expect(actual.overallDifficulty).toBeCloseTo(8.89, 2);
    expect(actual.circleSize).toEqual(4);
  });
});

describe("formatDifficultyStatLine", () => {
  it("hides the original value when mods do not change it", () => {
    expect(formatDifficultyStatLine("AR", 10, 10)).toEqual({ text: "AR: 10", change: "none" });
  });

  it("marks an increase when the current value is higher", () => {
    expect(formatDifficultyStatLine("AR", 10.8666, 9.8)).toEqual({
      text: "AR: 10.87 (9.8)",
      change: "up",
    });
  });

  it("marks a decrease when the current value is lower", () => {
    expect(formatDifficultyStatLine("AR", 4, 8)).toEqual({
      text: "AR: 4 (8)",
      change: "down",
    });
  });
});

describe("formatReplayModsLine", () => {
  it("shows NM when there are no mods", () => {
    expect(formatReplayModsLine([], false)).toEqual("Mods: NM");
  });

  it("appends DA after classic mods", () => {
    expect(formatReplayModsLine(["HIDDEN", "DOUBLE_TIME"], true)).toEqual("Mods: HD DT DA");
  });
});

describe("difficultyHudLines", () => {
  it("marks HR-changed CS/AR/OD/HP and lists the mods", () => {
    const original = {
      ...DEFAULT_BEATMAP_DIFFICULTY,
      approachRate: 8,
      overallDifficulty: 8,
      circleSize: 4,
      drainRate: 9,
    };
    const difficulty = HardRockMod.difficultyAdjuster(original);
    const beatmap = new Beatmap([], difficulty, ["HARD_ROCK"], new ControlPointInfo(), 1, original);

    expect(difficultyHudLines(beatmap)).toEqual([
      { text: "AR: 10 (8)", change: "up" },
      { text: "OD: 10 (8)", change: "up" },
      { text: "CS: 5.2 (4)", change: "up" },
      { text: "HP: 10 (9)", change: "up" },
      { text: "Mods: HR", change: "none" },
    ]);
  });

  it("marks only AR and OD for Double Time", () => {
    const original = {
      ...DEFAULT_BEATMAP_DIFFICULTY,
      approachRate: 9.8,
      overallDifficulty: 9,
      circleSize: 4,
      drainRate: 6,
    };
    const beatmap = new Beatmap([], original, ["DOUBLE_TIME"], new ControlPointInfo(), 1.5, original);
    const lines = difficultyHudLines(beatmap);

    expect(lines[0]).toEqual({ text: "AR: 10.87 (9.8)", change: "up" });
    expect(lines[1].change).toBe("up");
    expect(lines[1].text).toContain("(9)");
    expect(lines[2]).toEqual({ text: "CS: 4", change: "none" });
    expect(lines[3]).toEqual({ text: "HP: 6", change: "none" });
    expect(lines[4]).toEqual({ text: "Mods: DT", change: "none" });
  });

  it("uses the DA value in parentheses when DA and rate both change AR", () => {
    const original = {
      ...DEFAULT_BEATMAP_DIFFICULTY,
      approachRate: 9,
      overallDifficulty: 8,
      circleSize: 4,
      drainRate: 6,
    };
    const difficulty = { ...original, approachRate: 9.8 };
    const beatmap = new Beatmap([], difficulty, ["DOUBLE_TIME"], new ControlPointInfo(), 1.5, original, {
      approachRate: 9.8,
    });
    const lines = difficultyHudLines(beatmap);

    expect(lines[0]).toEqual({ text: "AR: 10.87 (9.8)", change: "up" });
    expect(lines[0].text).not.toContain("(9)");
    expect(lines[1].change).toBe("up");
    expect(lines[1].text).toContain("(8)");
    expect(lines[2]).toEqual({ text: "CS: 4", change: "none" });
    expect(lines[4]).toEqual({ text: "Mods: DT DA", change: "none" });
  });

  it("compares DA-only AR against the map original", () => {
    const original = {
      ...DEFAULT_BEATMAP_DIFFICULTY,
      approachRate: 9,
      overallDifficulty: 8,
      circleSize: 4,
      drainRate: 6,
    };
    const difficulty = { ...original, approachRate: 10.3 };
    const beatmap = new Beatmap([], difficulty, [], new ControlPointInfo(), 1, original, { approachRate: 10.3 });

    expect(difficultyHudLines(beatmap)[0]).toEqual({ text: "AR: 10.3 (9)", change: "up" });
  });

  it("marks a decrease when HT lowers AR from the DA value", () => {
    const original = {
      ...DEFAULT_BEATMAP_DIFFICULTY,
      approachRate: 9,
      overallDifficulty: 8,
      circleSize: 4,
      drainRate: 6,
    };
    const difficulty = { ...original, approachRate: 10.3 };
    const beatmap = new Beatmap([], difficulty, ["HALF_TIME"], new ControlPointInfo(), 0.85, original, {
      approachRate: 10.3,
    });
    const lines = difficultyHudLines(beatmap);

    expect(lines[0].change).toBe("down");
    expect(lines[0].text).toContain("(10.3)");
    expect(lines[0].text).not.toContain("(9)");
    expect(lines[1].change).toBe("down");
    expect(lines[2]).toEqual({ text: "CS: 4", change: "none" });
    expect(lines[3]).toEqual({ text: "HP: 6", change: "none" });
    expect(lines[4]).toEqual({ text: "Mods: HT DA", change: "none" });
  });
});
