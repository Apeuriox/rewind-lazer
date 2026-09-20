import { useCallback } from "react";
import { useObservable } from "rxjs-hooks";
import { Beatmap } from "@osujs/core";
import { useAnalysisApp } from "../providers/TheaterProvider";
import { DifficultySliderDimension, ViewerDifficultyFields } from "../utils/difficulty-slider";

const EMPTY_VIEWER: ViewerDifficultyFields = { extendedLimits: false };

export function useDifficultyAdjustControls() {
  const { scenarioManager, beatmapManager } = useAnalysisApp();
  const beatmap = useObservable(() => beatmapManager.beatmap$, Beatmap.EMPTY_BEATMAP);
  const viewer = useObservable(() => scenarioManager.viewerDifficulty$, EMPTY_VIEWER);
  const setDimension = useCallback(
    (dimension: DifficultySliderDimension, value: number) => scenarioManager.setViewerDifficultyValue(dimension, value),
    [scenarioManager],
  );
  const setExtendedLimits = useCallback(
    (extended: boolean) => scenarioManager.setViewerExtendedLimits(extended),
    [scenarioManager],
  );

  return {
    beatmap,
    viewer,
    disabled: beatmap === Beatmap.EMPTY_BEATMAP,
    setDimension,
    setExtendedLimits,
  };
}
