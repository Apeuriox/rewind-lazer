import { Beatmap } from "../beatmap/Beatmap";
import { DEFAULT_BEATMAP_DIFFICULTY } from "../beatmap/BeatmapDifficulty";
import { ControlPointInfo } from "../beatmap/ControlPoints/ControlPointInfo";
import { HitCircle } from "../hitobjects/HitCircle";
import { Slider } from "../hitobjects/Slider";
import { defaultGameState } from "./GameState";
import { GameplayInfoEvaluator } from "./GameplayInfo";

function beatmapWithSlider(): { beatmap: Beatmap; slider: Slider } {
  const head = new HitCircle();
  head.id = "0/HEAD";
  head.sliderId = "0";

  const slider = new Slider(head);
  slider.id = "0";

  return {
    beatmap: new Beatmap([slider], DEFAULT_BEATMAP_DIFFICULTY, [], new ControlPointInfo()),
    slider,
  };
}

describe("GameplayInfoEvaluator slider-head accuracy", () => {
  it("uses the slider's final verdict for stable accuracy", () => {
    const { beatmap, slider } = beatmapWithSlider();
    const state = defaultGameState();
    state.hitCircleVerdict[slider.head.id] = { judgementTime: 0, type: "OK" };
    state.sliderVerdict[slider.id] = "GREAT";
    state.judgedObjects.push(slider.head.id, slider.id);

    const result = new GameplayInfoEvaluator(beatmap, { replayClient: "STABLE" }).evaluateReplayState(state);

    expect(result.verdictCounts).toEqual([1, 0, 0, 0]);
    expect(result.accuracy).toBe(1);
  });

  it("uses the slider head's timing verdict for lazer accuracy", () => {
    const { beatmap, slider } = beatmapWithSlider();
    const state = defaultGameState();
    state.hitCircleVerdict[slider.head.id] = { judgementTime: 0, type: "OK" };
    state.sliderVerdict[slider.id] = "GREAT";
    state.judgedObjects.push(slider.head.id, slider.id);

    const result = new GameplayInfoEvaluator(beatmap, { replayClient: "LAZER" }).evaluateReplayState(state);

    expect(result.verdictCounts).toEqual([0, 1, 0, 0]);
    expect(result.accuracy).toBeCloseTo(1 / 3);
  });
});
