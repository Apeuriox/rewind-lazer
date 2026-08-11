import { nextPlaybackSpeed, playbackSpeedOptions, previousPlaybackSpeed } from "./constants";

describe("custom replay playback speeds", () => {
  it("keeps the replay speed available after switching to a standard speed", () => {
    expect(playbackSpeedOptions(1, 0.85)).toEqual([0.25, 0.75, 0.85, 1, 1.5, 2, 4]);
  });

  it("steps through the replay speed in both directions", () => {
    expect(nextPlaybackSpeed(0.75, 0.85)).toBe(0.85);
    expect(nextPlaybackSpeed(0.85, 0.85)).toBe(1);
    expect(previousPlaybackSpeed(1, 0.85)).toBe(0.85);
    expect(previousPlaybackSpeed(0.85, 0.85)).toBe(0.75);
  });
});
