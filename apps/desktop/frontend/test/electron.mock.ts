export const ipcRenderer = {
  invoke: async (channel?: string) => {
    if (channel === "calculateOsuStrains") return { times: [], strains: [] };
    return undefined;
  },
  on: () => undefined,
  send: () => undefined,
};
