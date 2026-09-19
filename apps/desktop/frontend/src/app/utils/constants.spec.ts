import {
  clampPlaybackSpeed,
  nextPlaybackSpeed,
  nudgePlaybackSpeed,
  playbackSpeedMarks,
  playbackSpeedOptions,
  previousPlaybackSpeed,
  snapPlaybackSpeed,
} from "./constants";

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

describe("playback speed slider marks", () => {
  it("always marks HT and DT", () => {
    expect(playbackSpeedMarks()).toEqual([
      { value: 0.75, label: "HT", placement: "below", isReplay: false },
      { value: 1.5, label: "DT", placement: "below", isReplay: false },
    ]);
  });

  it("puts a distinct replay rate above the track", () => {
    expect(playbackSpeedMarks(0.85)).toEqual([
      { value: 0.75, label: "HT", placement: "below", isReplay: false },
      { value: 0.85, label: "Replay", placement: "above", isReplay: true },
      { value: 1.5, label: "DT", placement: "below", isReplay: false },
    ]);
  });

  it("merges the replay mark when it matches HT or DT", () => {
    expect(playbackSpeedMarks(0.75)).toEqual([
      { value: 0.75, label: "HT · Replay", placement: "below", isReplay: true },
      { value: 1.5, label: "DT", placement: "below", isReplay: false },
    ]);
  });

  it("snaps values near HT, DT, or the replay rate", () => {
    const marks = playbackSpeedMarks(0.85);
    expect(snapPlaybackSpeed(0.76, marks)).toBe(0.75);
    expect(snapPlaybackSpeed(0.86, marks)).toBe(0.85);
    expect(snapPlaybackSpeed(1.49, marks)).toBe(1.5);
    expect(snapPlaybackSpeed(1.1, marks)).toBe(1.1);
  });

  it("clamps and nudges within the slider range", () => {
    expect(clampPlaybackSpeed(4)).toBe(2);
    expect(nudgePlaybackSpeed(0.75, 0.05)).toBe(0.8);
    expect(nudgePlaybackSpeed(4, -0.05)).toBe(2);
    expect(nudgePlaybackSpeed(2, 0.05)).toBe(2);
  });
});
