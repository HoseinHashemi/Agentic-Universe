import React from 'react';

const s = {
  overlay: { position: 'fixed', inset: 0, zIndex: 200 },
  drawer: {
    position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
    background: 'rgba(4,0,10,0.97)', borderLeft: '1px solid rgba(168,85,247,0.3)',
    padding: 24, overflowY: 'auto', zIndex: 201, fontFamily: 'monospace',
  },
  close: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18,
  },
  name: { fontSize: 18, fontWeight: 700, color: '#e2d9f3', marginBottom: 4 },
  role: { fontSize: 12, color: '#a855f7', marginBottom: 16 },
  label: { fontSize: 11, color: '#6b7280', marginBottom: 4, marginTop: 12 },
  value: { fontSize: 12, color: '#d1d5db', lineHeight: 1.5 },
  badge: (type) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
    background: type === 'llm' ? 'rgba(168,85,247,0.2)' : 'rgba(134,239,172,0.2)',
    color: type === 'llm' ? '#a855f7' : '#86efac', marginBottom: 12,
  }),
};

export default function AgentDrawer({ agent, onClose }) {
  if (!agent) return null;
  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.drawer}>
        <button style={s.close} onClick={onClose}>✕</button>
        <div style={s.name}>{agent.name}</div>
        <div style={s.role}>{agent.role}</div>
        <span style={s.badge(agent.type)}>{agent.type === 'llm' ? 'LLM' : 'RULE'}</span>

        <div style={s.label}>Status</div>
        <div style={s.value}>{agent.status}</div>

        <div style={s.label}>Goals</div>
        <div style={s.value}>{agent.goals}</div>

        {agent.personality && (
          <>
            <div style={s.label}>Personality</div>
            <div style={s.value}>{agent.personality}</div>
          </>
        )}

        <div style={s.label}>Tools</div>
        <div style={s.value}>{(agent.tool_permissions || []).join(', ') || 'none'}</div>

        {agent.memory && Object.keys(agent.memory).length > 0 && (
          <>
            <div style={s.label}>Memory</div>
            <div style={{ ...s.value, background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 4, fontSize: 11 }}>
              {Object.entries(agent.memory).map(([k, v]) => (
                <div key={k}><span style={{ color: '#a855f7' }}>{k}:</span> {String(v)}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
