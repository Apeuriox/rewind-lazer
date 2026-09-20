import {
  Beatmap,
  BucketedGameStateTimeMachine,
  defaultGameplayInfo,
  GameplayInfo,
  GameplayInfoEvaluator,
  GameState,
  HitObjectJudgement,
  CheckpointJudgement,
  isHitObjectJudgement,
  isMissedSliderEndJudgement,
  gameStateEvaluatorOptionsForClient,
  ReplayClient,
  ReplayAnalysisEvent,
  retrieveEvents,
} from "@osujs/core";
import { injectable } from "inversify";
import type { OsuReplay } from "../../../model/OsuReplay";
import { BehaviorSubject } from "rxjs";
import { ipcRenderer } from "electron";
import { bucketAndNormalizeStrains } from "../../../utils/strain-graph";
import type { CalculateOsuStrainsOptions } from "../../../utils/rosu-pp";

@injectable()
export class GameSimulator {
  private gameplayTimeMachine?: BucketedGameStateTimeMachine;
  private gameplayEvaluator?: GameplayInfoEvaluator;
  private currentState?: GameState;
  private lastState?: GameState;
  private currentInfo: GameplayInfo = defaultGameplayInfo;
  public replayEvents$: BehaviorSubject<ReplayAnalysisEvent[]>;
  public difficulties$: BehaviorSubject<number[]>;
  public replayClient$: BehaviorSubject<ReplayClient | null>;
  public judgements: HitObjectJudgement[] = [];
  public sliderEndMisses: CheckpointJudgement[] = [];
  public hits: [number, number, boolean][] = [];
  private replayLoadedAtMs?: number;
  private difficultyCalcId = 0;

  constructor() {
    this.replayEvents$ = new BehaviorSubject<ReplayAnalysisEvent[]>([]);
    this.difficulties$ = new BehaviorSubject<number[]>([]);
    this.replayClient$ = new BehaviorSubject<ReplayClient | null>(null);
  }

  async calculateDifficulties(rawBeatmap: string, durationInMs: number, options: CalculateOsuStrainsOptions) {
    const calcId = ++this.difficultyCalcId;
    console.log(`Calculating difficulty for beatmap with duration=${durationInMs}ms`, options);
    try {
      const result = (await ipcRenderer.invoke("calculateOsuStrains", rawBeatmap, options)) as {
        times?: number[];
        strains?: number[];
      };
      if (calcId !== this.difficultyCalcId) return;
      const times = Array.isArray(result?.times) ? result.times : [];
      const strains = Array.isArray(result?.strains) ? result.strains : [];
      this.difficulties$.next(bucketAndNormalizeStrains(times, strains, durationInMs));
    } catch (error) {
      if (calcId !== this.difficultyCalcId) return;
      console.error("Could not calculate rosu-pp difficulty graph", error);
      this.difficulties$.next([]);
    }
  }

  calculateHitErrorArray() {}

  simulateReplay(beatmap: Beatmap, replay: OsuReplay) {
    this.replayClient$.next(replay.client);
    this.gameplayTimeMachine = new BucketedGameStateTimeMachine(
      replay.frames,
      beatmap,
      gameStateEvaluatorOptionsForClient(replay.client),
    );
    this.gameplayEvaluator = new GameplayInfoEvaluator(beatmap, { replayClient: replay.client });
    // TODO: Move this to async ...
    this.lastState = this.gameplayTimeMachine.gameStateAt(1e9);
    this.currentInfo = defaultGameplayInfo;
    // this.currentState = finalState...
    this.replayEvents$.next(retrieveEvents(this.lastState, beatmap.hitObjects, replay.client));
    const replayEvents = this.replayEvents$.getValue();
    this.judgements = replayEvents.filter(isHitObjectJudgement);
    this.sliderEndMisses = replay.client === "LAZER" ? replayEvents.filter(isMissedSliderEndJudgement) : [];

    this.hits = [];
    if (!this.lastState) return;

    // In order
    for (const id of this.lastState.judgedObjects) {
      const h = beatmap.getHitObject(id);
      if (h.type === "HIT_CIRCLE") {
        const s = this.lastState.hitCircleVerdict[id];
        const hitCircle = beatmap.getHitCircle(id);
        const offset = s.judgementTime - hitCircle.hitTime;
        const hit = s.type !== "MISS";
        this.hits.push([s.judgementTime, offset, hit]);
      }
    }
    // not sure if this is needed
    this.hits.sort((a, b) => a[0] - b[0]);
    this.replayLoadedAtMs = performance.now();
  }

  // Simulates the game to be at the given time
  // If a whole game simulation has happened, then this should be really fast
  simulate(gameTimeInMs: number) {
    if (this.gameplayTimeMachine && this.gameplayEvaluator) {
      this.currentState = this.gameplayTimeMachine.gameStateAt(gameTimeInMs);
      this.currentInfo = this.gameplayEvaluator.evaluateReplayState(this.currentState!);
    }
  }

  getCurrentState() {
    return this.currentState;
  }

  getCurrentInfo() {
    return this.currentInfo;
  }

  getReplayClient() {
    return this.replayClient$.getValue();
  }

  getReplayAgeMs() {
    return this.replayLoadedAtMs === undefined ? Number.POSITIVE_INFINITY : performance.now() - this.replayLoadedAtMs;
  }

  // Very likely to be a request from the UI since it wants to render the playbar events
  async calculateEvents() {
    // In case it takes unbearably long -> we might need a web worker
  }

  clear() {
    this.difficultyCalcId += 1;
    this.replayEvents$.next([]);
    this.difficulties$.next([]);
    this.replayClient$.next(null);
    this.judgements = [];
    this.sliderEndMisses = [];
    this.replayLoadedAtMs = undefined;
  }
}
