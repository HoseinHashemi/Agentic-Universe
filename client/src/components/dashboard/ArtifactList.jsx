import React, { useState } from 'react';
import { useUniverseStore } from '../../store/universeStore';

const typeColor = { text: '#9ca3af', code: '#22d3ee', data: '#86efac', plan: '#fbbf24' };

export default function ArtifactList() {
  const artifacts = useUniverseStore(s => s.artifacts);
  const [preview, setPreview] = useState(null);

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '0 4px' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', padding: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Artifacts</div>
      {artifacts.length === 0 && <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151', paddingTop: 16 }}>No artifacts yet</div>}
      {artifacts.map(art => (
        <div key={art.id} style={{ marginBottom: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
          onClick={() => setPreview(preview?.id === art.id ? null : art)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2d9f3' }}>{art.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: typeColor[art.type] || '#6b7280' }}>{art.type}</span>
          </div>
          {preview?.id === art.id && (
            <pre style={{ fontFamily: 'monospace', fontSize: 10, color: '#9ca3af', marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
              {art.content}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
