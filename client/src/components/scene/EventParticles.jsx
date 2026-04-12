import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Simple particle burst: each burst is a set of points that expand and fade
class Burst {
  constructor(x, y, color, count = 12) {
    this.x = x; this.y = y;
    this.color = new THREE.Color(color);
    this.age = 0;
    this.maxAge = 30;
    this.particles = Array.from({ length: count }, () => ({
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      x: 0, y: 0,
    }));
  }
  isDead() { return this.age >= this.maxAge; }
}

// Global burst queue (written to from outside React, read in useFrame)
export const burstQueue = [];

const MAX_BURSTS = 40;
const PARTICLES_PER_BURST = 12;
const MAX_VERTS = MAX_BURSTS * PARTICLES_PER_BURST;

export default function EventParticles() {
  const bursts = useRef([]);
  const posArr = useRef(new Float32Array(MAX_VERTS * 3));
  const colArr = useRef(new Float32Array(MAX_VERTS * 3));

  const geo = useRef(new THREE.BufferGeometry());
  useEffect(() => {
    geo.current.setAttribute('position', new THREE.BufferAttribute(posArr.current, 3));
    geo.current.setAttribute('color',    new THREE.BufferAttribute(colArr.current, 3));
    return () => geo.current.dispose();
  }, []);

  useFrame(() => {
    // Ingest new bursts
    while (burstQueue.length && bursts.current.length < MAX_BURSTS) {
      bursts.current.push(burstQueue.shift());
    }
    // Advance & remove dead
    bursts.current = bursts.current.filter(b => !b.isDead());

    let vi = 0;
    for (const burst of bursts.current) {
      burst.age++;
      const alpha = 1 - burst.age / burst.maxAge;
      for (const p of burst.particles) {
        p.x += p.vx;
        p.y += p.vy;
        posArr.current[vi * 3]     = burst.x + p.x - 400;
        posArr.current[vi * 3 + 1] = -(burst.y + p.y - 300);
        posArr.current[vi * 3 + 2] = 1;
        colArr.current[vi * 3]     = burst.color.r * alpha;
        colArr.current[vi * 3 + 1] = burst.color.g * alpha;
        colArr.current[vi * 3 + 2] = burst.color.b * alpha;
        vi++;
      }
    }
    geo.current.setDrawRange(0, vi);
    geo.current.attributes.position.needsUpdate = true;
    geo.current.attributes.color.needsUpdate    = true;
  });

  return (
    <points geometry={geo.current}>
      <pointsMaterial vertexColors size={4} sizeAttenuation transparent />
    </points>
  );
}
