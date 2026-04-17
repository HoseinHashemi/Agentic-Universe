import React, { useState } from 'react';
import { useUniverseStore } from '../../store/universeStore';
import { messages as messagesApi } from '../../api/messages';

export default function MessageInput() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const activeUniverseId = useUniverseStore(s => s.activeUniverseId);

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    // Extract @mention
    const mentionMatch = content.match(/^@(\S+)\s+(.*)/s);
    const body = mentionMatch
      ? { content: mentionMatch[2], to: mentionMatch[1] }
      : { content };

    setSending(true);
    try {
      await messagesApi.send(activeUniverseId, body);
      setText('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
  }

  return (
    <form onSubmit={send} style={{ padding: '8px 16px 12px', borderTop: '1px solid rgba(168,85,247,0.15)', display: 'flex', gap: 8 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Message all agents… or @AgentName to address one"
        rows={2}
        style={{
          flex: 1, resize: 'none',
          background: 'rgba(168,85,247,0.06)',
          border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: 6, padding: '8px 10px',
          fontFamily: 'monospace', fontSize: 13, color: '#e2d9f3',
          outline: 'none',
        }}
        disabled={sending}
      />
      <button type="submit" disabled={sending || !text.trim()} style={{
        padding: '0 16px', background: '#a855f7', color: '#04000a',
        border: 'none', borderRadius: 6, fontFamily: 'monospace',
        fontWeight: 700, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-end', height: 36,
      }}>
        Send
      </button>
    </form>
  );
}
