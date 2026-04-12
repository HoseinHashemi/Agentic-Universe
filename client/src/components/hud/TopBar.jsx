import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { useUiStore } from '../../store/uiStore';
import { instances } from '../../api/instances';

const SPEEDS = [0.5, 1, 2, 5, 10];
const BASE_INTERVAL = 200;

const s = {
  bar: {
    position: 'fixed', top: 0, left: 0, right: 0,
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 16px',
    background: 'rgba(4,0,10,0.85)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(168,85,247,0.2)',
    color: '#e2d9f3', fontSize: 13, fontFamily: 'monospace',
    pointerEvents: 'auto', zIndex: 100,
  },
  menuBtn: {
    background: 'none', border: 'none', color: '#a855f7',
    fontSize: 18, cursor: 'pointer', padding: '0 4px',
  },
  name: { fontWeight: 700, color: '#e2d9f3', fontSize: 14 },
  live: {
    background: '#84cc16', color: '#04000a',
    borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700,
  },
  replay: {
    background: '#f97316', color: '#04000a',
    borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700,
  },
  dot: (ok) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: ok ? '#84cc16' : '#f97316',
    display: 'inline-block',
  }),
  tick: { color: '#a855f7', fontSize: 12 },
  ctrlBtn: {
    background: 'rgba(168,85,247,0.15)',
    border: '1px solid rgba(168,85,247,0.4)',
    color: '#e2d9f3', borderRadius: 6, padding: '3px 10px',
    cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
  },
  speedBtn: (active) => ({
    background: active ? 'rgba(168,85,247,0.4)' : 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.4)',
    color: '#e2d9f3', borderRadius: 4, padding: '2px 7px',
    cursor: 'pointer', fontSize: 11, fontFamily: 'monospace',
  }),
  spacer: { flex: 1 },
};

export default function TopBar() {
  const { instanceId, universeName, tick, running, connected, playbackMode, exitReplay } = useSimulationStore();
  const { toggleSidebar, speedMultiplier, setSpeed } = useUiStore();

  const toggleRun = () => {
    if (!instanceId) return;
    if (running) instances.stop(instanceId).catch(() => {});
    else instances.start(instanceId).catch(() => {});
  };

  const changeSpeed = (mult) => {
    setSpeed(mult);
    if (instanceId) {
      instances.patchConfig(instanceId, { tickInterval: Math.round(BASE_INTERVAL / mult) }).catch(() => {});
    }
  };

  return (
    <div style={s.bar}>
      <button style={s.menuBtn} onClick={toggleSidebar}>☰</button>
      <span style={s.name}>{universeName || 'Agentic Universe'}</span>
      <span style={playbackMode === 'live' ? s.live : s.replay}>
        {playbackMode === 'live' ? '● LIVE' : '⏮ REPLAY'}
      </span>
      <span style={s.dot(connected)} title={connected ? 'Connected' : 'Disconnected'} />
      <span style={s.tick}>tick {tick.toLocaleString()}</span>
      <div style={s.spacer} />

      <button style={s.ctrlBtn} onClick={toggleRun}>
        {running ? '⏸ Pause' : '▶ Play'}
      </button>
      <div style={{ display: 'flex', gap: 3 }}>
        {SPEEDS.map(sp => (
          <button
            key={sp}
            style={s.speedBtn(speedMultiplier === sp)}
            onClick={() => changeSpeed(sp)}
          >
            {sp}×
          </button>
        ))}
      </div>
      {playbackMode === 'replay' && (
        <button style={{ ...s.ctrlBtn, borderColor: '#84cc16', color: '#84cc16' }} onClick={exitReplay}>
          Go Live
        </button>
      )}
    </div>
  );
}
