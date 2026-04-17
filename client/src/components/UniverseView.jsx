import React, { useEffect } from 'react';
import { useUniverseStore } from '../store/universeStore';
import { messages as messagesApi } from '../api/messages';
import { artifacts as artifactsApi } from '../api/artifacts';
import PanelSwitcher from './PanelSwitcher';
import RefineInput from './RefineInput';
import ChatPanel from './chat/ChatPanel';
import VisualPanel from './visual/VisualPanel';
import DashboardPanel from './dashboard/DashboardPanel';

export default function UniverseView({ onExit }) {
  const { panel, activeUniverse, activeUniverseId, connected, setMessages, setArtifacts } = useUniverseStore();

  // Load initial messages and artifacts
  useEffect(() => {
    if (!activeUniverseId) return;
    messagesApi.list(activeUniverseId, { limit: 100 })
      .then(d => setMessages(d.messages || []))
      .catch(() => {});
    artifactsApi.list(activeUniverseId)
      .then(d => setArtifacts(d.artifacts || []))
      .catch(() => {});
  }, [activeUniverseId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#04000a' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid rgba(168,85,247,0.15)',
        background: 'rgba(4,0,10,0.9)', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#e2d9f3' }}>
          {activeUniverse?.name || 'Universe'}
        </div>
        <PanelSwitcher />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: connected ? '#86efac' : '#f87171' }}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </span>
          <button onClick={onExit} style={{ background: 'none', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4, color: '#6b7280', fontFamily: 'monospace', fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
            ← Universes
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {panel === 'chat'      && <ChatPanel />}
        {panel === 'visual'    && <VisualPanel />}
        {panel === 'dashboard' && <DashboardPanel />}
      </div>

      {/* Refine input — always visible */}
      <RefineInput />
    </div>
  );
}
