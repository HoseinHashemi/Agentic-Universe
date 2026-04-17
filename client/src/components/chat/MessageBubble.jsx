import React from 'react';

const AGENT_COLORS = ['#a855f7','#22d3ee','#86efac','#fbbf24','#f472b6','#60a5fa'];
function agentColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AGENT_COLORS[h % AGENT_COLORS.length];
}

export default function MessageBubble({ msg }) {
  const isUser        = msg.from_id === 'user';
  const isSystem      = msg.from_id === 'system';
  const isAgentToAgent = msg.to_id !== 'all' && msg.to_id !== 'user' && !isUser;

  if (isSystem) return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 4 }}>
        {msg.content}
      </span>
    </div>
  );

  const color = isUser ? '#e2d9f3' : agentColor(msg.from_id);

  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', padding: '4px 16px', gap: 8, opacity: isAgentToAgent ? 0.7 : 1 }}>
      {!isUser && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
      )}
      <div style={{ maxWidth: '72%' }}>
        {!isUser && (
          <div style={{ fontFamily: 'monospace', fontSize: 11, color, marginBottom: 2 }}>
            {msg.agentName || msg.from_id}
            {isAgentToAgent ? ` → ${msg.to_id}` : ''}
          </div>
        )}
        <div style={{
          background: isUser ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
          borderRadius: 8, padding: '8px 12px',
          fontFamily: 'monospace', fontSize: 13, color: '#d1d5db', lineHeight: 1.5,
          border: `1px solid ${isUser ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}
