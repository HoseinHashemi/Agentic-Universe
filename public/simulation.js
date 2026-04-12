import * as THREE from '/vendor/three/three.module.min.js';

const TRAIL_MAX   = 3000;
const EFFECT_POOL = 80;
const EFFECT_LIFE = 22; // ticks

function makeSpriteTexture(color, glowRadius = 18) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    color + 'ff');
  g.addColorStop(0.3,  color + 'cc');
  g.addColorStop(0.7,  color + '44');
  g.addColorStop(1,    color + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function hexToThree(hex) {
  return new THREE.Color(hex);
}

/**
 * SimView — renders one simulation slot in a given DOM container.
 */
export class SimView {
  constructor(container) {
    this._container = container;
    this._w = 0;
    this._h = 0;

    // Three.js
    this._renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this._renderer.domElement);

    this._scene  = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this._camera.position.z = 10;

    // World config (set on first state)
    this._worldW = 800;
    this._worldH = 600;

    // Agents: Map<id, THREE.Sprite>
    this._sprites = new Map();
    this._texCache = new Map(); // typeId → texture

    // Trail geometry
    this._trailPositions = new Float32Array(TRAIL_MAX * 3);
    this._trailColors    = new Float32Array(TRAIL_MAX * 3);
    this._trailHead = 0;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(this._trailColors, 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.PointsMaterial({
      size: 2, vertexColors: true, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false,
    });
    this._trailPoints = new THREE.Points(trailGeo, trailMat);
    this._scene.add(this._trailPoints);

    // Effects pool
    this._effects = [];
    for (let i = 0; i < EFFECT_POOL; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(1, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      mesh.visible = false;
      mesh._life = 0;
      this._scene.add(mesh);
      this._effects.push(mesh);
    }

    // Stars background
    this._addStars();

    // World boundary
    this._boundaryLine = null;

    // Agent type colors map: typeId → hex
    this._typeColors = {};

    this._animId = null;
    this._needsRender = false;
    this._startLoop();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);
    this._resize();
  }

  // ── State update ────────────────────────────────────────────────────────────

  applyState(state) {
    if (!state) return;

    const cfg = state.universeConfig;
    if (cfg) {
      this._worldW = cfg.worldWidth  || 800;
      this._worldH = cfg.worldHeight || 600;
      this._updateBoundary();

      for (const t of (cfg.agentTypes || [])) {
        this._typeColors[t.id] = t.color || '#ffffff';
      }
    }

    const agentData = state.agents || [];
    const seenIds = new Set();

    for (const a of agentData) {
      seenIds.add(a.id);
      const wx = (a.x / this._worldW) * 2 - 1;
      const wy = -((a.y / this._worldH) * 2 - 1);
      const wx3 = wx * (this._w / 2);
      const wy3 = wy * (this._h / 2);

      if (!this._sprites.has(a.id)) {
        const tex = this._getTexture(a.typeId);
        const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(10, 10, 1);
        this._scene.add(sprite);
        this._sprites.set(a.id, sprite);
      }

      const sp = this._sprites.get(a.id);
      sp.position.set(wx3, wy3, 1);

      // Scale by energy
      const energyRatio = Math.max(0.5, Math.min(1.5, (a.energy || 50) / 100));
      sp.scale.set(10 * energyRatio, 10 * energyRatio, 1);

      // Trail
      this._addTrailPoint(wx3, wy3, a.typeId);
    }

    // Remove stale sprites
    for (const [id, sp] of this._sprites) {
      if (!seenIds.has(id)) { this._scene.remove(sp); this._sprites.delete(id); }
    }

    this._needsRender = true;
  }

  applyEvents(events) {
    if (!events?.length) return;
    for (const ev of events) {
      if (ev.type === 'eat' || ev.type === 'reproduce' || ev.type === 'die') {
        this._spawnEffect(ev);
      }
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _getTexture(typeId) {
    if (!this._texCache.has(typeId)) {
      const color = this._typeColors[typeId] || '#ffffff';
      this._texCache.set(typeId, makeSpriteTexture(color));
    }
    return this._texCache.get(typeId);
  }

  _invalidateTextures() {
    for (const [, tex] of this._texCache) tex.dispose();
    this._texCache.clear();
    for (const [, sp] of this._sprites) {
      const typeId = sp._typeId;
      if (typeId) sp.material.map = this._getTexture(typeId);
    }
  }

  _addTrailPoint(x, y, typeId) {
    const slot = this._trailHead % TRAIL_MAX;
    this._trailPositions[slot * 3]     = x;
    this._trailPositions[slot * 3 + 1] = y;
    this._trailPositions[slot * 3 + 2] = 0;
    const col = hexToThree(this._typeColors[typeId] || '#ffffff');
    this._trailColors[slot * 3]     = col.r * 0.4;
    this._trailColors[slot * 3 + 1] = col.g * 0.4;
    this._trailColors[slot * 3 + 2] = col.b * 0.4;
    this._trailHead++;

    const geo = this._trailPoints.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate    = true;
    geo.setDrawRange(0, Math.min(this._trailHead, TRAIL_MAX));
  }

  _spawnEffect(ev) {
    const eff = this._effects.find(e => !e.visible);
    if (!eff) return;
    const wx = (ev.x / this._worldW) * 2 - 1;
    const wy = -((ev.y / this._worldH) * 2 - 1);
    eff.position.set(wx * (this._w / 2), wy * (this._h / 2), 2);
    const col = new THREE.Color(ev.color || '#ffffff');
    eff.material.color.copy(col);
    eff.material.opacity = ev.type === 'die' ? 0.9 : 0.6;
    eff.scale.set(ev.type === 'die' ? 8 : 5, ev.type === 'die' ? 8 : 5, 1);
    eff.visible = true;
    eff._life = EFFECT_LIFE;
    eff._maxLife = EFFECT_LIFE;
  }

  _tickEffects() {
    for (const eff of this._effects) {
      if (!eff.visible) continue;
      eff._life--;
      const t = eff._life / eff._maxLife;
      eff.material.opacity = t * (eff._maxLife === EFFECT_LIFE ? 0.9 : 0.6);
      eff.scale.multiplyScalar(1.08);
      if (eff._life <= 0) { eff.visible = false; }
    }
  }

  _addStars() {
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 2000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      pos[i * 3 + 2] = -1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x334466, size: 1.5, sizeAttenuation: false });
    this._scene.add(new THREE.Points(geo, mat));
  }

  _updateBoundary() {
    if (this._boundaryLine) { this._scene.remove(this._boundaryLine); }
    const hw = this._worldW / 2, hh = this._worldH / 2;
    const scaleX = this._w / this._worldW;
    const scaleY = this._h / this._worldH;
    const bw = this._worldW * Math.min(scaleX, scaleY) / 2;
    const bh = this._worldH * Math.min(scaleX, scaleY) / 2;
    // Use pixel coords after resize maps world → screen
    const pts = [
      new THREE.Vector3(-this._w / 2, -this._h / 2, 0),
      new THREE.Vector3( this._w / 2, -this._h / 2, 0),
      new THREE.Vector3( this._w / 2,  this._h / 2, 0),
      new THREE.Vector3(-this._w / 2,  this._h / 2, 0),
      new THREE.Vector3(-this._w / 2, -this._h / 2, 0),
    ];
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const mat  = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.5 });
    this._boundaryLine = new THREE.Line(geo, mat);
    this._scene.add(this._boundaryLine);
  }

  _resize() {
    const rect = this._container.getBoundingClientRect();
    this._w = rect.width;
    this._h = rect.height;
    this._renderer.setSize(this._w, this._h);
    this._camera.left   = -this._w / 2;
    this._camera.right  =  this._w / 2;
    this._camera.top    =  this._h / 2;
    this._camera.bottom = -this._h / 2;
    this._camera.updateProjectionMatrix();
    this._updateBoundary();
    this._needsRender = true;
  }

  _startLoop() {
    const loop = () => {
      this._animId = requestAnimationFrame(loop);
      this._tickEffects();
      if (this._needsRender || this._effects.some(e => e.visible)) {
        this._renderer.render(this._scene, this._camera);
        this._needsRender = false;
      }
    };
    loop();
  }

  destroy() {
    cancelAnimationFrame(this._animId);
    this._ro.disconnect();
    this._renderer.dispose();
    this._container.removeChild(this._renderer.domElement);
  }
}
