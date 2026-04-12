import React from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

function ZoomLabel() {
  const { camera } = useThree();
  const z = camera.position.z;
  const mode = z > 800 ? 'overview' : z > 200 ? 'cluster' : 'track';
  const zoom = Math.round(800 / Math.max(z, 1) * 10) / 10;

  return (
    <div style={{
      position: 'fixed', bottom: 54, right: 12,
      background: 'rgba(4,0,10,0.75)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 6, padding: '4px 10px',
      color: '#9ca3af', fontSize: 11, fontFamily: 'monospace',
      pointerEvents: 'none',
    }}>
      {zoom}× · {mode}
    </div>
  );
}

export default function ZoomIndicator() {
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <ZoomLabel />
    </Html>
  );
}
