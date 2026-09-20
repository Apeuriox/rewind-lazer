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
import { buildOsuScoreSnapshots, countPassedOsuObjects } from "../../../utils/osu-score-snapshots";

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
  public stars$: BehaviorSubject<number | null>;
  public currentPp$: BehaviorSubject<number>;
  public judgements: HitObjectJudgement[] = [];
  public sliderEndMisses: CheckpointJudgement[] = [];
  public hits: [number, number, boolean][] = [];
  private replayLoadedAtMs?: number;
  private difficultyCalcId = 0;
  private performanceCalcId = 0;
  private beatmap?: Beatmap;
  private ppByObject: number[] = [];
  private lastPassedOsuObjects = -1;

  constructor() {
    this.replayEvents$ = new BehaviorSubject<ReplayAnalysisEvent[]>([]);
    this.difficulties$ = new BehaviorSubject<number[]>([]);
    this.replayClient$ = new BehaviorSubject<ReplayClient | null>(null);
    this.stars$ = new BehaviorSubject<number | null>(null);
    this.currentPp$ = new BehaviorSubject<number>(0);
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
    this.beatmap = beatmap;
    this.ppByObject = [];
    this.lastPassedOsuObjects = -1;
    this.stars$.next(null);
    this.currentPp$.next(0);
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
      this.syncCurrentPp();
    }
  }

  async calculateLivePerformance(rawBeatmap: string, options: CalculateOsuStrainsOptions) {
    const calcId = ++this.performanceCalcId;
    const state = this.lastState;
    const beatmap = this.beatmap;
    const client = this.getReplayClient();
    if (!state || !beatmap || !client) return;
    try {
      const snapshots = buildOsuScoreSnapshots(beatmap, state, client);
      const result = (await ipcRenderer.invoke("calculateOsuPerformanceSeries", rawBeatmap, options, snapshots)) as {
        stars?: number;
        pp?: number[];
      };
      if (calcId !== this.performanceCalcId) return;
      this.stars$.next(typeof result?.stars === "number" ? result.stars : null);
      this.ppByObject = Array.isArray(result?.pp) ? result.pp : [];
      this.lastPassedOsuObjects = -1;
      this.syncCurrentPp();
    } catch (error) {
      if (calcId !== this.performanceCalcId) return;
      console.error("Could not calculate rosu-pp performance", error);
      this.stars$.next(null);
      this.ppByObject = [];
      this.currentPp$.next(0);
    }
  }

  private syncCurrentPp() {
    if (!this.beatmap || !this.currentState) {
      this.currentPp$.next(0);
      return;
    }
    const passed = countPassedOsuObjects(this.beatmap, this.currentState.judgedObjects);
    if (passed === this.lastPassedOsuObjects) return;
    this.lastPassedOsuObjects = passed;
    this.currentPp$.next(passed > 0 ? this.ppByObject[passed - 1] ?? 0 : 0);
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

  getCurrentPp() {
    return this.currentPp$.getValue();
  }

  getStars() {
    return this.stars$.getValue();
  }

  clear() {
    this.difficultyCalcId += 1;
    this.performanceCalcId += 1;
    this.beatmap = undefined;
    this.ppByObject = [];
    this.lastPassedOsuObjects = -1;
    this.replayEvents$.next([]);
    this.difficulties$.next([]);
    this.stars$.next(null);
    this.currentPp$.next(0);
    this.replayClient$.next(null);
    this.judgements = [];
    this.sliderEndMisses = [];
    this.replayLoadedAtMs = undefined;
  }
}
