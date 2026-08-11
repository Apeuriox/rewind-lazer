import { FIRST_LAZER_REPLAY_VERSION, replayClientFromVersion } from "./RawReplayData";

describe("replayClientFromVersion", () => {
  it("recognises stable YYYYMMDD versions", () => {
    expect(replayClientFromVersion(20240101)).toBe("STABLE");
    expect(replayClientFromVersion(FIRST_LAZER_REPLAY_VERSION - 1)).toBe("STABLE");
  });

  it("recognises lazer's reserved replay version range", () => {
    expect(replayClientFromVersion(FIRST_LAZER_REPLAY_VERSION)).toBe("LAZER");
    expect(replayClientFromVersion(30_000_018)).toBe("LAZER");
  });
});
