import { GameplayClock } from "./GameplayClock";

describe("GameplayClock replay speed", () => {
  it("retains the replay speed across playback speed changes and clears it with the replay", () => {
    const clock = new GameplayClock();

    clock.setReplaySpeed(0.85);
    clock.setSpeed(1);
    expect(clock.replaySpeed$.getValue()).toBe(0.85);

    clock.clear();
    expect(clock.replaySpeed$.getValue()).toBeUndefined();
  });
});
