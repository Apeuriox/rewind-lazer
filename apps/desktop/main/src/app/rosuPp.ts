import { existsSync } from "fs";
import { join } from "path";

export type RosuApiMod = { acronym: string; settings?: Record<string, unknown> };

export type CalculateOsuStrainsOptions = {
  mods?: number | string | RosuApiMod[];
  clockRate?: number;
  ar?: number;
  cs?: number;
  od?: number;
  hp?: number;
  fixedAr?: boolean;
  fixedCs?: boolean;
  fixedOd?: boolean;
  fixedHp?: boolean;
  lazer?: boolean;
};

export type OsuStrainObjects = {
  times: number[];
  strains: number[];
};

type RosuPpJs = {
  Beatmap: new (args: string | Uint8Array) => {
    free(): void;
    readonly hitObjectTimes: Float64Array;
  };
  Difficulty: new (args?: Record<string, unknown>) => {
    strains(map: unknown): {
      free(): void;
      readonly aim?: Float64Array;
      readonly speed?: Float64Array;
      readonly reading?: Float64Array;
      readonly flashlight?: Float64Array;
    };
  };
};

let rosuPp: RosuPpJs | undefined;

function resolveRosuPpJs(): string {
  const candidates = [
    join(__dirname, "assets", "rosu-pp-js", "rosu_pp_js.js"),
    join(__dirname, "..", "src", "assets", "rosu-pp-js", "rosu_pp_js.js"),
    join(process.cwd(), "apps", "desktop", "main", "src", "assets", "rosu-pp-js", "rosu_pp_js.js"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`rosu-pp-js not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

function loadRosuPp(): RosuPpJs {
  if (!rosuPp) {
    // Keep the wasm module out of the webpack bundle; it must load next to its .wasm file.
    const nodeRequire = eval("require") as NodeRequire;
    rosuPp = nodeRequire(resolveRosuPpJs()) as RosuPpJs;
  }
  return rosuPp;
}

function seriesAt(series: ArrayLike<number> | undefined, index: number): number {
  if (!series || index >= series.length) return 0;
  const value = series[index];
  return Number.isFinite(value) ? value : 0;
}

export function combineOsuObjectStrains(
  hitObjectTimes: ArrayLike<number>,
  aim?: ArrayLike<number>,
  speed?: ArrayLike<number>,
  reading?: ArrayLike<number>,
  flashlight?: ArrayLike<number>,
): OsuStrainObjects {
  // Difficulty objects skip the first hitobject.
  const objectCount = Math.max(0, hitObjectTimes.length - 1);
  const perObjectCount = Math.min(
    objectCount,
    aim?.length ?? objectCount,
    speed?.length ?? objectCount,
    reading?.length ?? objectCount,
  );
  const includeFlashlight = flashlight !== undefined && flashlight.length === perObjectCount;
  const times: number[] = [];
  const strains: number[] = [];
  for (let i = 0; i < perObjectCount; i++) {
    times.push(hitObjectTimes[i + 1]);
    strains.push(
      seriesAt(aim, i) +
        seriesAt(speed, i) +
        seriesAt(reading, i) +
        (includeFlashlight ? seriesAt(flashlight, i) : 0),
    );
  }
  return { times, strains };
}

export function calculateOsuStrainObjects(rawBeatmap: string, options: CalculateOsuStrainsOptions = {}): OsuStrainObjects {
  const { Beatmap, Difficulty } = loadRosuPp();
  const map = new Beatmap(rawBeatmap);
  try {
    const difficultyArgs: Record<string, unknown> = {};
    if (options.mods !== undefined) difficultyArgs.mods = options.mods;
    if (options.clockRate !== undefined) difficultyArgs.clockRate = options.clockRate;
    if (options.ar !== undefined) difficultyArgs.ar = options.ar;
    if (options.cs !== undefined) difficultyArgs.cs = options.cs;
    if (options.od !== undefined) difficultyArgs.od = options.od;
    if (options.hp !== undefined) difficultyArgs.hp = options.hp;
    if (options.fixedAr !== undefined) difficultyArgs.fixedAr = options.fixedAr;
    if (options.fixedCs !== undefined) difficultyArgs.fixedCs = options.fixedCs;
    if (options.fixedOd !== undefined) difficultyArgs.fixedOd = options.fixedOd;
    if (options.fixedHp !== undefined) difficultyArgs.fixedHp = options.fixedHp;
    if (options.lazer !== undefined) difficultyArgs.lazer = options.lazer;
    const difficulty = new Difficulty(difficultyArgs);
    const strains = difficulty.strains(map);
    try {
      return combineOsuObjectStrains(
        map.hitObjectTimes,
        strains.aim,
        strains.speed,
        strains.reading,
        strains.flashlight,
      );
    } finally {
      strains.free();
    }
  } finally {
    map.free();
  }
}
