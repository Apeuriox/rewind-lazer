import { constants } from "fs";
import { access, readFile } from "fs/promises";
import { isAbsolute, join, resolve } from "path";

async function isLazerDataDirectory(directoryPath: string) {
  try {
    await Promise.all([
      access(join(directoryPath, "client.realm"), constants.R_OK),
      access(join(directoryPath, "files"), constants.R_OK),
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

async function readRedirectedStoragePath(directoryPath: string) {
  try {
    const storageConfig = await readFile(join(directoryPath, "storage.ini"), "utf-8");
    const configuredPath = /^\s*FullPath\s*=\s*(.+?)\s*$/im.exec(storageConfig)?.[1]?.replace(/^['"]|['"]$/g, "");
    if (!configuredPath) return undefined;
    return resolve(isAbsolute(configuredPath) ? configuredPath : join(directoryPath, configuredPath));
  } catch (err) {
    return undefined;
  }
}

export async function resolveLazerDataDirectory(configuredPath: string, appDataPath: string) {
  const entryDirectories = [configuredPath, appDataPath ? join(appDataPath, "osu") : ""].filter(Boolean);
  const visited = new Set<string>();

  for (const entryDirectory of entryDirectories) {
    const absoluteEntry = resolve(entryDirectory);
    if (visited.has(absoluteEntry)) continue;
    visited.add(absoluteEntry);

    if (await isLazerDataDirectory(absoluteEntry)) return absoluteEntry;

    const redirectedPath = await readRedirectedStoragePath(absoluteEntry);
    if (redirectedPath && !visited.has(redirectedPath)) {
      visited.add(redirectedPath);
      if (await isLazerDataDirectory(redirectedPath)) return redirectedPath;
    }
  }

  return null;
}
