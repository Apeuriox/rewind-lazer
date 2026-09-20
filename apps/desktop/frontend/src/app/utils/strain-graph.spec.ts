import { bucketAndNormalizeStrains, DIFFICULTY_GRAPH_TIME_STEP_MS } from "./strain-graph";

describe("bucketAndNormalizeStrains", () => {
  it("uses a 500ms step by default", () => {
    expect(DIFFICULTY_GRAPH_TIME_STEP_MS).toBe(500);
  });

  it("returns one normalized bucket per time step", () => {
    const times = [100, 400, 900];
    const strains = [10, 20, 30];
    const buckets = bucketAndNormalizeStrains(times, strains, 1500, 500);
    expect(buckets).toHaveLength(3);
    expect(Math.max(...buckets)).toBe(1);
    expect(buckets.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it("keeps objects in a 1s window around each bucket time", () => {
    // t=0 window (-500, 500]: objects at 100 and 400
    // t=500 window (0, 1000]: all three
    const buckets = bucketAndNormalizeStrains([100, 400, 900], [2, 2, 8], 1000, 500);
    expect(buckets[0]).toBeCloseTo(2 / 8, 8);
    expect(buckets[1]).toBe(1);
  });

  it("emits zeros for empty windows and all-zero strains", () => {
    expect(bucketAndNormalizeStrains([], [], 1000, 500)).toEqual([0, 0]);
    expect(bucketAndNormalizeStrains([100], [0], 500, 500)).toEqual([0]);
  });

  it("returns an empty series when duration is not positive", () => {
    expect(bucketAndNormalizeStrains([100], [1], 0)).toEqual([]);
    expect(bucketAndNormalizeStrains([100], [1], -1)).toEqual([]);
  });
});
