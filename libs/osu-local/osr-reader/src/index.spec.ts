import { readFileSync } from "fs";
import { resolve } from "path";
import { clockRateFromScoreInfo, parseLazerScoreInfo, readExtendedReplay } from "./index";

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
    expect(replay.lazerScoreInfo?.mods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          acronym: "HT",
          settings: expect.objectContaining({ speed_change: 0.85 }),
        }),
      ]),
    );
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
});
