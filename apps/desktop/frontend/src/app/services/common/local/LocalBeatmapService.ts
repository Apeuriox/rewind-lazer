import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";
import { ipcRenderer } from "electron";
import { injectable } from "inversify";
import { ReplayClient } from "@osujs/core";
import { BlueprintLocatorService } from "./BlueprintLocatorService";
import { OsuFolderService } from "./OsuFolderService";
import { lazerStoragePath, mimeTypeFor } from "./LazerFileStore";

export type LocalBeatmapSource = "STABLE" | "LAZER";

export interface LocalBeatmap {
  rawBlueprint: string;
  source: LocalBeatmapSource;
  getAssetUrl(filename: string): Promise<string | undefined>;
  dispose(): void;
}

interface LazerRealmFile {
  filename: string;
  hash: string;
}

interface LazerRealmBeatmapResult {
  found: boolean;
  beatmapHash?: string;
  files?: LazerRealmFile[];
}

class StableLocalBeatmap implements LocalBeatmap {
  readonly source = "STABLE" as const;

  constructor(public readonly rawBlueprint: string, private readonly folderPath: string) {}

  async getAssetUrl(filename: string) {
    return filename ? pathToFileURL(join(this.folderPath, filename)).toString() : undefined;
  }

  dispose() {}
}

class LazerLocalBeatmap implements LocalBeatmap {
  readonly source = "LAZER" as const;
  private readonly filesByName = new Map<string, LazerRealmFile>();
  private readonly objectUrls = new Map<string, string>();

  constructor(public readonly rawBlueprint: string, private readonly root: string, files: LazerRealmFile[]) {
    for (const file of files) {
      this.filesByName.set(file.filename.toLowerCase(), file);
    }
  }

  async getAssetUrl(filename: string) {
    if (!filename) return undefined;

    const file = this.filesByName.get(filename.toLowerCase());
    if (!file) return undefined;

    const cached = this.objectUrls.get(file.hash);
    if (cached) return cached;

    const data = await readFile(lazerStoragePath(this.root, file.hash));
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeTypeFor(file.filename) }));
    this.objectUrls.set(file.hash, url);
    return url;
  }

  dispose() {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
  }
}

@injectable()
export class LocalBeatmapService {
  private currentBeatmap?: LocalBeatmap;

  constructor(
    private readonly blueprintLocatorService: BlueprintLocatorService,
    private readonly osuFolderService: OsuFolderService,
  ) {}

  async findByMD5(md5: string, preferredClient: ReplayClient): Promise<LocalBeatmap | undefined> {
    this.currentBeatmap?.dispose();
    this.currentBeatmap = undefined;

    const loaders =
      preferredClient === "LAZER"
        ? [this.loadFromLazer.bind(this), this.loadFromStable.bind(this)]
        : [this.loadFromStable.bind(this), this.loadFromLazer.bind(this)];
    const errors: unknown[] = [];

    for (const load of loaders) {
      try {
        const beatmap = await load(md5);
        if (beatmap) {
          this.currentBeatmap = beatmap;
          return beatmap;
        }
      } catch (err) {
        errors.push(err);
        console.warn("Failed to load a local beatmap source", err);
      }
    }
    if (errors.length > 0) throw errors[0];
    return undefined;
  }

  clear() {
    this.currentBeatmap?.dispose();
    this.currentBeatmap = undefined;
  }

  private async loadFromStable(md5: string): Promise<LocalBeatmap | undefined> {
    if (!(await this.osuFolderService.hasValidStableFolderSet())) return undefined;

    const info = await this.blueprintLocatorService.getBlueprintByMD5(md5);
    if (!info) return undefined;

    const folderPath = join(this.osuFolderService.songsFolder$.getValue(), info.folderName);
    const rawBlueprint = await readFile(join(folderPath, info.osuFileName), "utf-8");
    return new StableLocalBeatmap(rawBlueprint, folderPath);
  }

  private async loadFromLazer(md5: string): Promise<LocalBeatmap | undefined> {
    const root = await this.osuFolderService.ensureLazerFolder();
    if (!root) return undefined;

    const result = (await ipcRenderer.invoke("queryLazerBeatmap", root, md5)) as LazerRealmBeatmapResult;
    if (!result.found || !result.beatmapHash || !result.files) return undefined;

    const rawData = await readFile(lazerStoragePath(root, result.beatmapHash));
    const actualMd5 = createHash("md5").update(rawData).digest("hex");
    if (actualMd5.toLowerCase() !== md5.toLowerCase()) {
      throw new Error(`Lazer beatmap MD5 mismatch: replay=${md5}, local=${actualMd5}`);
    }

    return new LazerLocalBeatmap(rawData.toString("utf-8"), root, result.files);
  }
}
