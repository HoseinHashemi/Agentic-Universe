import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/universeStore';

const LLM_COLOR  = new THREE.Color('#a855f7');
const RULE_COLOR = new THREE.Color('#86efac');
const IDLE_SCALE = 1;
const ACTIVE_SCALE = 1.6;

function AgentNode({ agent, position, isActive, onClick }) {
  const mesh = useRef();
  const color = agent.type === 'rule' ? RULE_COLOR : LLM_COLOR;

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const target = isActive ? ACTIVE_SCALE : IDLE_SCALE;
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), delta * 4);
  });

  return (
    <mesh ref={mesh} position={position} onClick={onClick}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isActive ? 1.2 : 0.4} />
    </mesh>
  );
}

function AgentLabel({ name, position }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '20px monospace';
    ctx.fillStyle = '#e2d9f3';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 40);
    return new THREE.CanvasTexture(canvas);
  }, [name]);

  return (
    <sprite position={[position[0], position[1] - 0.32, position[2]]} scale={[1.4, 0.35, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}

export default function AgentGraph({ onAgentClick }) {
  const agents   = useUniverseStore(s => s.agents);
  const thinking = useUniverseStore(s => s.thinking);

  const positions = useMemo(() => {
    const n = agents.length;
    return agents.map((_, i) => {
      const angle = (i / n) * Math.PI * 2;
      const r = Math.max(1.5, n * 0.4);
      return [Math.cos(angle) * r, Math.sin(angle) * r, 0];
    });
  }, [agents.length]);

  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 50 }} style={{ background: '#04000a' }}>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 5]} intensity={1} color="#a855f7" />

      {agents.map((agent, i) => (
        <React.Fragment key={agent.id}>
          <AgentNode
            agent={agent}
            position={positions[i]}
            isActive={!!thinking[agent.id]}
            onClick={() => onAgentClick(agent)}
          />
          <AgentLabel name={agent.name} position={positions[i]} />
        </React.Fragment>
      ))}

      {/* Draw lines between adjacent agents */}
      {agents.length > 1 && agents.map((_, i) => {
        const p1 = positions[i];
        const p2 = positions[(i + 1) % agents.length];
        const points = [new THREE.Vector3(...p1), new THREE.Vector3(...p2)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <line key={`line-${i}`} geometry={geo}>
            <lineBasicMaterial color="#a855f7" opacity={0.15} transparent />
          </line>
        );
      })}
    </Canvas>
  );
}
