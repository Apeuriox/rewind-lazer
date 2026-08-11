/**
 * Shows the statistics
 */

import { GameState } from "./GameState";
import { HitObjectType, SliderCheckPointType } from "../hitobjects/Types";
import { MainHitObjectVerdict } from "./Verdicts";
import { Beatmap } from "../beatmap/Beatmap";
import { HitCircle } from "../hitobjects/HitCircle";
import { Slider } from "../hitobjects/Slider";
import { SliderCheckPoint } from "../hitobjects/SliderCheckPoint";
import { ReplayClient } from "../replays/RawReplayData";

export interface GameplayInfo {
  accuracy: number;
  // osu!stable: 300, 100, 50, 0
  // osu!lazer exposes main judgement counts here; slider ticks and ends are tracked separately below.
  verdictCounts: number[];
  score: number;
  currentCombo: number;
  maxComboSoFar: number;
  sliderTickHits: number;
  sliderEndHits: number;
}

/** COMBO **/

interface ReplayComboInformation {
  currentCombo: number;
  maxComboSoFar: number;
}

type ReplayJudgementCounts = number[];

function updateComboInfo(combo: ReplayComboInformation, type: HitObjectType | SliderCheckPointType, hit: boolean) {
  let currentCombo = combo.currentCombo;
  switch (type) {
    case "HIT_CIRCLE":
    case "TICK":
    case "REPEAT":
    case "SPINNER":
      currentCombo = hit ? currentCombo + 1 : 0;
      break;

    case "LAST_LEGACY_TICK":
      // Slider ends do not break the combo, but they can increase them
      currentCombo += hit ? 1 : 0;
      break;

    case "SLIDER":
      // For sliders there is no combo update
      break;
  }

  return { currentCombo, maxComboSoFar: Math.max(combo.maxComboSoFar, currentCombo) };
}

/** ACC **/

const MAIN_JUDGEMENT_SCORES = [300, 100, 50, 0] as const;
const MAIN_JUDGEMENT_SCORE_BY_VERDICT: Record<MainHitObjectVerdict, number> = {
  GREAT: 300,
  OK: 100,
  MEH: 50,
  MISS: 0,
};
const LAZER_SLIDER_TICK_SCORE = 30;
const LAZER_SLIDER_END_SCORE = 150;

function mainJudgementAccuracyScore(count: number[]) {
  if (count.length !== MAIN_JUDGEMENT_SCORES.length) return undefined;

  let actual = 0;
  let maximum = 0;
  for (let i = 0; i < count.length; i++) {
    actual += MAIN_JUDGEMENT_SCORES[i] * count[i];
    maximum += MAIN_JUDGEMENT_SCORES[0] * count[i];
  }

  return { actual, maximum };
}

/**
 * Returns a number between 0 and 1 using osu!stable accuracy logic.
 * Also returns undefined if there is no count
 *
 * @param count counts of 300, 100, 50, 0 (in this order)
 */
export function osuStableAccuracy(count: number[]): number | undefined {
  const score = mainJudgementAccuracyScore(count);
  if (!score || score.maximum === 0) return undefined;

  return score.actual / score.maximum;
}

export function osuLazerAccuracy(currentBaseScore: number, currentMaximumBaseScore: number): number | undefined {
  if (currentMaximumBaseScore === 0) return undefined;
  return currentBaseScore / currentMaximumBaseScore;
}

/** SCORE **/

interface EvaluationOption {
  scoringSystem: "ScoreV1" | "ScoreV2";
  replayClient: ReplayClient;
  // maybe beatmap difficulty -> since they are required for score v1 calc
}

//https://osu.ppy.sh/wiki/en/Score/ScoreV1

const defaultEvaluationOptions = {
  scoringSystem: "ScoreV1",
  replayClient: "STABLE",
} as EvaluationOption;

type StableVerdictCount = Record<MainHitObjectVerdict, number>;

export const defaultGameplayInfo: GameplayInfo = Object.freeze({
  currentCombo: 0,
  maxComboSoFar: 0,
  verdictCounts: [0, 0, 0, 0],
  sliderTickHits: 0,
  sliderEndHits: 0,
  accuracy: 0,
  score: 0,
});

/**
 * Calculating: Count, Accuracy, Combo, MaxCombo
 * The one who is calling this has to make sure that slider heads are not considered in case they are using osu!stable
 * calculation.
 */
export class GameplayInfoEvaluator {
  options: EvaluationOption;
  judgedObjectsIndex: number;
  comboInfo: ReplayComboInformation;
  verdictCount: StableVerdictCount;
  sliderTickHits: number;
  sliderEndHits: number;
  lazerCurrentBaseScore: number;
  lazerCurrentMaximumBaseScore: number;

