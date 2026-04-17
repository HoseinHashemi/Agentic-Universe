import React, { useEffect, useRef } from 'react';
import { useUniverseStore } from '../../store/universeStore';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';

export default function MessageThread() {
  const messages = useUniverseStore(s => s.messages);
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12, paddingBottom: 4 }}>
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#374151', marginTop: 60 }}>
          Waiting for first event…
        </div>
      )}
      {messages.map((msg, i) => <MessageBubble key={msg.id ?? i} msg={msg} />)}
      <ThinkingIndicator />
      <div ref={bottom} />
    </div>
  );
}
