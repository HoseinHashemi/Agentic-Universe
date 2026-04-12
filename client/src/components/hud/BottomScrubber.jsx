import React, { useState, useRef } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { useUiStore } from '../../store/uiStore';
import { snapshots as snapshotsApi } from '../../api/snapshots';
import { universes } from '../../api/universes';

const s = {
  wrap: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: 'rgba(4,0,10,0.85)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(168,85,247,0.2)',
    padding: '8px 16px 10px',
    pointerEvents: 'auto', zIndex: 100,
  },
  track: {
    position: 'relative', height: 20, cursor: 'pointer',
    background: 'rgba(168,85,247,0.1)',
    borderRadius: 4, marginBottom: 4,
  },
  progressFill: (pct) => ({
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: `${pct}%`,
    background: 'rgba(168,85,247,0.25)', borderRadius: 4,
    transition: 'width 0.2s linear',
  }),
  dot: (pct) => ({
    position: 'absolute', top: '50%', left: `${pct}%`,
    transform: 'translate(-50%, -50%)',
    width: 8, height: 8, borderRadius: '50%',
    background: '#a855f7', cursor: 'pointer',
  }),
  thumb: (pct) => ({
    position: 'absolute', top: '50%', left: `${pct}%`,
    transform: 'translate(-50%, -50%)',
    width: 14, height: 14, borderRadius: '50%',
    background: '#e2d9f3', border: '2px solid #a855f7',
    pointerEvents: 'none',
  }),
  meta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, fontFamily: 'monospace', color: '#6b7280',
  },
  liveBtn: {
    background: '#84cc16', color: '#04000a',
    border: 'none', borderRadius: 4, padding: '2px 8px',
    fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
  },
};

export default function BottomScrubber() {
  const { tick, universeId, playbackMode, enterReplay, exitReplay } = useSimulationStore();
  const { snapshots } = useUiStore();
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, snap }

  const maxTick = snapshots.length ? Math.max(...snapshots.map(s => s.tick)) : Math.max(tick, 1);
  const thumbPct = Math.min((tick / maxTick) * 100, 100);

  const loadSnapshot = (snap) => {
    snapshotsApi.get(snap.universe_id, snap.id)
      .then(d => { enterReplay(snap.id, d.snapshot.state); })
      .catch(err => alert(err.message));
  };

  const forkSnapshot = (snap) => {
    universes.fork(snap.universe_id, { snapshotId: snap.id })
      .then(d => { alert(`Forked as: ${d.universe.name}`); })
      .catch(err => alert(err.message));
    setCtxMenu(null);
  };

  return (
    <div style={s.wrap}>
      <div style={s.track} onClick={(e) => {
        // Click on track: nothing fancy, just visual feedback
      }}>
        <div style={s.progressFill(thumbPct)} />

        {/* Snapshot dots */}
        {snapshots.map(snap => {
          const pct = Math.min((snap.tick / maxTick) * 100, 100);
          return (
            <div
              key={snap.id}
              style={s.dot(pct)}
              title={`Tick ${snap.tick}${snap.label ? ` — ${snap.label}` : ''}`}
              onClick={(e) => { e.stopPropagation(); loadSnapshot(snap); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setCtxMenu({ x: e.clientX, y: e.clientY, snap });
              }}
            />
          );
        })}

        {/* Playhead */}
        <div style={s.thumb(thumbPct)} />
      </div>

      <div style={s.meta}>
        <span>tick {tick.toLocaleString()} / {maxTick.toLocaleString()}</span>
        <span>{snapshots.length} snapshots</span>
        {playbackMode === 'replay' && (
          <button style={s.liveBtn} onClick={exitReplay}>⏩ LIVE</button>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 300 }}
            onClick={() => setCtxMenu(null)}
          />
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y - 40,
            background: 'rgba(4,0,10,0.95)', border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 6, zIndex: 400, fontFamily: 'monospace', fontSize: 12,
            overflow: 'hidden',
          }}>
            <div
              style={{ padding: '8px 14px', cursor: 'pointer', color: '#e2d9f3' }}
              onClick={() => { loadSnapshot(ctxMenu.snap); setCtxMenu(null); }}
            >
              ⏮ Load snapshot
            </div>
            <div
              style={{ padding: '8px 14px', cursor: 'pointer', color: '#a855f7', borderTop: '1px solid rgba(168,85,247,0.2)' }}
              onClick={() => forkSnapshot(ctxMenu.snap)}
            >
              ⑂ Fork universe from here
            </div>
          </div>
        </>
      )}
    </div>
  );
}
