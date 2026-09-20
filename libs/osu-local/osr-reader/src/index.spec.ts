import { readFileSync } from "fs";
import { resolve } from "path";
import { clockRateFromScoreInfo, difficultyAdjustFromScoreInfo, parseLazerScoreInfo, readExtendedReplay } from "./index";

const replayFixture = resolve(
  __dirname,
  "../../../../tests/replay/Guest playing Geri Halliwell - It's Raining Men (-NeBu-) [Leave Those Umbrellas At Home 1.1x (150bpm) AR10 OD10] (2025-09-07_00-20).osr",
);

describe("lazer replay score information", () => {
  it("reads the custom clock rate from the real lazer replay fixture", async () => {
    const replay = await readExtendedReplay(replayFixture);

    expect(replay.gameVersion).toBe(30_000_016);
    expect(replay.mods).toBe(384);
    expect(replay.clockRate).toBe(0.85);
    expect(replay.difficultyAdjust).toEqual({ approachRate: 10.3 });
    expect(replay.lazerMods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acronym: "HT",
          settings: expect.objectContaining({ speed_change: 0.85 }),
        }),
        expect.objectContaining({
          acronym: "DA",
          settings: expect.objectContaining({ approach_rate: 10.3 }),
        }),
      ]),
    );
    expect(replay.lazerScoreInfo?.mods).toEqual(replay.lazerMods);
  });

  it("does not attempt to read appended data from a stable replay version", async () => {
    const stableHeader = Buffer.alloc(5);
    stableHeader.writeInt32LE(20_220_101, 1);

    await expect(parseLazerScoreInfo(stableHeader)).resolves.toBeUndefined();
  });

  it("ignores invalid clock rates", () => {
    expect(clockRateFromScoreInfo({ mods: [{ acronym: "HT", settings: { speed_change: 0 } }] })).toBeUndefined();
  });

  it("parses score information directly from the replay bytes", async () => {
    const scoreInfo = await parseLazerScoreInfo(readFileSync(replayFixture));

    expect(scoreInfo?.client_version).toBe("2025.816.0-lazer");
  });

  it("reads Difficulty Adjust overrides including values above 10", () => {
    expect(
      difficultyAdjustFromScoreInfo({
        mods: [
          {
            acronym: "DA",
            settings: {
              circle_size: 11,
              approach_rate: -4,
              overall_difficulty: 10.5,
              drain_rate: 6,
              extended_limits: true,
            },
          },
        ],
      }),
    ).toEqual({
      circleSize: 11,
      approachRate: -4,
      overallDifficulty: 10.5,
      drainRate: 6,
    });
  });

  it("keeps unspecified Difficulty Adjust fields unset", () => {
    expect(
      difficultyAdjustFromScoreInfo({
        mods: [{ acronym: "DA", settings: { circle_size: 3.5 } }],
      }),
    ).toEqual({ circleSize: 3.5 });
  });

  it("treats zero as a valid Difficulty Adjust override", () => {
    expect(
      difficultyAdjustFromScoreInfo({
        mods: [{ acronym: "DA", settings: { circle_size: 0, drain_rate: 0 } }],
      }),
    ).toEqual({ circleSize: 0, drainRate: 0 });
  });

  it("ignores Difficulty Adjust settings that are not finite numbers", () => {
    expect(
      difficultyAdjustFromScoreInfo({
        mods: [{ acronym: "DA", settings: { circle_size: Number.NaN, approach_rate: Infinity } }],
      }),
    ).toBeUndefined();
  });

  it("returns nothing when Difficulty Adjust is not present", () => {
    expect(difficultyAdjustFromScoreInfo({ mods: [{ acronym: "HT", settings: { speed_change: 0.85 } }] })).toBeUndefined();
  });
});
