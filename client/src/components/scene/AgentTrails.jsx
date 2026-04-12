import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';

const TRAIL_LENGTH = 8;
const MAX_AGENTS   = 500;

// Per-agent ring buffers
const trailBuffers = new Map(); // agentId → Float32Array[TRAIL_LENGTH * 3]
const trailColors  = new Map(); // agentId → THREE.Color

const ROLE_COLOR = {
  producer: '#84cc16',
  consumer: '#a855f7',
  predator: '#f97316',
};

export default function AgentTrails() {
  const linesRef = useRef();

  // Max segments: MAX_AGENTS × (TRAIL_LENGTH - 1) × 2 vertices per segment
  const maxVerts = MAX_AGENTS * (TRAIL_LENGTH - 1) * 2;
  const posArr   = useRef(new Float32Array(maxVerts * 3));
  const colArr   = useRef(new Float32Array(maxVerts * 3));

  const geometry = useRef(new THREE.BufferGeometry());

  useEffect(() => {
    const geo = geometry.current;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colArr.current, 3));
    return () => geo.dispose();
  }, []);

  useFrame(() => {
    const agents = useSimulationStore.getState().agents;
    const seen = new Set();
    let vi = 0; // vertex index

    for (const agent of agents) {
      if (vi >= maxVerts) break;
      seen.add(agent.id);

      // Initialise buffer for new agent
      if (!trailBuffers.has(agent.id)) {
        trailBuffers.set(agent.id, new Float32Array(TRAIL_LENGTH * 3));
        trailColors.set(agent.id, new THREE.Color(ROLE_COLOR[agent.role] ?? '#ffffff'));
      }

      const buf = trailBuffers.get(agent.id);
      const col = trailColors.get(agent.id);

      // Shift positions back (ring = newest at index 0)
      for (let j = TRAIL_LENGTH - 1; j > 0; j--) {
        buf[j * 3]     = buf[(j - 1) * 3];
        buf[j * 3 + 1] = buf[(j - 1) * 3 + 1];
        buf[j * 3 + 2] = 0;
      }
      buf[0] = agent.x - 400;
      buf[1] = -(agent.y - 300);
      buf[2] = 0;

      // Write line segments (pairs of vertices)
      for (let seg = 0; seg < TRAIL_LENGTH - 1; seg++) {
        const alpha = 1 - seg / TRAIL_LENGTH;
        // start of segment
        posArr.current[vi * 3]     = buf[seg * 3];
        posArr.current[vi * 3 + 1] = buf[seg * 3 + 1];
        posArr.current[vi * 3 + 2] = 0;
        colArr.current[vi * 3]     = col.r * alpha;
        colArr.current[vi * 3 + 1] = col.g * alpha;
        colArr.current[vi * 3 + 2] = col.b * alpha;
        vi++;
        // end of segment
        posArr.current[vi * 3]     = buf[(seg + 1) * 3];
        posArr.current[vi * 3 + 1] = buf[(seg + 1) * 3 + 1];
        posArr.current[vi * 3 + 2] = 0;
        colArr.current[vi * 3]     = col.r * alpha * 0.4;
        colArr.current[vi * 3 + 1] = col.g * alpha * 0.4;
        colArr.current[vi * 3 + 2] = col.b * alpha * 0.4;
        vi++;
      }
    }

    // Clean up dead agents
    for (const id of trailBuffers.keys()) {
      if (!seen.has(id)) { trailBuffers.delete(id); trailColors.delete(id); }
    }

    geometry.current.setDrawRange(0, vi);
    geometry.current.attributes.position.needsUpdate = true;
    geometry.current.attributes.color.needsUpdate    = true;
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry.current}>
      <lineBasicMaterial vertexColors transparent opacity={0.6} />
    </lineSegments>
  );
}
