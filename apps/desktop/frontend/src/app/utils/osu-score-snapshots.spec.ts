import {
  Beatmap,
  ControlPointInfo,
  DEFAULT_BEATMAP_DIFFICULTY,
  defaultGameState,
  HitCircle,
  Slider,
  SliderCheckPoint,
} from "@osujs/core";
import { buildOsuScoreSnapshots, countPassedOsuObjects } from "./osu-score-snapshots";

function beatmapWithSlider() {
  const head = new HitCircle();
  head.id = "0/HEAD";
  head.sliderId = "0";
  const slider = new Slider(head);
  slider.id = "0";
  return { beatmap: new Beatmap([slider], DEFAULT_BEATMAP_DIFFICULTY, [], new ControlPointInfo()), slider };
}

describe("osu score snapshots", () => {
  it("counts a slider as one rosu object after the body is judged", () => {
    const { beatmap, slider } = beatmapWithSlider();
    const state = defaultGameState();
    state.hitCircleVerdict[slider.head.id] = { judgementTime: 0, type: "OK" };
    state.sliderVerdict[slider.id] = "GREAT";
    state.judgedObjects.push(slider.head.id, slider.id);

    expect(countPassedOsuObjects(beatmap, state.judgedObjects)).toBe(1);
    expect(countPassedOsuObjects(beatmap, [slider.head.id])).toBe(0);
  });

  it("uses the slider head timing for lazer n300/n100 and includes ticks/ends", () => {
    const { slider } = beatmapWithSlider();
    const tick = new SliderCheckPoint(slider);
    tick.id = "0/TICK";
    tick.type = "TICK";
    const end = new SliderCheckPoint(slider);
    end.id = "0/END";
    end.type = "LAST_LEGACY_TICK";
    slider.checkPoints.push(tick, end);
    const beatmap = new Beatmap([slider], DEFAULT_BEATMAP_DIFFICULTY, [], new ControlPointInfo());

    const state = defaultGameState();
    state.hitCircleVerdict[slider.head.id] = { judgementTime: 0, type: "OK" };
    state.checkPointVerdict[tick.id] = { hit: true };
    state.checkPointVerdict[end.id] = { hit: true };
    state.sliderVerdict[slider.id] = "GREAT";
    state.judgedObjects.push(slider.head.id, tick.id, end.id, slider.id);

    expect(buildOsuScoreSnapshots(beatmap, state, "LAZER")).toEqual([
      {
        maxCombo: 3,
        n300: 0,
        n100: 1,
        n50: 0,
        misses: 0,
        osuLargeTickHits: 1,
        sliderEndHits: 1,
      },
    ]);
  });

  it("uses the slider body verdict for stable and omits ticks", () => {
    const { beatmap, slider } = beatmapWithSlider();
    const state = defaultGameState();
    state.hitCircleVerdict[slider.head.id] = { judgementTime: 0, type: "OK" };
    state.sliderVerdict[slider.id] = "GREAT";
    state.judgedObjects.push(slider.head.id, slider.id);

    expect(buildOsuScoreSnapshots(beatmap, state, "STABLE")).toEqual([
      { maxCombo: 1, n300: 1, n100: 0, n50: 0, misses: 0 },
    ]);
  });
});
