import React from 'react';
import { useUniverseStore } from '../../store/universeStore';

const s = {
  wrap: { padding: '4px 16px', display: 'flex', gap: 6, alignItems: 'center' },
  dot: (i) => ({
    width: 5, height: 5, borderRadius: '50%', background: '#a855f7',
    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
  }),
  label: { fontFamily: 'monospace', fontSize: 11, color: '#6b7280' },
};

export default function ThinkingIndicator() {
  const thinking = useUniverseStore(s => s.thinking);
  const names = Object.values(thinking);
  if (names.length === 0) return null;
  return (
    <div style={s.wrap}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
      {[0,1,2].map(i => <div key={i} style={s.dot(i)} />)}
      <span style={s.label}>{names.join(', ')} thinking…</span>
    </div>
  );
}
