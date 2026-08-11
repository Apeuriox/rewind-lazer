import { app, dialog, ipcMain } from "electron";
import { readExtendedReplay } from "@rewind/osu-local/osr-reader";
import { queryLazerBeatmap } from "./lazerRealmReader";
import { resolveLazerDataDirectory } from "./lazerDataDirectory";

async function userSelectDirectory(defaultPath: string) {
  const { canceled, filePaths } = await dialog.showOpenDialog({ defaultPath, properties: ["openDirectory"] });
  if (canceled || filePaths.length === 0) {
    return null;
  } else {
    return filePaths[0];
  }
}

async function userSelectFile(defaultPath: string) {
  const { canceled, filePaths } = await dialog.showOpenDialog({ defaultPath, properties: ["openFile"] });
  if (canceled || filePaths.length === 0) {
    return null;
  } else {
    return filePaths[0];
  }
}

function getPath(type: string) {
  switch (type) {
    case "appData":
      return app.getPath("appData");
    case "userData":
      return app.getPath("userData");
    case "logs":
      return app.getPath("logs");
    case "appResources":
      return process.resourcesPath;
  }
  return "";
}

export function setupEventListeners() {
  ipcMain.handle("getPath", (event, type) => getPath(type));
  ipcMain.handle("selectDirectory", (event, defaultPath) => userSelectDirectory(defaultPath));
  ipcMain.handle("selectFile", (event, defaultPath) => userSelectFile(defaultPath));
  ipcMain.handle("getPlatform", () => process.platform);
  ipcMain.handle("getAppVersion", () => app.getVersion());
  ipcMain.handle("reboot", () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.handle("readOsr", async (event, filePath) => {
    return await readExtendedReplay(filePath);
  });
  ipcMain.handle("queryLazerBeatmap", async (event, root, md5) => {
    return await queryLazerBeatmap(root, md5);
  });
  ipcMain.handle("resolveLazerDataDirectory", async (event, configuredPath) => {
    return await resolveLazerDataDirectory(configuredPath, app.getPath("appData"));
  });
}
