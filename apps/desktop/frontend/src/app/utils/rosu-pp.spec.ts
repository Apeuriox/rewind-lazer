import { buildRosuCalcOptions, isLazerReplayVersion, sanitizeLazerMods } from "./rosu-pp";

describe("buildRosuCalcOptions", () => {
  it("uses the classic mod bitmask for stable replay versions", () => {
    const options = buildRosuCalcOptions({
      gameVersion: 20240101,
      mods: ["HIDDEN", "HARD_ROCK"],
      client: "STABLE",
    });
    expect(options.lazer).toBe(false);
    expect(options.mods).toBe((1 << 3) | (1 << 4)); // HD | HR bitflags, not bit indices
  });

  it("passes replay DA as fixed AR/CS/OD/HP for stable bitmasks", () => {
    const options = buildRosuCalcOptions({
      gameVersion: 20240101,
      mods: ["DOUBLE_TIME"],
      client: "STABLE",
      clockRate: 1.5,
      difficultyAdjust: { approachRate: 10.3, circleSize: 4 },
    });
    expect(options.clockRate).toBe(1.5);
    expect(options.ar).toBe(10.3);
    expect(options.fixedAr).toBe(true);
    expect(options.cs).toBe(4);
    expect(options.fixedCs).toBe(true);
  });

  it("passes the lazer score-info mods array itself when version is above 30000000", () => {
    const lazerMods = [
      { acronym: "HT", settings: { speed_change: 0.8 } },
      { acronym: "DA", settings: { approach_rate: 10.3, extended_limits: true } },
      { acronym: "RX" },
    ];
    const options = buildRosuCalcOptions({
      gameVersion: 30_000_016,
      mods: ["HALF_TIME", "RELAX"],
      client: "LAZER",
      clockRate: 0.8,
      difficultyAdjust: { approachRate: 10.3 },
      lazerMods,
    });
    expect(isLazerReplayVersion(30_000_016)).toBe(true);
    expect(options.lazer).toBe(true);
    expect(options.clockRate).toBeUndefined();
    expect(options.ar).toBeUndefined();
    expect(options.mods).toEqual(lazerMods);
    expect(Array.isArray(options.mods)).toBe(true);
  });

  it("merges viewer DA into the lazer mods array without wrapping it", () => {
    const options = buildRosuCalcOptions(
      {
        gameVersion: 30_000_016,
        mods: ["HALF_TIME"],
        client: "LAZER",
        clockRate: 0.85,
        lazerMods: [
          { acronym: "HT", settings: { speed_change: 0.85 } },
          { acronym: "DA", settings: { approach_rate: 9.5, extended_limits: true } },
        ],
        difficultyAdjust: { approachRate: 9.5 },
      },
      { extendedLimits: true, approachRate: 10.3, circleSize: 5 },
    );
    expect(options.mods).toEqual([
      { acronym: "HT", settings: { speed_change: 0.85 } },
      { acronym: "DA", settings: { approach_rate: 10.3, extended_limits: true, circle_size: 5 } },
    ]);
  });

  it("omits empty settings objects from lazer mods", () => {
    expect(sanitizeLazerMods([{ acronym: "RX" }, { acronym: "HT", settings: { speed_change: 0.8 } }])).toEqual([
      { acronym: "RX" },
      { acronym: "HT", settings: { speed_change: 0.8 } },
    ]);
  });
});
