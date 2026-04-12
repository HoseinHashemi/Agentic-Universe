import React, { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { universes } from '../../api/universes';
import { instances as instancesApi } from '../../api/instances';
import { useSimulationStore } from '../../store/simulationStore';

const s = {
  overlay: (open) => ({
    position: 'fixed', top: 0, left: open ? 0 : '-320px', bottom: 0,
    width: 300,
    background: 'rgba(4,0,10,0.95)',
    backdropFilter: 'blur(12px)',
    borderRight: '1px solid rgba(168,85,247,0.25)',
    transition: 'left 0.25s ease',
    color: '#e2d9f3', fontFamily: 'monospace', fontSize: 13,
    display: 'flex', flexDirection: 'column',
    pointerEvents: 'auto', zIndex: 200,
  }),
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderBottom: '1px solid rgba(168,85,247,0.2)',
  },
  title: { color: '#a855f7', fontWeight: 700, fontSize: 14, letterSpacing: 1 },
  closeBtn: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 },
  section: { padding: '10px 16px', borderBottom: '1px solid rgba(168,85,247,0.15)' },
  sectionTitle: { color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  item: (active) => ({
    padding: '7px 10px', borderRadius: 6, marginBottom: 3, cursor: 'pointer',
    background: active ? 'rgba(168,85,247,0.2)' : 'transparent',
    border: `1px solid ${active ? 'rgba(168,85,247,0.4)' : 'transparent'}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }),
  badge: (color) => ({
    fontSize: 10, padding: '1px 5px', borderRadius: 3,
    background: color, color: '#04000a', fontWeight: 700,
  }),
};

export default function UniverseSidebar() {
  const { sidebarOpen, closeSidebar } = useUiStore();
  const { universeId: activeId } = useSimulationStore();
  const [list, setList] = useState({ templates: [], saved: [] });

  useEffect(() => {
    if (sidebarOpen) {
      universes.list().then(d => setList(d)).catch(() => {});
    }
  }, [sidebarOpen]);

  const loadUniverse = (id) => {
    instancesApi.create({ universeId: id, slot: 2 })
      .then(() => { closeSidebar(); })
      .catch(err => alert(err.message));
  };

  return (
    <div style={s.overlay(sidebarOpen)}>
      <div style={s.header}>
        <span style={s.title}>Universes</span>
        <button style={s.closeBtn} onClick={closeSidebar}>×</button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <div style={s.section}>
          <div style={s.sectionTitle}>Templates</div>
          {list.templates.map(t => (
            <div key={t.id} style={s.item(t.id === activeId)} onClick={() => loadUniverse(t.id)}>
              <span>{t.name}</span>
              <span style={s.badge('#84cc16')}>TPL</span>
            </div>
          ))}
        </div>

        {list.saved.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Saved</div>
            {list.saved.map(u => (
              <div key={u.id} style={s.item(u.id === activeId)} onClick={() => loadUniverse(u.id)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  {u.name}
                </span>
                <span style={s.badge('#a855f7')}>
                  {u.privacy === 'public' ? 'PUB' : 'PRV'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
