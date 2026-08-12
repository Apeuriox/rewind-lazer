const osuUniDiscord = "https://discord.gg/QubdHdnBVg";
export const discordUrl = osuUniDiscord;
export const twitterUrl = "https://twitter.com/osuuniversity";
export const youtubeUrl = "https://www.youtube.com/channel/UCzW2Z--fEw0LWKgVTmO-b6w";
export const RewindLinks = {
  OsuPpyShAbstrakt: "https://osu.ppy.sh/users/5773957",
  OsuUniDiscord: osuUniDiscord,
  Guide: "https://bit.ly/3BOF3P2",
};
export const RewindLazerRepository = {
  owner: "Apeuriox",
  name: "rewind",
  url: "https://github.com/Apeuriox/rewind",
};
export const ALLOWED_SPEEDS = [0.25, 0.75, 1.0, 1.5, 2.0, 4.0];

export function playbackSpeedOptions(currentSpeed: number, replaySpeed?: number) {
  return [
    ...new Set([...ALLOWED_SPEEDS, currentSpeed, replaySpeed].filter((speed): speed is number => speed !== undefined)),
  ]
    .filter((speed) => Number.isFinite(speed) && speed > 0)
    .sort((a, b) => a - b);
}

export function nextPlaybackSpeed(currentSpeed: number, replaySpeed?: number) {
  const speeds = playbackSpeedOptions(currentSpeed, replaySpeed);
  return speeds.find((speed) => speed > currentSpeed) ?? speeds[speeds.length - 1];
}

export function previousPlaybackSpeed(currentSpeed: number, replaySpeed?: number) {
  const speeds = playbackSpeedOptions(currentSpeed, replaySpeed);
  return [...speeds].reverse().find((speed) => speed < currentSpeed) ?? speeds[0];
}
// The legacy electron-updater dependency is incompatible with the packaged
// dependency layout. Keep updater IPC disabled until the updater is replaced.
export const ELECTRON_UPDATE_FLAG = false;
export const PlaybarColors = {
  MISS: "rgb(255,0,0)",
  SLIDER_BREAK: "rgb(255,89,0)",
  MEH: "rgb(255,221,0)",
  OK: "rgb(102,255,0)",
};
