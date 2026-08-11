import { injectable } from "inversify";
import { Subject } from "rxjs";
import * as chokidar from "chokidar";
import { OsuFolderService } from "./OsuFolderService";
import { stat } from "fs/promises";

export interface ReplayCandidate {
  path: string;
  modifiedAt: number;
}

export function newestReplayCandidate(candidates: ReplayCandidate[]): ReplayCandidate | undefined {
  return candidates.reduce<ReplayCandidate | undefined>(
    (newest, candidate) => (!newest || candidate.modifiedAt > newest.modifiedAt ? candidate : newest),
    undefined,
  );
}

const REPLAY_BATCH_DELAY_MS = 250;

@injectable()
export class ReplayFileWatcher {
  public readonly newReplays$: Subject<string>;
  private watcher?: chokidar.FSWatcher;
  private watchedFoldersKey = "";
  private pendingReplays = new Map<string, ReplayCandidate>();
  private pendingReplayTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly osuFolderService: OsuFolderService) {
    this.newReplays$ = new Subject<string>();
  }

  public startWatching() {
    this.osuFolderService.watchedReplayFolders$.subscribe(this.onNewReplayFolders.bind(this));
  }

  // Unsubscribes from the old replay folders and starts listening on the new folders that were given.
  private onNewReplayFolders(folders: string[]) {
    const foldersKey = folders.join("\0");
    if (foldersKey === this.watchedFoldersKey) return;
    this.watchedFoldersKey = foldersKey;

    // For now, we just use .close()
    // We could make it cleaner by using .unwatch() and adding new files to watch
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = undefined;
    }

    if (this.pendingReplayTimer) clearTimeout(this.pendingReplayTimer);
    this.pendingReplayTimer = undefined;
    this.pendingReplays.clear();

    if (folders.length === 0) return;

    console.log(`Watching for replays (.osr) in folders: ${folders.join(", ")}`);
    this.watcher = chokidar.watch(folders, {
      // ignoreInitial must be true otherwise addDir will be triggered for every folder initially.
      ignoreInitial: true,
      persistent: true,
      depth: 0, // if somehow osu! is trolling, this will prevent it
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });
    this.watcher.on("ready", () => {
      console.log("");
    });
    this.watcher.on("add", (path) => void this.onReplayAdded(path));
  }

  private async onReplayAdded(path: string) {
    if (!path.toLowerCase().endsWith(".osr")) return;

    try {
      const fileStat = await stat(path);
      this.pendingReplays.set(path, { path, modifiedAt: fileStat.mtimeMs });
      if (this.pendingReplayTimer) clearTimeout(this.pendingReplayTimer);
      this.pendingReplayTimer = setTimeout(() => this.loadNewestPendingReplay(), REPLAY_BATCH_DELAY_MS);
    } catch (error) {
      console.error(`Could not inspect new replay file '${path}'`, error);
    }
  }

  private loadNewestPendingReplay() {
    this.pendingReplayTimer = undefined;
    const newestReplay = newestReplayCandidate([...this.pendingReplays.values()]);
    this.pendingReplays.clear();
    if (!newestReplay) return;

    console.log(`Detected newest replay at: ${newestReplay.path}`);
    this.newReplays$.next(newestReplay.path);
  }
}
