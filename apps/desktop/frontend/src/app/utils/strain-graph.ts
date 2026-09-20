/** Playbar difficulty graph bucket size, matching the original ojsama path. */
export const DIFFICULTY_GRAPH_TIME_STEP_MS = 500;

export type StrainPointSeries = {
  times: number[];
  strains: number[];
};

/**
 * Sliding-window mean of per-object strains, then peak-normalize to 0..1.
 *
 * At time `t` the window keeps objects in `(t - timeStep, t + timeStep]`.
 * Empty windows are 0. The result length is `ceil(duration / timeStep)`.
 */
export function bucketAndNormalizeStrains(
  times: number[],
  strains: number[],
  durationInMs: number,
  timeStep = DIFFICULTY_GRAPH_TIME_STEP_MS,
): number[] {
  if (!(durationInMs > 0) || !(timeStep > 0)) return [];

  const n = Math.min(times.length, strains.length);
  const window: Array<{ time: number; strain: number }> = [];
  let i = 0;
  let sum = 0;
  const res: number[] = [];

  for (let t = 0; t < durationInMs; t += timeStep) {
    while (i < n) {
      const time = times[i];
      if (t + timeStep < time) break;
      const strain = strains[i];
      window.push({ time, strain });
      sum += strain;
      i += 1;
    }
    while (window.length > 0) {
      const head = window[0];
      if (head.time > t - timeStep) break;
      sum -= head.strain;
      window.shift();
    }
    res.push(window.length === 0 ? 0 : sum / window.length);
  }

  if (res.length === 0) return [];

  let peak = 0;
  for (const value of res) {
    if (value > peak) peak = value;
  }
  if (!(peak > 0)) return res.map(() => 0);
  return res.map((value) => value / peak);
}
