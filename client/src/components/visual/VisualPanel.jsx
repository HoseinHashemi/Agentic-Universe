import React, { useState } from 'react';
import AgentGraph from './AgentGraph';
import AgentDrawer from './AgentDrawer';
import { useUniverseStore } from '../../store/universeStore';

export default function VisualPanel() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const agents = useUniverseStore(s => s.agents);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {agents.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>
          No agents yet
        </div>
      ) : (
        <AgentGraph onAgentClick={setSelectedAgent} />
      )}
      <AgentDrawer agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}
