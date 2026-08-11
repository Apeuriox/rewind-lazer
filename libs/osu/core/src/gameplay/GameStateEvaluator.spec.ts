import { GameStateEvaluator, gameStateEvaluatorOptionsForClient, newPressingSince } from "./GameStateEvaluator";
import { defaultGameState, NOT_PRESSING } from "./GameState";
import { OsuAction } from "../replays/Replay";
import { Beatmap } from "../beatmap/Beatmap";
import { DEFAULT_BEATMAP_DIFFICULTY } from "../beatmap/BeatmapDifficulty";
import { ControlPointInfo } from "../beatmap/ControlPoints/ControlPointInfo";
import { HitCircle } from "../hitobjects/HitCircle";

describe("newPressingSince", function () {
  it("initial with new value at new click", function () {
    expect(newPressingSince([NOT_PRESSING, NOT_PRESSING], [OsuAction.leftButton], 10)).toEqual([10, NOT_PRESSING]);
  });
  it("keep the old value if still pressing", function () {
    expect(newPressingSince([30, NOT_PRESSING], [OsuAction.leftButton], 42)).toEqual([30, NOT_PRESSING]);
  });
  it("stay [NOT_PRESSING, NOT_PRESSING] when no action given", function () {
    expect(newPressingSince([NOT_PRESSING, NOT_PRESSING], [], -420)).toEqual([NOT_PRESSING, NOT_PRESSING]);
  });
  it("return to [NOT_PRESSING, NOT_PRESSING] when no action given", function () {
    expect(newPressingSince([320, 500], [], 600)).toEqual([NOT_PRESSING, NOT_PRESSING]);
  });
});

describe("gameStateEvaluatorOptionsForClient", () => {
  it("keeps stable hit windows and note lock", () => {
    expect(gameStateEvaluatorOptionsForClient("STABLE")).toEqual({
      hitWindowStyle: "OSU_STABLE",
      noteLockStyle: "STABLE",
    });
  });

  it("uses lazer hit windows without note lock", () => {
    expect(gameStateEvaluatorOptionsForClient("LAZER")).toEqual({
      hitWindowStyle: "OSU_LAZER",
      noteLockStyle: "NONE",
    });
  });
});

describe("client note-lock behaviour", () => {
  function overlappingObjectsBeatmap(): Beatmap {
    const first = new HitCircle();
    first.id = "first";
    first.hitTime = 1_000;
    first.approachDuration = 500;
    first.position = { x: 0, y: 0 };

    const second = new HitCircle();
    second.id = "second";
    second.hitTime = 1_050;
    second.approachDuration = 500;
    second.position = { x: 200, y: 0 };

    return new Beatmap([first, second], DEFAULT_BEATMAP_DIFFICULTY, [], new ControlPointInfo());
  }

  it("stable locks a later object behind an earlier unjudged object", () => {
    const evaluator = new GameStateEvaluator(overlappingObjectsBeatmap(), gameStateEvaluatorOptionsForClient("STABLE"));
    const state = defaultGameState();

    evaluator.evaluate(state, {
      time: 1_050,
      position: { x: 200, y: 0 },
      actions: [OsuAction.leftButton],
    });

    expect(state.hitCircleVerdict.second).toBeUndefined();
  });

  it("lazer can hit a later object without judging the earlier object", () => {
    const evaluator = new GameStateEvaluator(overlappingObjectsBeatmap(), gameStateEvaluatorOptionsForClient("LAZER"));
    const state = defaultGameState();

    evaluator.evaluate(state, {
      time: 1_050,
      position: { x: 200, y: 0 },
      actions: [OsuAction.leftButton],
    });

    expect(state.hitCircleVerdict.first).toBeUndefined();
    expect(state.hitCircleVerdict.second?.type).toBe("GREAT");
  });
});

describe("client hit-window behaviour", () => {
  function singleCircleBeatmap(): Beatmap {
    const circle = new HitCircle();
    circle.id = "circle";
    circle.hitTime = 1_000;
    circle.approachDuration = 500;
    circle.position = { x: 0, y: 0 };

    return new Beatmap([circle], DEFAULT_BEATMAP_DIFFICULTY, [], new ControlPointInfo());
  }

  it("includes lazer's outer hit-window boundary", () => {
    const stableEvaluator = new GameStateEvaluator(singleCircleBeatmap(), gameStateEvaluatorOptionsForClient("STABLE"));
    const stableState = defaultGameState();
    stableEvaluator.evaluate(stableState, {
      time: 1_150,
      position: { x: 0, y: 0 },
      actions: [OsuAction.leftButton],
    });

    const lazerEvaluator = new GameStateEvaluator(singleCircleBeatmap(), gameStateEvaluatorOptionsForClient("LAZER"));
    const lazerState = defaultGameState();
    lazerEvaluator.evaluate(lazerState, {
      time: 1_150,
      position: { x: 0, y: 0 },
      actions: [OsuAction.leftButton],
    });

    expect(stableState.hitCircleVerdict.circle.type).toBe("MISS");
    expect(lazerState.hitCircleVerdict.circle.type).toBe("MEH");
  });
});
