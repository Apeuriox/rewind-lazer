import { injectable } from "inversify";
import { BehaviorSubject } from "rxjs";
import { Beatmap, buildBeatmap, modsToBitmask, parseBlueprint } from "@osujs/core";
import { GameSimulator } from "../common/game/GameSimulator";
import { AudioService, highPrecisionAudioUnavailableReason } from "../common/audio/AudioService";
import { ReplayService } from "../common/local/ReplayService";
import { BeatmapManager } from "./BeatmapManager";
import { ReplayManager } from "./ReplayManager";
import { AnalysisSceneKeys, AnalysisSceneManager } from "./AnalysisSceneManager";
import { AudioEngine } from "../common/audio/AudioEngine";
import { GameplayClock } from "../common/game/GameplayClock";
import { GameLoop } from "../common/game/GameLoop";
import { PixiRendererManager } from "../renderers/PixiRendererManager";
import { BeatmapBackgroundSettingsStore } from "../common/beatmap-background";
import { TextureManager } from "../textures/TextureManager";
import { ReplayFileWatcher } from "../common/local/ReplayFileWatcher";
import { ModSettingsService } from "../analysis/mod-settings";
import { LocalBeatmapService } from "../common/local/LocalBeatmapService";
import { Texture } from "pixi.js";

interface Scenario {
  status: "LOADING" | "ERROR" | "DONE" | "INIT";
}

export type HighPrecisionAudioState =
  | { status: "UNAVAILABLE"; reason: "NO_REPLAY" | "LOADING" | "NOT_MP3" | "TOO_LONG" }
  | { status: "AVAILABLE" }
  | { status: "CONVERTING" }
  | { status: "ACTIVE" }
  | { status: "ERROR" };

interface CurrentAudioSource {
  filename: string;
  originalUrl: string;
  loadData: () => Promise<ArrayBuffer | undefined>;
}

@injectable()
export class ScenarioManager {
  public scenario$: BehaviorSubject<Scenario>;
  public highPrecisionAudioState$: BehaviorSubject<HighPrecisionAudioState>;
  private currentAudioSource?: CurrentAudioSource;

  constructor(
    private readonly gameClock: GameplayClock,
    private readonly renderer: PixiRendererManager,
    private readonly gameLoop: GameLoop,
    private readonly gameSimulator: GameSimulator,
    private readonly modSettingsService: ModSettingsService,
    private readonly localBeatmapService: LocalBeatmapService,
    private readonly audioService: AudioService,
    private readonly textureManager: TextureManager,
    private readonly replayService: ReplayService,
    private readonly beatmapBackgroundSettingsStore: BeatmapBackgroundSettingsStore,
    private readonly beatmapManager: BeatmapManager,
    private readonly replayManager: ReplayManager,
    private readonly sceneManager: AnalysisSceneManager,
    private readonly replayWatcher: ReplayFileWatcher,
    private readonly audioEngine: AudioEngine,
  ) {
    this.scenario$ = new BehaviorSubject<Scenario>({ status: "INIT" });
    this.highPrecisionAudioState$ = new BehaviorSubject<HighPrecisionAudioState>({
      status: "UNAVAILABLE",
      reason: "NO_REPLAY",
    });
  }

  public initialize() {
    this.replayWatcher.newReplays$.subscribe((replayId) => {
      void this.loadReplay(replayId);
    });
  }

  // This is a temporary solution to
  async clearReplay() {
    this.gameClock.clear();
    this.replayManager.setMainReplay(null);
    this.audioEngine.destroy();
    this.audioService.releaseTemporaryAudio();
    this.currentAudioSource = undefined;
    this.highPrecisionAudioState$.next({ status: "UNAVAILABLE", reason: "NO_REPLAY" });
    this.renderer.getRenderer()?.clear();
    this.beatmapManager.setBeatmap(Beatmap.EMPTY_BEATMAP);
    this.gameSimulator.clear();
    this.localBeatmapService.clear();
    this.gameLoop.stopTicker();
    // await this.sceneManager.changeToScene(AnalysisSceneKeys.IDLE);
    this.scenario$.next({ status: "INIT" });
  }

