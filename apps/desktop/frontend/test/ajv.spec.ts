import Ajv from "ajv";
import { SkinSettings, SkinSettingsSchema } from "../src/app/services/common/skin";
import { OsuSettings, OsuSettingsSchema } from "../src/app/services/common/local/OsuFolderService";

describe("validateSkinSettings", () => {
  const ajv = new Ajv({ useDefaults: true });
  const validateSkinSettings = ajv.compile<SkinSettings>(SkinSettingsSchema);

  it("normal behavior", () => {
    const data = {
      preferredSkinId: "#-------#--------------#---------- wow so many dashes v2 final final - copy",
    };
    expect(validateSkinSettings(data)).toBe(true);
  });
  it("default behavior when missing", () => {
    const data = {};
    expect(validateSkinSettings(data)).toBe(true);
    expect(data).toEqual({
      preferredSkinId: "rewind:RewindDefaultSkin",
    });
  });
  it("default behavior when wrong data type", () => {
    const data = {
      preferredSkinId: 42,
    };
    expect(validateSkinSettings(data)).toBe(false);
    // This is where we just straight up pass in the default data.
  });
  it("type safe", () => {
    const data = {
      preferredSkinId: "x",
    };
    if (validateSkinSettings(data)) {
      // Data is now SkinSettings because of type predicate
      expect(data.preferredSkinId).toEqual("x");

      // Below should not compile
      // expect(data.preferredSkinId2).toEqual("x");
    }
  });
});

describe("validateOsuSettings", () => {
  const ajv = new Ajv({ useDefaults: true });
  const validateOsuSettings = ajv.compile<OsuSettings>(OsuSettingsSchema);

  it("defaults existing user settings to the stable replay folder", () => {
    const data = { osuStablePath: "C:\\osu!", osuLazerPath: "D:\\osu-lazer" };

    expect(validateOsuSettings(data)).toBe(true);
    expect(data).toEqual({
      osuStablePath: "C:\\osu!",
      osuLazerPath: "D:\\osu-lazer",
      defaultReplayClient: "STABLE",
    });
  });

  it("accepts lazer as the configured replay folder", () => {
    const data = { osuStablePath: "", osuLazerPath: "D:\\osu-lazer", defaultReplayClient: "LAZER" };
    expect(validateOsuSettings(data)).toBe(true);
  });
});
