import { PersistentService } from "../core/service";
import { injectable } from "inversify";
import { JSONSchemaType } from "ajv";

export interface HudSettings {
  ppEnabled: boolean;
  starsEnabled: boolean;
  difficultyStatsEnabled: boolean;
}

export const DEFAULT_HUD_SETTINGS: HudSettings = Object.freeze({
  ppEnabled: true,
  starsEnabled: true,
  difficultyStatsEnabled: true,
});

export const HudSettingsSchema: JSONSchemaType<HudSettings> = {
  type: "object",
  properties: {
    ppEnabled: { type: "boolean", default: DEFAULT_HUD_SETTINGS.ppEnabled },
    starsEnabled: { type: "boolean", default: DEFAULT_HUD_SETTINGS.starsEnabled },
    difficultyStatsEnabled: { type: "boolean", default: DEFAULT_HUD_SETTINGS.difficultyStatsEnabled },
  },
  required: [],
};

@injectable()
export class HudSettingsStore extends PersistentService<HudSettings> {
  key = "hud";
  schema = HudSettingsSchema;

  getDefaultValue(): HudSettings {
    return DEFAULT_HUD_SETTINGS;
  }
}
