import * as THREE from 'three';
import { createSparkTexture } from './textures.js';

// 飞剑流光丝带拖尾类
export class SwordRibbon {
  constructor(scene, segments = 12, width = 0.34, colorHex = 0x68fff4) {
    this.scene = scene;
    this.segments = segments;
    this.width = width;
    this.points = [];
    for (let i = 0; i < segments; i++) {
      this.points.push(new THREE.Vector3());
    }

    const vertCount = segments * 2;
    const positions = new Float32Array(vertCount * 3);
    const colors = new Float32Array(vertCount * 3);
    const indices = [];

    const baseColor = new THREE.Color(colorHex).multiplyScalar(1.9);
    this.baseColor = baseColor;

    for (let i = 0; i < segments; i++) {
      const ratio = 1 - i / (segments - 1); // 1(头) -> 0(尾)
      const intensity = Math.pow(ratio, 1.5);
      for (let side = 0; side < 2; side++) {
        const idx = (i * 2 + side) * 3;
        colors[idx] = baseColor.r * intensity;
        colors[idx + 1] = baseColor.g * intensity;
        colors[idx + 2] = baseColor.b * intensity;
      }
      if (i < segments - 1) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setColor(colorHex, boost = 1.9) {
    const c = new THREE.Color(colorHex).multiplyScalar(boost);
    const colorAttr = this.mesh.geometry.attributes.color;
    for (let i = 0; i < this.segments; i++) {
      const ratio = 1 - i / (this.segments - 1);
      const intensity = Math.pow(ratio, 1.5);
      for (let side = 0; side < 2; side++) {
        const vi = i * 2 + side;
        colorAttr.setXYZ(vi, c.r * intensity, c.g * intensity, c.b * intensity);
      }
    }
    colorAttr.needsUpdate = true;
  }

  reset(pos) {
    for (let i = 0; i < this.segments; i++) {
      this.points[i].copy(pos);
    }
    this.updateGeometry();
    this.mesh.visible = true;
  }

  pushPoint(pos) {
    for (let i = this.segments - 1; i > 0; i--) {
      this.points[i].copy(this.points[i - 1]);
    }
    this.points[0].copy(pos);
    this.updateGeometry();
  }

  updateGeometry() {
    const posAttr = this.mesh.geometry.attributes.position;
    const up = _vUp;
    for (let i = 0; i < this.segments; i++) {
      const curr = this.points[i];
      const next = i < this.segments - 1 ? this.points[i + 1] : this.points[i - 1];
      _vDir.subVectors(curr, next);
      if (_vDir.lengthSq() < 0.00001) {
        _vDir.set(0, 0, 1);
      } else {
        _vDir.normalize();
      }
      _vSide.crossVectors(_vDir, up);
      if (_vSide.lengthSq() < 0.0001) _vSide.set(1, 0, 0);
      else _vSide.normalize();

      const taper = (1 - i / (this.segments - 1)) * this.width * 0.5;
      posAttr.setXYZ(i * 2, curr.x + _vSide.x * taper, curr.y + _vSide.y * taper, curr.z + _vSide.z * taper);
      posAttr.setXYZ(i * 2 + 1, curr.x - _vSide.x * taper, curr.y - _vSide.y * taper, curr.z - _vSide.z * taper);
    }
    posAttr.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

const _vUp = new THREE.Vector3(0, 1, 0);
const _vDir = new THREE.Vector3();
const _vSide = new THREE.Vector3();
const _projVec = new THREE.Vector3();

// 全局粒子、刀光波纹、雷电与飘字管理器
export class VFXManager {
  constructor(scene, camera, damageLayerEl) {
    this.scene = scene;
    this.camera = camera;
    this.damageLayer = damageLayerEl;

    this.transientMeshes = [];
    this.floatingTexts = [];
    this.textPool = [];
    this.lastTextTime = 0;

    // 共享几何体缓存
    this.ringGeo = new THREE.RingGeometry(0.76, 1.0, 42);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.discGeo = new THREE.CircleGeometry(1.0, 36);
    this.discGeo.rotateX(-Math.PI / 2);

    this.slashBarGeo = new THREE.PlaneGeometry(1.0, 0.14);

    this._initParticlePool(1800);
  }

  _initParticlePool(maxCount) {
    this.maxParticles = maxCount;
    this.pPos = new Float32Array(maxCount * 3);
    this.pCol = new Float32Array(maxCount * 3);
    this.pVel = new Float32Array(maxCount * 3);
    this.pLife = new Float32Array(maxCount);
    this.pMaxLife = new Float32Array(maxCount);
    this.pCursor = 0;

    for (let i = 0; i < maxCount; i++) {
      this.pPos[i * 3 + 1] = -999;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.72,
      map: createSparkTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particlePoints = new THREE.Points(geo, mat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }

  // 喷发剑气火花粒子
  burstParticles(pos, count = 14, colorHex = 0x7efcf4, speed = 12, lift = 5, life = 0.45) {
    const col = new THREE.Color(colorHex).multiplyScalar(1.6);
    for (let n = 0; n < count; n++) {
      const i = this.pCursor;
      this.pCursor = (this.pCursor + 1) % this.maxParticles;

      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.9) * speed;
      this.pPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.5;
      this.pPos[i * 3 + 1] = Math.max(0.15, pos.y + (Math.random() - 0.3) * 0.6);
      this.pPos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.5;

      this.pVel[i * 3] = Math.cos(ang) * spd;
      this.pVel[i * 3 + 1] = (Math.random() * 0.8 + 0.2) * lift;
      this.pVel[i * 3 + 2] = Math.sin(ang) * spd;

      const l = life * (0.65 + Math.random() * 0.6);
      this.pLife[i] = l;
      this.pMaxLife[i] = l;

      this.pCol[i * 3] = col.r;
      this.pCol[i * 3 + 1] = col.g;
      this.pCol[i * 3 + 2] = col.b;
    }
  }

  // 环形扩散剑气冲击波
  spawnShockwave(pos, maxRadius = 6, colorHex = 0x6cf7ee, duration = 0.42, y = 0.08) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(2.1),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(pos.x, y, pos.z);
    mesh.scale.setScalar(0.3);
    this.scene.add(mesh);

    this.transientMeshes.push({
      mesh,
      age: 0,
      duration,
      onUpdate(t) {
        const ease = 1 - Math.pow(1 - t, 3);
        mesh.scale.setScalar(0.3 + ease * maxRadius);
        mat.opacity = (1 - t) * 0.9;
      }
    });
  }

  // 飞剑命中十字斩裂闪光
  spawnHitSlash(pos, colorHex = 0x9ffff8, scale = 2.6) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.set(
      (Math.random() - 0.5) * 0.8,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.8
    );

    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(2.5),
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const m1 = new THREE.Mesh(this.slashBarGeo, mat);
    m1.scale.set(scale, 1.2, 1);
    const m2 = new THREE.Mesh(this.slashBarGeo, mat);
    m2.scale.set(scale * 0.75, 1.0, 1);
    m2.rotation.z = Math.PI * 0.42;
    group.add(m1, m2);
    this.scene.add(group);

    this.transientMeshes.push({
      mesh: group,
      mat,
      age: 0,
      duration: 0.16,
      onUpdate(t) {
        group.scale.setScalar(0.6 + t * 0.9);
        mat.opacity = 1 - t;
      }
    });
  }

  // 地面残留发光剑痕
  spawnGroundScar(pos, angle, length = 8, width = 0.45, colorHex = 0xffcf6e, duration = 2.2) {
    const geo = new THREE.PlaneGeometry(length, width);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(1.8),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.05, pos.z);
    mesh.rotation.y = angle;
    this.scene.add(mesh);

    this.transientMeshes.push({
      mesh,
      ownGeo: geo,
      mat,
      age: 0,
      duration,
      onUpdate(t) {
        mat.opacity = (1 - Math.pow(t, 1.6)) * 0.85;
      }
    });
  }

  // 紫霄神雷 / 诛仙雷光柱连接线
  spawnLightning(p1, p2, colorHex = 0x8cc2ff, segments = 9, jitter = 0.75, duration = 0.22) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const v = new THREE.Vector3().lerpVectors(p1, p2, t);
      if (i > 0 && i < segments) {
        v.x += (Math.random() - 0.5) * jitter * 2;
        v.y += (Math.random() - 0.5) * jitter;
        v.z += (Math.random() - 0.5) * jitter * 2;
      }
      pts.push(v);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(2.6),
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.transientMeshes.push({
      mesh: line,
      ownGeo: geo,
      mat,
      age: 0,
      duration,
      onUpdate(t) {
        mat.opacity = 1 - t;
      }
    });
  }

  // 太上诛仙阵专属：立体空间裂痕次元斩带
  spawnDimensionRift(p1, p2, colorHex = 0xff3b56, heightWidth = 0.7, duration = 0.55) {
    const dist = p1.distanceTo(p2);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const geo = new THREE.PlaneGeometry(dist, heightWidth);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(2.8),
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.lookAt(p2);
    mesh.rotateY(Math.PI / 2);
    mesh.rotateX((Math.random() - 0.5) * 1.2);
    this.scene.add(mesh);

    this.transientMeshes.push({
      mesh,
      ownGeo: geo,
      mat,
      age: 0,
      duration,
      onUpdate(t) {
        mesh.scale.y = (1 - t) * 1.4;
        mat.opacity = 1 - t * t;
      }
    });
  }

  // 垂直通天剑柱光束（天罡落剑、诛仙爆柱）
  spawnSkyPillar(pos, radius = 1.6, height = 34, colorHex = 0xffd573, duration = 0.55) {
    const geo = new THREE.CylinderGeometry(radius * 0.65, radius, height, 18, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex).multiplyScalar(2.2),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, height * 0.5, pos.z);
    this.scene.add(mesh);

    this.transientMeshes.push({
      mesh,
      ownGeo: geo,
      mat,
      age: 0,
      duration,
      onUpdate(t) {
        const s = 1 - t * 0.65;
        mesh.scale.set(s, 1, s);
        mat.opacity = (1 - t) * 0.85;
      }
    });
  }

