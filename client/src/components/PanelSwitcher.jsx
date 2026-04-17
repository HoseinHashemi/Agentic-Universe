import React from 'react';
import { useUniverseStore } from '../store/universeStore';

const PANELS = ['chat', 'visual', 'dashboard'];

export default function PanelSwitcher() {
  const { panel, setPanel } = useUniverseStore();

  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(168,85,247,0.08)', borderRadius: 6, padding: 3 }}>
      {PANELS.map(p => (
        <button key={p} onClick={() => setPanel(p)} style={{
          padding: '4px 14px', border: 'none', borderRadius: 4, cursor: 'pointer',
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          background: panel === p ? '#a855f7' : 'transparent',
          color: panel === p ? '#04000a' : '#6b7280',
        }}>
          {p}
        </button>
      ))}
    </div>
  );
}
