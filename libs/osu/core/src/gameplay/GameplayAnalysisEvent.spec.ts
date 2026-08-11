import { HitCircle } from "../hitobjects/HitCircle";
import { Slider } from "../hitobjects/Slider";
import { SliderCheckPoint } from "../hitobjects/SliderCheckPoint";
import { defaultGameState } from "./GameState";
import { retrieveEvents } from "./GameplayAnalysisEvent";

describe("retrieveEvents", () => {
  it("does not emit an aggregate slider judgement for lazer replays", () => {
    const head = new HitCircle();
    head.id = "0/HEAD";
    head.sliderId = "0";

    const slider = new Slider(head);
    slider.id = "0";
    const end = new SliderCheckPoint(slider);
    end.id = "0/END";
    end.type = "LAST_LEGACY_TICK";
    slider.checkPoints.push(end);

    const state = defaultGameState();
    state.hitCircleVerdict[head.id] = {
      type: "MISS",
      judgementTime: 0,
      missReason: "TIME_EXPIRED",
    };
    state.sliderVerdict[slider.id] = "OK";
    state.checkPointVerdict[end.id] = { hit: true };

    const events = retrieveEvents(state, [slider], "LAZER");
    const stableEvents = retrieveEvents(state, [slider]);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "HitObjectJudgement",
        hitObjectId: head.id,
        verdict: "MISS",
        isSliderHead: true,
      }),
    );
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "HitObjectJudgement",
        hitObjectId: slider.id,
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "CheckpointJudgement",
        hit: true,
        isLastTick: true,
      }),
    );
    expect(stableEvents).toContainEqual(
      expect.objectContaining({
        type: "HitObjectJudgement",
        hitObjectId: slider.id,
        verdict: "OK",
      }),
    );
  });
});
