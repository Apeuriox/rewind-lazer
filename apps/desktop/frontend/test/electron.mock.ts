export const ipcRenderer = {
  invoke: async (channel?: string) => {
    if (channel === "calculateOsuStrains") return { times: [], strains: [] };
    if (channel === "calculateOsuPerformanceSeries") return { stars: 0, pp: [] };
    return undefined;
  },
  on: () => undefined,
  send: () => undefined,
};
