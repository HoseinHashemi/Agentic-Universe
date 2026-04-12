import { create } from 'zustand';

export const useSimulationStore = create((set) => ({
  instanceId: null,
  universeId: null,
  universeName: '',
  tick: 0,
  running: false,
  agents: [],
  stats: [],
  connected: false,
  playbackMode: 'live',   // 'live' | 'replay'
  replaySnapshotId: null,

  setConnected: (connected) => set({ connected }),

  applyTick: (payload) => set({
    tick: payload.tick,
    running: payload.running,
    agents: payload.agents ?? [],
    stats: payload.stats ?? [],
  }),

  setInstance: ({ instanceId, universeId, universeName }) =>
    set({ instanceId, universeId, universeName }),

  enterReplay: (snapshotId, state) => set({
    playbackMode: 'replay',
    replaySnapshotId: snapshotId,
    tick: state.tick,
    running: false,
    agents: state.agents ?? [],
    stats: state.stats ?? [],
  }),

  exitReplay: () => set({ playbackMode: 'live', replaySnapshotId: null }),
}));
