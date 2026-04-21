import { create } from 'zustand';

export const useUniverseStore = create((set, get) => ({
  // Universe list
  universes: [],
  setUniverses: (universes) => set({ universes }),

  // Active universe
  activeUniverseId: null,
  activeUniverse: null,
  agents: [],
  messages: [],
  events: [],
  artifacts: [],
  session: null,
  sessionStatus: 'stopped',  // 'running' | 'paused' | 'stopped'
  thinking: {},

  setActiveUniverse: ({ universe, agents, session }) =>
    set({ activeUniverseId: universe.id, activeUniverse: universe, agents: agents || [], session }),

  clearActiveUniverse: () =>
    set({ activeUniverseId: null, activeUniverse: null, agents: [], messages: [], events: [], artifacts: [], session: null, sessionStatus: 'stopped', thinking: {} }),

  setMessages:    (messages)  => set({ messages }),
  appendMessage:  (msg)       => set(s => ({ messages: [...s.messages, msg] })),
  setAgents:      (agents)    => set({ agents }),
  appendAgent:    (agent)     => set(s => ({ agents: [...s.agents, agent] })),
  setArtifacts:   (artifacts) => set({ artifacts }),
  appendArtifact: (art)       => set(s => ({ artifacts: [...s.artifacts, art] })),
  appendEvent:    (ev)        => set(s => ({ events: [ev, ...s.events].slice(0, 200) })),

  setThinking: (agentId, agentName) =>
    set(s => ({ thinking: { ...s.thinking, [agentId]: agentName } })),
  clearThinking: (agentId) =>
    set(s => { const t = { ...s.thinking }; delete t[agentId]; return { thinking: t }; }),

  setSessionStatus: (sessionStatus) => set({ sessionStatus }),

  // WebSocket connection state
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Active panel
  panel: 'chat',
  setPanel: (panel) => set({ panel }),
}));