  async loadReplay(replayId: string) {
    console.log(`ScenarioManager loading replay with id = ${replayId}`);
    // TODO: Clean this up
    this.audioEngine.destroy();
    this.audioService.releaseTemporaryAudio();
    this.currentAudioSource = undefined;
    this.highPrecisionAudioState$.next({ status: "UNAVAILABLE", reason: "LOADING" });

    this.scenario$.next({ status: "LOADING" });

    const replay = await this.replayService.retrieveReplay(replayId);
    const localBeatmap = await this.localBeatmapService.findByMD5(replay.beatmapMd5, replay.client);
    if (!localBeatmap) throw Error(`Could not find a stable or lazer beatmap with MD5=${replay.beatmapMd5}`);

    const rawBlueprint = localBeatmap.rawBlueprint;
    const blueprint = parseBlueprint(rawBlueprint);

    const { metadata } = blueprint.blueprintInfo;

    // Load background
    const backgroundUrl = await localBeatmap.getAssetUrl(metadata.backgroundFile);
    this.beatmapBackgroundSettingsStore.texture$.next(
      backgroundUrl ? await this.textureManager.loadTexture(backgroundUrl) : Texture.EMPTY,
    );

    // Load audio
    const audioUrl = await localBeatmap.getAssetUrl(metadata.audioFile);
    if (!audioUrl) throw Error(`Could not find beatmap audio file '${metadata.audioFile}' in ${localBeatmap.source}`);
    const audio = await this.audioService.loadAudio(audioUrl, metadata.audioFile);
    this.audioEngine.setSong(audio);
    const duration = audio.duration * 1000;
    this.gameClock.setDuration(duration);
    this.gameSimulator.calculateDifficulties(rawBlueprint, duration, modsToBitmask(replay.mods));

    const unavailableReason = highPrecisionAudioUnavailableReason(metadata.audioFile, duration);
    if (unavailableReason) {
      this.highPrecisionAudioState$.next({ status: "UNAVAILABLE", reason: unavailableReason });
    } else {
      this.currentAudioSource = {
        filename: metadata.audioFile,
        originalUrl: audioUrl,
        loadData: () => localBeatmap.getAssetData(metadata.audioFile),
      };
      this.highPrecisionAudioState$.next({ status: "AVAILABLE" });
    }

    // If the building is too slow or unbearable, we should push the building to a WebWorker, but right now it's ok
    // even on long maps.
    const beatmap = buildBeatmap(blueprint, {
      addStacking: true,
      mods: replay.mods,
      clockRate: replay.clockRate,
      replayClient: replay.client,
    });

    console.log(`Beatmap built with ${beatmap.hitObjects.length} hitobjects`);
    console.log(`Replay loaded with ${replay.frames.length} frames`);
    const modHidden = replay.mods.includes("HIDDEN");
    const initialSpeed = beatmap.gameClockRate;

    this.modSettingsService.setHidden(modHidden);
    // Not supported yet
    this.modSettingsService.setFlashlight(false);

    this.gameClock.pause();
    this.gameClock.setReplaySpeed(replay.clockRate);
    this.gameClock.setSpeed(initialSpeed);
    this.gameClock.seekTo(0);
    this.beatmapManager.setBeatmap(beatmap);
    this.replayManager.setMainReplay(replay);

    await this.gameSimulator.simulateReplay(beatmap, replay);
    await this.sceneManager.changeToScene(AnalysisSceneKeys.ANALYSIS);

    this.gameLoop.startTicker();
    this.scenario$.next({ status: "DONE" });
  }

  async toggleHighPrecisionAudio() {
    const state = this.highPrecisionAudioState$.getValue();
    const source = this.currentAudioSource;
    if (!source || state.status === "CONVERTING" || state.status === "UNAVAILABLE") return;

    const enableHighPrecision = state.status !== "ACTIVE";
    this.highPrecisionAudioState$.next({ status: "CONVERTING" });

    const wasPlaying = this.gameClock.isPlaying;
    this.gameClock.pause();
    const currentTime = this.gameClock.timeElapsedInMs;
    this.audioEngine.destroy();

    try {
      let audio: HTMLAudioElement;
      if (enableHighPrecision) {
        const audioData = await source.loadData();
        if (!audioData) throw new Error(`Could not read audio data for '${source.filename}'`);
        audio = await this.audioService.loadAudio(audioData, source.filename, true);
      } else {
        audio = await this.audioService.loadAudio(source.originalUrl, source.filename);
      }
      this.installReplacementAudio(audio, currentTime, wasPlaying);
      this.highPrecisionAudioState$.next({ status: enableHighPrecision ? "ACTIVE" : "AVAILABLE" });
    } catch (error) {
      console.error("Could not switch high-precision audio", error);
      try {
        const fallback = await this.audioService.loadAudio(source.originalUrl, source.filename);
        this.installReplacementAudio(fallback, currentTime, wasPlaying);
      } catch (fallbackError) {
        console.error("Could not restore the original audio", fallbackError);
      }
      this.highPrecisionAudioState$.next({ status: "ERROR" });
    }
  }

  private installReplacementAudio(audio: HTMLAudioElement, timeInMs: number, resume: boolean) {
    this.audioEngine.setSong(audio);
    this.gameClock.setDuration(audio.duration * 1000);
    this.audioEngine.changePlaybackRate(this.gameClock.speed);
    this.gameClock.seekTo(timeInMs);
    if (resume) this.gameClock.start();
  }

  // This is just the NM view of a beatmap
  async loadBeatmap(blueprintId: string) {
    // Set speed to 1.0
    this.gameClock.setReplaySpeed(undefined);
    this.gameClock.setSpeed(1.0);
    this.gameClock.seekTo(0);
    this.modSettingsService.setHidden(false);
    this.replayManager.setMainReplay(null);
  }

  async addSubReplay() {
    // Only possible if `mainReplay` is loaded
    // Adjust y-flip according to `mainReplay`
  }
}
