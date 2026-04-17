import React from 'react';
import { useUniverseStore } from '../../store/universeStore';

const statusColor = { idle: '#4b5563', active: '#a855f7', dormant: '#374151' };

export default function AgentCards() {
  const agents   = useUniverseStore(s => s.agents);
  const thinking = useUniverseStore(s => s.thinking);

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '0 4px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Agents</div>
      {agents.length === 0 && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', paddingTop: 16 }}>No agents yet</div>}
      {agents.map(agent => (
        <div key={agent.id} style={{ marginBottom: 8, padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: `1px solid ${thinking[agent.id] ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.05)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#e2d9f3' }}>{agent.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: agent.type === 'llm' ? 'rgba(168,85,247,0.2)' : 'rgba(134,239,172,0.2)', color: agent.type === 'llm' ? '#a855f7' : '#86efac' }}>
              {agent.type?.toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{agent.role}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[thinking[agent.id] ? 'active' : agent.status] }} />
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563' }}>
              {thinking[agent.id] ? 'thinking' : (agent.status || 'idle')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
