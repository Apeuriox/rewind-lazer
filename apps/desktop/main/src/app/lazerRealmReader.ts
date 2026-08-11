import { existsSync } from "fs";
import { join, resolve } from "path";

const md5Pattern = /^[a-f0-9]{32}$/i;

type DynamicRealmObject = import("realm").Object & Record<string, unknown>;
type RealmFetch = (...args: unknown[]) => Promise<never>;

function loadRealm() {
  const realmGlobal = globalThis as unknown as { fetch?: RealmFetch };
  const existingFetch = realmGlobal.fetch;

  if (!existingFetch) {
    realmGlobal.fetch = () => Promise.reject(new Error("Realm networking is unavailable in this Electron version."));
  }

  try {
    return require("realm") as typeof import("realm");
  } finally {
    if (!existingFetch) delete realmGlobal.fetch;
  }
}

export interface LazerRealmFile {
  filename: string;
  hash: string;
}

export interface LazerRealmBeatmapResult {
  found: boolean;
  beatmapHash?: string;
  files?: LazerRealmFile[];
}

function objectProperty<T>(object: DynamicRealmObject, property: string): T {
  return object[property] as T;
}

export async function queryLazerBeatmap(root: string, md5: string): Promise<LazerRealmBeatmapResult> {
  if (!md5Pattern.test(md5)) throw new Error(`Invalid beatmap MD5: ${md5}`);

  const realmPath = join(resolve(root), "client.realm");
  if (!existsSync(realmPath)) {
    throw new Error(`Could not find the osu!lazer client.realm database: ${realmPath}`);
  }

  const Realm = loadRealm();
  const realm = await Realm.open({
    path: realmPath,
    readOnly: true,
  });

  try {
    const beatmaps = realm.objects<DynamicRealmObject>("Beatmap").filtered("MD5Hash == $0", md5.toLowerCase());
    const beatmap = Array.from(beatmaps).find((candidate) => {
      const beatmapSet = objectProperty<DynamicRealmObject | null>(candidate, "BeatmapSet");
      return beatmapSet !== null && !objectProperty<boolean>(beatmapSet, "DeletePending");
    });

    if (!beatmap) return { found: false };

    const beatmapSet = objectProperty<DynamicRealmObject>(beatmap, "BeatmapSet");
    const usages = objectProperty<import("realm").List<DynamicRealmObject>>(beatmapSet, "Files");
    const files = Array.from(usages, (usage) => {
      const file = objectProperty<DynamicRealmObject>(usage, "File");
      return {
        filename: objectProperty<string>(usage, "Filename"),
        hash: objectProperty<string>(file, "Hash"),
      };
    });

    return {
      found: true,
      beatmapHash: objectProperty<string>(beatmap, "Hash"),
      files,
    };
  } finally {
    realm.close();
  }
}
