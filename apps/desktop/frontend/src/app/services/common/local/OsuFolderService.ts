import { injectable } from "inversify";
import { access } from "fs/promises";
import { join } from "path";
import { constants } from "fs";
import { BehaviorSubject } from "rxjs";
import { determineSongsFolder } from "@rewind/osu-local/utils";
import username from "username";
import { ipcRenderer } from "electron";
import { PersistentService } from "../../core/service";
import { JSONSchemaType } from "ajv";

const stableFilesToCheck = ["osu!.db", "scores.db", "Skins"];

/**
 * Checks certain files to see if Rewind can be booted without any problems with the given `osuFolderPath`.
 * @param osuFolderPath the folder path to check the files in
 */
export async function osuFolderSanityCheck(osuFolderPath: string) {
  try {
    await Promise.all(stableFilesToCheck.map((f) => access(join(osuFolderPath, f), constants.R_OK)));
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
}

interface OsuSettings {
  osuStablePath: string;
  osuLazerPath: string;
}

export const DEFAULT_OSU_SETTINGS: OsuSettings = Object.freeze({
  osuStablePath: "",
  osuLazerPath: "",
});
export const OsuSettingsSchema: JSONSchemaType<OsuSettings> = {
  type: "object",
  properties: {
    osuStablePath: { type: "string", default: DEFAULT_OSU_SETTINGS.osuStablePath },
    osuLazerPath: { type: "string", default: DEFAULT_OSU_SETTINGS.osuLazerPath },
  },
  required: [],
};

@injectable()
export class OsuFolderService extends PersistentService<OsuSettings> {
  public replaysFolder$ = new BehaviorSubject<string>("");
  public songsFolder$ = new BehaviorSubject<string>("");

  key = "osu-settings";
  schema = OsuSettingsSchema;

  constructor() {
    super();
    this.settings$.subscribe(this.onFolderChange.bind(this));
  }

  getDefaultValue(): OsuSettings {
    return DEFAULT_OSU_SETTINGS;
  }

  async onFolderChange(osuSettings: OsuSettings) {
    const { osuStablePath } = osuSettings;
    ipcRenderer.send("osuFolderChanged", osuStablePath, osuSettings.osuLazerPath);
    this.replaysFolder$.next(osuStablePath ? join(osuStablePath, "Replays") : "");
    const userId = await username();
    this.songsFolder$.next(
      osuStablePath ? ((await determineSongsFolder(osuStablePath, userId as string)) as string) : "",
    );
  }

  getOsuFolder(): string {
    return this.settings.osuStablePath;
  }

  setOsuFolder(path: string) {
    console.log(`osu! folder was set to '${path}'`);
    this.changeSettings((draft) => (draft.osuStablePath = path));
  }

  getLazerFolder(): string {
    return this.settings.osuLazerPath;
  }

  setLazerFolder(path: string) {
    console.log(`osu!lazer folder was set to '${path}'`);
    this.changeSettings((draft) => (draft.osuLazerPath = path));
  }

  async resolveLazerFolder(path = this.getLazerFolder()): Promise<string | null> {
    return await ipcRenderer.invoke("resolveLazerDataDirectory", path);
  }

  async ensureLazerFolder(): Promise<string> {
    const resolvedPath = await this.resolveLazerFolder();
    if (resolvedPath && resolvedPath !== this.getLazerFolder()) this.setLazerFolder(resolvedPath);
    return resolvedPath ?? "";
  }

  async isValidOsuFolder(directoryPath: string) {
    return osuFolderSanityCheck(directoryPath);
  }

  async hasValidOsuFolderSet(): Promise<boolean> {
    return (await this.hasValidStableFolderSet()) || this.isValidLazerFolder(this.getLazerFolder());
  }

  async hasValidStableFolderSet(): Promise<boolean> {
    const folder = this.getOsuFolder();
    return !!folder && this.isValidOsuFolder(folder);
  }

  async isValidLazerFolder(directoryPath: string) {
    return !!(await this.resolveLazerFolder(directoryPath));
  }
}
