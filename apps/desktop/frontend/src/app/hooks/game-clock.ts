import { useCallback, useState } from "react";
import { useObservable } from "rxjs-hooks";
import { useAnalysisApp } from "../providers/TheaterProvider";
import { nextPlaybackSpeed, previousPlaybackSpeed } from "../utils/constants";
import { useInterval } from "./interval";

export function useGameClock() {
  const analyzer = useAnalysisApp();
  return analyzer.gameClock;
}

export function useGameClockControls() {
  const clock = useGameClock();

  const isPlaying = useObservable(() => clock.isPlaying$, false);
  const duration = useObservable(() => clock.durationInMs$, 0);
  const speed = useObservable(() => clock.speed$, 1.0);
  const replaySpeed = useObservable(() => clock.replaySpeed$, undefined);

  const toggleClock = useCallback(() => clock.toggle(), [clock]);
  const seekTo = useCallback((timeInMs: number) => clock.seekTo(timeInMs), [clock]);

  const setSpeed = useCallback((x: number) => clock.setSpeed(x), [clock]);
  const increaseSpeed = useCallback(
    () => clock.setSpeed(nextPlaybackSpeed(clock.speed, clock.replaySpeed$.getValue())),
    [clock],
  );
  const decreaseSpeed = useCallback(
    () => clock.setSpeed(previousPlaybackSpeed(clock.speed, clock.replaySpeed$.getValue())),
    [clock],
  );

  const seekForward = useCallback((timeInMs: number) => clock.seekTo(clock.timeElapsedInMs + timeInMs), [clock]);
  const seekBackward = useCallback((timeInMs: number) => clock.seekTo(clock.timeElapsedInMs - timeInMs), [clock]);

  return {
    isPlaying,
    duration,
    speed,
    replaySpeed,
    // Actions
    setSpeed,
    increaseSpeed,
    decreaseSpeed,
    toggleClock,
    seekTo,
    seekForward,
    seekBackward,
  };
}

// 60FPS by default
export function useGameClockTime(fps = 60) {
  const gameClock = useGameClock();
  const [time, setTime] = useState(0);
  useInterval(() => {
    setTime(gameClock.timeElapsedInMs);
  }, 1000 / fps);
  return time;
}
