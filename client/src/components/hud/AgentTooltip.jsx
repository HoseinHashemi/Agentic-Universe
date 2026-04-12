import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { useUiStore } from '../../store/uiStore';

const ROLE_COLOR = { producer: '#84cc16', consumer: '#a855f7', predator: '#f97316' };

export default function AgentTooltip() {
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const agents = useSimulationStore((s) => s.agents);
  const deselectAgent = useUiStore((s) => s.deselectAgent);

  if (!selectedAgentId) return null;
  const agent = agents.find(a => a.id === selectedAgentId);
  if (!agent) return null;

  const color = ROLE_COLOR[agent.role] ?? '#ffffff';

  return (
    <div style={{
      position: 'fixed',
      left: 16, bottom: 80,
      background: 'rgba(4,0,10,0.9)',
      border: `1px solid ${color}44`,
      borderRadius: 8,
      padding: '10px 14px',
      color: '#e2d9f3', fontSize: 12, fontFamily: 'monospace',
      pointerEvents: 'auto', zIndex: 100, minWidth: 160,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color, fontWeight: 700 }}>{agent.typeId}</span>
        <button
          onClick={deselectAgent}
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}
        >×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', color: '#c4b5d9' }}>
        <span>ID</span><span style={{ color: '#e2d9f3' }}>{agent.id.slice(0, 8)}</span>
        <span>Energy</span><span style={{ color: '#e2d9f3' }}>{agent.energy}</span>
        <span>Age</span><span style={{ color: '#e2d9f3' }}>{agent.age}</span>
        <span>State</span><span style={{ color: '#e2d9f3' }}>{agent.state}</span>
      </div>
    </div>
  );
}
