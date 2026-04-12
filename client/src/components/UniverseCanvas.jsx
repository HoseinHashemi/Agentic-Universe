import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Scene from './scene/Scene';
import HUD from './hud/HUD';

export default function UniverseCanvas() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Three.js canvas — pointer-events disabled so HUD gets clicks */}
      <Canvas
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        camera={{ position: [0, 0, 800], fov: 60, near: 1, far: 10000 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#04000a');
        }}
      >
        <Scene />
        <OrbitControls
          enablePan
          enableZoom
          enableRotate={false}
          makeDefault
        />
      </Canvas>

      {/* HUD layer — pointer-events auto */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <HUD />
      </div>
    </div>
  );
}
