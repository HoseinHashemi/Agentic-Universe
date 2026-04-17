import React, { useState } from 'react';
import { useUniverseStore } from '../../store/universeStore';

const typeColor = { agent_action: '#a855f7', event_processed: '#22d3ee', user_message: '#86efac', system: '#6b7280' };

export default function EventLog() {
  const events = useUniverseStore(s => s.events);
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '0 4px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Event Log</div>
      {events.length === 0 && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', paddingTop: 16 }}>No events yet</div>}
      {events.map((ev, i) => (
        <div key={i} style={{ marginBottom: 4, cursor: 'pointer' }} onClick={() => setExpanded(expanded === i ? null : i)}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor[ev.type] || '#6b7280', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{ev.type}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
              {ev.agentName || ev.source || ''}
            </span>
          </div>
          {expanded === i && (
            <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.02)', padding: 6, borderRadius: 4, marginTop: 4, overflowX: 'auto' }}>
              {JSON.stringify(ev, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
