import React, { useMemo } from 'react';
import * as THREE from 'three';

const STAR_COUNT = 200;

export default function StarField() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 4000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3000;
      positions[i * 3 + 2] = -200 - Math.random() * 400;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#aaaacc" size={1.5} sizeAttenuation opacity={0.4} transparent />
    </points>
  );
}
