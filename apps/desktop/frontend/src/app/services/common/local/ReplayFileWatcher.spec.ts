import { newestReplayCandidate } from "./ReplayFileWatcher";

describe("newestReplayCandidate", () => {
  it("selects the newest replay across stable and lazer folders", () => {
    expect(
      newestReplayCandidate([
        { path: "C:\\osu!\\Replays\\stable.osr", modifiedAt: 1000 },
        { path: "D:\\osu-lazer\\exports\\lazer.osr", modifiedAt: 2000 },
      ]),
    ).toEqual({ path: "D:\\osu-lazer\\exports\\lazer.osr", modifiedAt: 2000 });
  });

  it("returns undefined when no replay was detected", () => {
    expect(newestReplayCandidate([])).toBeUndefined();
  });
});
