import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';

// Role → Cosmic Void color
const ROLE_COLOR = {
  producer: '#84cc16',
  consumer: '#a855f7',
  predator: '#f97316',
};

function colorForAgent(agent) {
  return ROLE_COLOR[agent.role] ?? '#ffffff';
}

export default function AgentPoints() {
  const pointsRef = useRef();
  const agents = useSimulationStore((s) => s.agents);

  const maxAgents = 2000;

  const { positions, colors } = useMemo(() => ({
    positions: new Float32Array(maxAgents * 3),
    colors:    new Float32Array(maxAgents * 3),
  }), []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    return geo;
  }, []);

  useFrame(() => {
    const count = Math.min(agents.length, maxAgents);
    const _color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const a = agents[i];
      positions[i * 3]     = a.x - 400;   // centre world
      positions[i * 3 + 1] = -(a.y - 300);
      positions[i * 3 + 2] = 0;
      _color.set(colorForAgent(a));
      colors[i * 3]     = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setDrawRange(0, count);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate    = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={6}
        sizeAttenuation
        transparent
        opacity={0.95}
      />
    </points>
  );
}
