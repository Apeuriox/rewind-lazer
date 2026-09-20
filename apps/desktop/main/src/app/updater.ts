/**
 * Automatic updates are intentionally disabled for Rewind Lazer.
 *
 * Keep this no-op entry point so the updater can be reintroduced later
 * without retaining a runtime dependency on electron-updater in current
 * packaged builds.
 */
export function initializeAutoUpdater() {
  // Disabled until Rewind Lazer has its own compatible update feed.
}