  // 屏幕伤害飘字（高性能 DOM 对象池）
  spawnDamageText(worldPos, value, type = 'normal', label = '') {
    const now = performance.now();
    // 普通小伤害适当节流防同帧挤爆，大招和暴击不漏
    if (type === 'normal' && this.floatingTexts.length > 42 && now - this.lastTextTime < 22) {
      return;
    }
    this.lastTextTime = now;

    _projVec.copy(worldPos);
    _projVec.y += 2.2 + Math.random() * 1.2;
    _projVec.project(this.camera);
    if (_projVec.z > 1) return;

    const sx = (_projVec.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 38;
    const sy = (-_projVec.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 20;

    if (sx < -60 || sx > window.innerWidth + 60 || sy < -40 || sy > window.innerHeight + 40) return;

    let el = this.textPool.pop();
    if (!el) {
      el = document.createElement('div');
      this.damageLayer.appendChild(el);
    }

    const formatted = Math.round(value).toLocaleString('en-US');
    el.className = `dmg-num dmg-${type}`;
    el.textContent = label ? `${label} ${formatted}` : formatted;
    el.style.display = 'block';

    this.floatingTexts.push({
      el,
      x: sx,
      y: sy,
      vx: (Math.random() - 0.5) * 34,
      vy: -58 - Math.random() * 36,
      age: 0,
      duration: type === 'immortal' ? 1.05 : 0.72,
      scale: type === 'crit' || type === 'immortal' ? 1.28 : 1.0
    });
  }

  update(dt) {
    // 1. 更新瞬态光效网格
    for (let i = this.transientMeshes.length - 1; i >= 0; i--) {
      const item = this.transientMeshes[i];
      item.age += dt;
      const t = Math.min(1, item.age / item.duration);
      item.onUpdate(t);
      if (item.age >= item.duration) {
        this.scene.remove(item.mesh);
        if (item.ownGeo) item.ownGeo.dispose();
        if (item.mat) item.mat.dispose();
        else if (item.mesh.material) item.mesh.material.dispose();
        this.transientMeshes.splice(i, 1);
      }
    }

    // 2. 更新粒子池
    const posAttr = this.particlePoints.geometry.attributes.position;
    const colAttr = this.particlePoints.geometry.attributes.color;
    let activeAny = false;
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.pLife[i] > 0) {
        activeAny = true;
        this.pLife[i] -= dt;
        if (this.pLife[i] <= 0) {
          this.pPos[i * 3 + 1] = -999;
        } else {
          this.pPos[i * 3] += this.pVel[i * 3] * dt;
          this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
          this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
          this.pVel[i * 3 + 1] -= 9.5 * dt; // 轻灵微重力
          if (this.pPos[i * 3 + 1] < 0.08) {
            this.pPos[i * 3 + 1] = 0.08;
            this.pVel[i * 3 + 1] *= -0.35;
          }
          const fade = this.pLife[i] / this.pMaxLife[i];
          colAttr.setXYZ(
            i,
            this.pCol[i * 3] * fade,
            this.pCol[i * 3 + 1] * fade,
            this.pCol[i * 3 + 2] * fade
          );
        }
      }
    }
    if (activeAny) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // 3. 更新屏幕伤害飘字
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      const t = ft.age / ft.duration;
      if (t >= 1) {
        ft.el.style.display = 'none';
        this.textPool.push(ft.el);
        this.floatingTexts.splice(i, 1);
      } else {
        ft.x += ft.vx * dt;
        ft.y += ft.vy * dt;
        ft.vy += 48 * dt;
        const opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
        const s = ft.scale * (t < 0.15 ? 0.7 + t * 2.5 : 1.0);
        ft.el.style.opacity = opacity.toFixed(2);
        ft.el.style.transform = `translate3d(${ft.x.toFixed(1)}px, ${ft.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(2)})`;
      }
    }
  }
}
