import {
  Beatmap,
  GameState,
  HitCircle,
  MainHitObjectVerdict,
  ReplayClient,
  Slider,
  SliderCheckPoint,
  Spinner,
} from "@osujs/core";

export type OsuScoreSnapshot = {
  maxCombo: number;
  n300: number;
  n100: number;
  n50: number;
  misses: number;
  osuLargeTickHits?: number;
  sliderEndHits?: number;
  legacyTotalScore?: number | null;
};

function addVerdict(
  counts: { n300: number; n100: number; n50: number; misses: number },
  verdict: MainHitObjectVerdict,
) {
  if (verdict === "GREAT") counts.n300 += 1;
  else if (verdict === "OK") counts.n100 += 1;
  else if (verdict === "MEH") counts.n50 += 1;
  else counts.misses += 1;
}

function updateCombo(
  combo: { current: number; max: number },
  kind: "HIT_CIRCLE" | "TICK" | "REPEAT" | "LAST_LEGACY_TICK" | "SPINNER" | "SLIDER",
  hit: boolean,
) {
  if (kind === "SLIDER") return combo;
  if (kind === "LAST_LEGACY_TICK") {
    const current = combo.current + (hit ? 1 : 0);
    return { current, max: Math.max(combo.max, current) };
  }
  const current = hit ? combo.current + 1 : 0;
  return { current, max: Math.max(combo.max, current) };
}

function isRosuHitObject(obj: unknown): boolean {
  if (obj instanceof HitCircle) return obj.sliderId === undefined;
  return obj instanceof Slider || obj instanceof Spinner;
}

/**
 * Count beatmap hitobjects that rosu-pp processes (circles, sliders, spinners).
 * Slider heads and checkpoints are not separate difficulty objects.
 */
export function countPassedOsuObjects(beatmap: Beatmap, judgedIds: string[]): number {
  let count = 0;
  for (const id of judgedIds) {
    if (isRosuHitObject(beatmap.getHitObject(id))) count += 1;
  }
  return count;
}

/**
 * One score state after each rosu-pp hitobject, in judgement order.
 * Lazer includes slider ticks/ends; stable does not (no live classic score yet).
 */
export function buildOsuScoreSnapshots(
  beatmap: Beatmap,
  state: GameState,
  client: ReplayClient,
): OsuScoreSnapshot[] {
  const counts = { n300: 0, n100: 0, n50: 0, misses: 0 };
  let combo = { current: 0, max: 0 };
  let ticks = 0;
  let ends = 0;
  const snapshots: OsuScoreSnapshot[] = [];
  const lazer = client === "LAZER";

  const push = () => {
    const snapshot: OsuScoreSnapshot = {
      maxCombo: combo.max,
      n300: counts.n300,
      n100: counts.n100,
      n50: counts.n50,
      misses: counts.misses,
    };
    if (lazer) {
      snapshot.osuLargeTickHits = ticks;
      snapshot.sliderEndHits = ends;
    }
    snapshots.push(snapshot);
  };

  for (const id of state.judgedObjects) {
    const obj = beatmap.getHitObject(id);
    if (obj instanceof SliderCheckPoint) {
      const hit = state.checkPointVerdict[id]?.hit ?? false;
      combo = updateCombo(combo, obj.type, hit);
      if (hit) {
        if (obj.type === "LAST_LEGACY_TICK") ends += 1;
        else ticks += 1;
      }
      continue;
    }

    if (obj instanceof HitCircle) {
      const verdict = state.hitCircleVerdict[id];
      if (!verdict) continue;
      const isHead = obj.sliderId !== undefined;
      combo = updateCombo(combo, "HIT_CIRCLE", verdict.type !== "MISS");
      if (lazer || !isHead) addVerdict(counts, verdict.type);
      if (!isHead) push();
      continue;
    }

    if (obj instanceof Slider) {
      const verdict = state.sliderVerdict[id];
      if (verdict && !lazer) addVerdict(counts, verdict);
      push();
      continue;
    }

    if (obj instanceof Spinner) {
      combo = updateCombo(combo, "SPINNER", true);
      addVerdict(counts, "GREAT");
      push();
    }
  }

  return snapshots;
}
