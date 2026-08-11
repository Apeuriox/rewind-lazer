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
import { parser, std_diff } from "ojsama";
import { Queue } from "typescript-collections";
import { max } from "simple-statistics";

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

  constructor() {
    this.replayEvents$ = new BehaviorSubject<ReplayAnalysisEvent[]>([]);
    this.difficulties$ = new BehaviorSubject<number[]>([]);
    this.replayClient$ = new BehaviorSubject<ReplayClient | null>(null);
  }

  calculateDifficulties(rawBeatmap: string, durationInMs: number, mods: number) {
    console.log(`Calculating difficulty for beatmap with duration=${durationInMs}ms and mods=${mods}`);
    const p = new parser();
    p.feed(rawBeatmap);
    const map = p.map;
    const d = new std_diff().calc({ map, mods });

    const TIME_STEP = 500;
    const q = new Queue<[number, number]>();
    let i = 0;
    let sum = 0;
    const res: number[] = [];

    // O(n + m)
    for (let t = 0; t < durationInMs; t += TIME_STEP) {
      while (i < map.objects.length) {
        const o = map.objects[i];
        if (t + TIME_STEP < o.time) {
          break;
        }
        const strainTotal = d.objects[i].strains[0] + d.objects[i].strains[1];
        q.enqueue([o.time, strainTotal]);
        sum += strainTotal;
        i++;
      }
      while (!q.isEmpty()) {
        const [time, totalStrain] = q.peek() as [number, number];
        if (time > t - TIME_STEP) {
          break;
        }
        sum -= totalStrain;
        q.dequeue();
      }
      res.push(q.isEmpty() ? 0 : sum / q.size());
    }
    if (res.length > 0) {
      // normalize
      const m = max(res);
      if (m > 0) {
        const normalizedRes = res.map((r) => r / m);
        this.difficulties$.next(normalizedRes);
      }
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
    this.replayEvents$.next([]);
    this.difficulties$.next([]);
    this.replayClient$.next(null);
    this.judgements = [];
    this.sliderEndMisses = [];
    this.replayLoadedAtMs = undefined;
  }
}
