import React from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function PostFX() {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.4}
        luminanceSmoothing={0.9}
        intensity={1.2}
        radius={0.8}
      />
    </EffectComposer>
  );
}
