import React, { useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';

const ROLE_COLOR = { producer: '#84cc16', consumer: '#a855f7', predator: '#f97316' };

const s = {
  panel: {
    position: 'fixed', top: 50, right: 12,
    background: 'rgba(4,0,10,0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: 8, padding: '10px 14px',
    color: '#e2d9f3', fontSize: 12, fontFamily: 'monospace',
    minWidth: 180, pointerEvents: 'auto', zIndex: 100,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 11, color: '#a855f7', letterSpacing: 1, textTransform: 'uppercase' },
  collapseBtn: {
    background: 'none', border: 'none', color: '#a855f7',
    cursor: 'pointer', fontSize: 14, lineHeight: 1,
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  barWrap: { flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  bar: (color, pct) => ({
    width: `${pct}%`, height: '100%', background: color, borderRadius: 2,
    transition: 'width 0.3s ease',
  }),
  count: { width: 32, textAlign: 'right', color: '#c4b5d9' },
  divider: { borderTop: '1px solid rgba(168,85,247,0.2)', margin: '6px 0' },
  rateRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' },
};

export default function StatsPanel() {
  const stats = useSimulationStore((s) => s.stats);
  const [collapsed, setCollapsed] = useState(false);

  const maxCount = Math.max(1, ...stats.map(s => s.count));

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>Population</span>
        <button style={s.collapseBtn} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <>
          {stats.map(st => {
            const color = ROLE_COLOR[st.role] ?? st.color ?? '#ffffff';
            return (
              <div key={st.typeId} style={s.row}>
                <span style={s.dot(color)} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {st.name}
                </span>
                <div style={s.barWrap}>
                  <div style={s.bar(color, (st.count / maxCount) * 100)} />
                </div>
                <span style={s.count}>{st.count}</span>
              </div>
            );
          })}

          <div style={s.divider} />
          {stats.map(st => (
            <div key={st.typeId + '-rate'} style={s.rateRow}>
              <span>{st.name.slice(0, 8)}</span>
              <span>+{st.birthsPerMin}/m  −{st.deathsPerMin}/m</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
