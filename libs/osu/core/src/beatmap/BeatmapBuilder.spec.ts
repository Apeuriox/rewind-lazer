import { parseBlueprint } from "../blueprint/BlueprintParser";
import { Slider } from "../hitobjects/Slider";
import { defaultGameState } from "../gameplay/GameState";
import { GameStateEvaluator, gameStateEvaluatorOptionsForClient } from "../gameplay/GameStateEvaluator";
import { OsuAction } from "../replays/Replay";
import { buildBeatmap } from "./BeatmapBuilder";

const sliderBlueprint = parseBlueprint(`osu file format v14
[General]
AudioFilename: audio.mp3
Mode: 0

[Metadata]
Title:Test
Artist:Test
Creator:Test
Version:Test

[Difficulty]
HPDrainRate:5
CircleSize:4
OverallDifficulty:5
ApproachRate:5
SliderMultiplier:1.4
SliderTickRate:1

[HitObjects]
256,192,1000,2,0,L|356:192,1,100

[TimingPoints]
0,500,4,2,1,100,1,0
`);

function sliderForClient(replayClient: "STABLE" | "LAZER") {
  return buildBeatmap(sliderBlueprint, { replayClient }).hitObjects[0] as Slider;
}

function beatmapForClient(replayClient: "STABLE" | "LAZER") {
  return buildBeatmap(sliderBlueprint, { replayClient });
}

describe("buildBeatmap slider end checkpoints", () => {
  it("preserves stable's legacy last-tick offset", () => {
    const slider = sliderForClient("STABLE");
    const end = slider.checkPoints[slider.checkPoints.length - 1];

    expect(end.type).toBe("LAST_LEGACY_TICK");
    expect(end.hitTime).toBeCloseTo(slider.endTime - 36);
  });

  it("judges lazer slider ends at the actual tail time", () => {
    const slider = sliderForClient("LAZER");
    const end = slider.checkPoints[slider.checkPoints.length - 1];

    expect(end.type).toBe("LAST_LEGACY_TICK");
    expect(end.hitTime).toBeCloseTo(slider.endTime);
    expect(end.position).toEqual(slider.endPosition);
  });

  it("evaluates a lazer tail checkpoint before clearing the slider body state", () => {
    const beatmap = beatmapForClient("LAZER");
    const slider = beatmap.hitObjects[0] as Slider;
    const end = slider.checkPoints[slider.checkPoints.length - 1];
    // Real maps can produce this tiny positive drift through repeated floating-point division/multiplication.
    end.hitTime = slider.endTime + 1e-10;
    const state = defaultGameState();
    const evaluator = new GameStateEvaluator(beatmap, gameStateEvaluatorOptionsForClient("LAZER"));

    evaluator.evaluate(state, {
      time: slider.startTime,
      position: slider.startPosition,
      actions: [OsuAction.leftButton],
    });
    evaluator.evaluate(state, {
      time: slider.startTime + 1,
      position: slider.startPosition,
      actions: [OsuAction.leftButton],
    });

    expect(() =>
      evaluator.evaluate(state, {
        time: slider.endTime + 1,
        position: slider.endPosition,
        actions: [OsuAction.leftButton],
      }),
    ).not.toThrow();
    expect(state.checkPointVerdict[end.id]).toEqual({ hit: true });
  });

  it("keeps a lazer tail hit after tracking during the final 36ms", () => {
    const beatmap = beatmapForClient("LAZER");
    const slider = beatmap.hitObjects[0] as Slider;
    const end = slider.checkPoints[slider.checkPoints.length - 1];
    const state = defaultGameState();
    const evaluator = new GameStateEvaluator(beatmap, gameStateEvaluatorOptionsForClient("LAZER"));

    evaluator.evaluate(state, {
      time: slider.startTime,
      position: slider.startPosition,
      actions: [OsuAction.leftButton],
    });
    evaluator.evaluate(state, {
      time: slider.endTime - 30,
      position: slider.ballPositionAt((slider.duration - 30) / slider.duration),
      actions: [OsuAction.leftButton],
    });
    evaluator.evaluate(state, {
      time: slider.endTime + 1,
      position: { x: 10_000, y: 10_000 },
      actions: [],
    });

    expect(state.checkPointVerdict[end.id]).toEqual({ hit: true });
  });

  it("misses a lazer tail when tracking stopped before the final 36ms", () => {
    const beatmap = beatmapForClient("LAZER");
    const slider = beatmap.hitObjects[0] as Slider;
    const end = slider.checkPoints[slider.checkPoints.length - 1];
    const state = defaultGameState();
    const evaluator = new GameStateEvaluator(beatmap, gameStateEvaluatorOptionsForClient("LAZER"));

    evaluator.evaluate(state, {
      time: slider.startTime,
      position: slider.startPosition,
      actions: [OsuAction.leftButton],
    });
    evaluator.evaluate(state, {
      time: slider.endTime - 40,
      position: slider.ballPositionAt((slider.duration - 40) / slider.duration),
      actions: [OsuAction.leftButton],
    });
    evaluator.evaluate(state, {
      time: slider.endTime + 1,
      position: { x: 10_000, y: 10_000 },
      actions: [OsuAction.leftButton],
    });

    expect(state.checkPointVerdict[end.id]).toEqual({ hit: false });
  });
});
