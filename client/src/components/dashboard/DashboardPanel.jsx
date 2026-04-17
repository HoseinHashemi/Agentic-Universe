import React from 'react';
import EventLog from './EventLog';
import AgentCards from './AgentCards';
import ArtifactList from './ArtifactList';

export default function DashboardPanel() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: '100%', gap: 1, background: 'rgba(168,85,247,0.05)' }}>
      <div style={{ background: '#04000a', padding: 12, overflow: 'hidden' }}><EventLog /></div>
      <div style={{ background: '#04000a', padding: 12, overflow: 'hidden' }}><AgentCards /></div>
      <div style={{ background: '#04000a', padding: 12, overflow: 'hidden' }}><ArtifactList /></div>
    </div>
  );
}
