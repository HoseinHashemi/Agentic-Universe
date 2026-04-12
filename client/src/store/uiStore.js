import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  selectedAgentId: null,
  speedMultiplier: 1,   // 0.5 | 1 | 2 | 5 | 10
  snapshots: [],        // loaded for scrubber dots

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  selectAgent: (id) => set({ selectedAgentId: id }),
  deselectAgent: () => set({ selectedAgentId: null }),

  setSpeed: (multiplier) => set({ speedMultiplier: multiplier }),
  setSnapshots: (snapshots) => set({ snapshots }),
}));
