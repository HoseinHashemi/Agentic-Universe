import React, { useState } from 'react';
import { useUniverseStore } from '../store/universeStore';
import { universes as universesApi } from '../api/universes';

export default function RefineInput() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const { activeUniverseId } = useUniverseStore();

  async function submit(e) {
    e.preventDefault();
    const instruction = text.trim();
    if (!instruction || loading) return;
    setLoading(true);
    try {
      const data = await universesApi.refine(activeUniverseId, { instruction });
      // Merge new agents into store
      if (data.new_agents?.length) {
        const store = useUniverseStore.getState();
        useUniverseStore.setState({ agents: [...store.agents, ...data.new_agents] });
      }
      setText('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: '6px 16px', borderTop: '1px dashed rgba(168,85,247,0.2)', alignItems: 'center' }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Modify your universe… e.g. 'make Sam more aggressive' or 'add a legal expert'"
        disabled={loading}
        style={{
          flex: 1, background: 'transparent',
          border: 'none', outline: 'none',
          fontFamily: 'monospace', fontSize: 12, color: '#9ca3af',
        }}
      />
      <button type="submit" disabled={loading || !text.trim()} style={{
        padding: '3px 12px', background: 'transparent',
        border: '1px dashed rgba(168,85,247,0.4)', borderRadius: 4,
        fontFamily: 'monospace', fontSize: 11, color: '#a855f7', cursor: 'pointer',
      }}>
        {loading ? '…' : 'Refine'}
      </button>
    </form>
  );
}