  constructor(private beatmap: Beatmap, options?: Partial<EvaluationOption>) {
    this.options = { ...defaultEvaluationOptions, ...options };
    this.comboInfo = { maxComboSoFar: 0, currentCombo: 0 };
    this.verdictCount = { MISS: 0, MEH: 0, GREAT: 0, OK: 0 };
    this.sliderTickHits = 0;
    this.sliderEndHits = 0;
    this.lazerCurrentBaseScore = 0;
    this.lazerCurrentMaximumBaseScore = 0;
    this.judgedObjectsIndex = 0;
    // TODO: Do some initialization for calculating ScoreV2 (like max score)
  }

  evaluateHitObject(hitObjectType: HitObjectType, verdict: MainHitObjectVerdict, isSliderHead?: boolean) {
    this.comboInfo = updateComboInfo(this.comboInfo, hitObjectType, verdict !== "MISS");
    const affectsAccuracy = this.options.replayClient === "LAZER" ? hitObjectType !== "SLIDER" : !isSliderHead;
    if (affectsAccuracy) {
      this.verdictCount[verdict] += 1;

      if (this.options.replayClient === "LAZER") {
        // Mirrors ScoreProcessor.ApplyResultInternal(): the judgement's MaxResult
        // contributes to the denominator and its actual result contributes to the numerator.
        this.lazerCurrentMaximumBaseScore += MAIN_JUDGEMENT_SCORE_BY_VERDICT.GREAT;
        this.lazerCurrentBaseScore += MAIN_JUDGEMENT_SCORE_BY_VERDICT[verdict];
      }
    }
  }

  evaluateSliderCheckpoint(hitObjectType: SliderCheckPointType, hit: boolean) {
    this.comboInfo = updateComboInfo(this.comboInfo, hitObjectType, hit);

    if (this.options.replayClient === "LAZER") {
      const checkpointScore =
        hitObjectType === "LAST_LEGACY_TICK" ? LAZER_SLIDER_END_SCORE : LAZER_SLIDER_TICK_SCORE;
      this.lazerCurrentMaximumBaseScore += checkpointScore;
      if (hit) this.lazerCurrentBaseScore += checkpointScore;
    }

    if (!hit) return;

    if (hitObjectType === "LAST_LEGACY_TICK") {
      this.sliderEndHits += 1;
    } else {
      this.sliderTickHits += 1;
    }
  }

  countAsArray() {
    return (["GREAT", "OK", "MEH", "MISS"] as const).map((v) => this.verdictCount[v]);
  }

  evaluateReplayState(replayState: GameState): GameplayInfo {
    // Assume something like seeking backwards happened at reevaluate
    if (this.judgedObjectsIndex >= replayState.judgedObjects.length + 1) {
      this.comboInfo = { maxComboSoFar: 0, currentCombo: 0 };
      this.verdictCount = { MISS: 0, MEH: 0, GREAT: 0, OK: 0 };
      this.sliderTickHits = 0;
      this.sliderEndHits = 0;
      this.lazerCurrentBaseScore = 0;
      this.lazerCurrentMaximumBaseScore = 0;
      this.judgedObjectsIndex = 0;
    }

    while (this.judgedObjectsIndex < replayState.judgedObjects.length) {
      const id = replayState.judgedObjects[this.judgedObjectsIndex++];
      const hitObject = this.beatmap.getHitObject(id);
      if (hitObject instanceof SliderCheckPoint) {
        const hit = replayState.checkPointVerdict[hitObject.id].hit;
        this.evaluateSliderCheckpoint(hitObject.type, hit);
      } else if (hitObject instanceof HitCircle) {
        const verdict = replayState.hitCircleVerdict[id].type;
        const isSliderHead = hitObject.sliderId !== undefined;
        this.evaluateHitObject(hitObject.type, verdict, isSliderHead);
      } else if (hitObject instanceof Slider) {
        const verdict = replayState.sliderVerdict[hitObject.id];
        this.evaluateHitObject(hitObject.type, verdict);
      } else {
        // Spinner
        // TODO: We just going to assume that they hit it
        this.evaluateHitObject("SPINNER", "GREAT");
      }
    }

    const counts = this.countAsArray();
    const accuracy =
      this.options.replayClient === "LAZER"
        ? osuLazerAccuracy(this.lazerCurrentBaseScore, this.lazerCurrentMaximumBaseScore)
        : osuStableAccuracy(counts);
    return {
      score: 0,
      verdictCounts: counts,
      accuracy: accuracy ?? 1.0,
      currentCombo: this.comboInfo.currentCombo,
      maxComboSoFar: this.comboInfo.maxComboSoFar,
      sliderTickHits: this.sliderTickHits,
      sliderEndHits: this.sliderEndHits,
    };
  }
}
