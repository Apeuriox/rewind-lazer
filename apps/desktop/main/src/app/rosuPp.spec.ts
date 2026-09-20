import { combineOsuObjectStrains } from "./rosuPp";

describe("combineOsuObjectStrains", () => {
  it("skips the first hitobject and sums aim, speed, and reading", () => {
    const result = combineOsuObjectStrains(
      [0, 100, 250],
      [1, 2],
      [3, 4],
      [5, 6],
    );
    expect(result).toEqual({
      times: [100, 250],
      strains: [9, 12],
    });
  });

  it("adds flashlight only when it is per-object", () => {
    const withFl = combineOsuObjectStrains([0, 10], [1], [1], [1], [2]);
    expect(withFl.strains).toEqual([5]);
    const sectionFl = combineOsuObjectStrains([0, 10], [1], [1], [1], [2, 2, 2]);
    expect(sectionFl.strains).toEqual([3]);
  });
});
