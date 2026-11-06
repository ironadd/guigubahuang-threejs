import * as THREE from 'three';
import { createArenaFloorTexture, createBaguaTexture, createSparkTexture } from './textures.js';

export const ARENA_RADIUS = 41.5;

export class ImmortalArena {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.floatingRocks = [];
    this.braziers = [];
    this.time = 0;

    // 灯光系统
    this.ambientLight = new THREE.AmbientLight(0x526b8c, 1.35);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xdceeff, 1.85);
    this.dirLight.position.set(28, 52, 24);
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0xffbe6b, 0.9);
    this.rimLight.position.set(-32, 26, -28);
    this.scene.add(this.rimLight);

    // 天象状态插值
    this.targetFogColor = new THREE.Color(0x070b14);
    this.currentFogColor = new THREE.Color(0x070b14);
    this.targetAmbient = new THREE.Color(0x526b8c);
    this.moodTimer = 0;

    this.scene.fog = new THREE.FogExp2(0x070b14, 0.0082);
    this.scene.background = new THREE.Color(0x060911);

    this._buildPlatform();
    this._buildPillarsAndChains();
    this._buildDistantPeaks();
    this._buildAmbientSpiritDust();
    this._buildSkyPortal();
  }

  _buildPlatform() {
    const floorTex = createArenaFloorTexture();
    const floorGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 2.2, ARENA_RADIUS + 5.5, 4.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.78,
      metalness: 0.22,
      color: 0xb8cde0
    });
    const platform = new THREE.Mesh(floorGeo, floorMat);
    platform.position.y = -2.26;
    this.group.add(platform);

    // 仙台边缘鎏金八角护栏石阶环
    const rimGeo = new THREE.RingGeometry(ARENA_RADIUS - 0.35, ARENA_RADIUS + 1.6, 64);
    rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x2c394b,
      emissive: 0x223244,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.6
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.02;
    this.group.add(rim);

    // 仙台中央常驻古朴暗纹太极阵眼
    const centerBaguaTex = createBaguaTexture({
      mainColor: '#5fa8d3',
      subColor: '#d4af63',
      drawTaiji: true
    });
    const centerGeo = new THREE.PlaneGeometry(28, 28);
    centerGeo.rotateX(-Math.PI / 2);
    this.centerArrayMat = new THREE.MeshBasicMaterial({
      map: centerBaguaTex,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.centerArrayMesh = new THREE.Mesh(centerGeo, this.centerArrayMat);
    this.centerArrayMesh.position.y = 0.03;
    this.group.add(this.centerArrayMesh);

    // 场地边界灵力结界环（靠近时提醒边界）
    const barrierGeo = new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 3.2, 64, 1, true);
    this.barrierMat = new THREE.MeshBasicMaterial({
      color: 0x4ad8e8,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.barrierMesh = new THREE.Mesh(barrierGeo, this.barrierMat);
    this.barrierMesh.position.y = 1.6;
    this.group.add(this.barrierMesh);
  }

  _buildPillarsAndChains() {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1d2736,
      roughness: 0.7,
      metalness: 0.35
    });
    const goldTrimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xe8be68).multiplyScalar(1.3)
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x52f2e8).multiplyScalar(2.0),
      transparent: true,
      opacity: 0.9
    });

    const count = 8;
    const radius = ARENA_RADIUS + 2.8;
    const pillarPositions = [];

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(ang) * radius;
      const z = Math.sin(ang) * radius;
      pillarPositions.push(new THREE.Vector3(x, 0, z));

      const pGroup = new THREE.Group();
      pGroup.position.set(x, 0, z);
      pGroup.lookAt(0, 0, 0);

      const h = 9.5 + (i % 2) * 2.8;
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.6, 3.1), pillarMat);
      base.position.y = 0.8;
      pGroup.add(base);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.28, h, 8), pillarMat);
      shaft.position.y = h / 2 + 1.2;
      pGroup.add(shaft);

      // 柱身发光符文金环
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.07, 6, 16), goldTrimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h * 0.65;
      pGroup.add(ring);

      // 柱顶仙灵火盆核心
      const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 0), flameMat);
      flame.position.y = h + 2.2;
      pGroup.add(flame);
      this.braziers.push({ mesh: flame, baseY: h + 2.2, phase: i * 1.1 });

      // 断柱旁悬浮碎仙石
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65 + (i % 3) * 0.25, 0), pillarMat);
      rock.position.set((i % 2 === 0 ? 1 : -1) * 2.4, h + 3.6, -1.5);
      pGroup.add(rock);
      this.floatingRocks.push({ mesh: rock, baseY: h + 3.6, phase: i * 0.85 });

      this.group.add(pGroup);
    }

    // 相邻石柱之间的悬垂镇魔锁链弧线
    const chainMat = new THREE.LineBasicMaterial({
      color: 0x6c859e,
      transparent: true,
      opacity: 0.45
    });
    for (let i = 0; i < count; i++) {
      const p1 = pillarPositions[i].clone().setY(9.2);
      const p2 = pillarPositions[(i + 1) % count].clone().setY(9.2);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      mid.y = 5.6;
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const pts = curve.getPoints(18);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      this.group.add(new THREE.Line(lineGeo, chainMat));
    }
  }

  _buildDistantPeaks() {
    // 远景悬浮水墨孤峰群与深渊云海平面
    const peakMat = new THREE.MeshStandardMaterial({
      color: 0x0c1422,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const dist = 68 + Math.random() * 42;
      const h = 28 + Math.random() * 44;
      const r = 9 + Math.random() * 11;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), peakMat);
      cone.position.set(Math.cos(ang) * dist, h * 0.2 - 16, Math.sin(ang) * dist);
      cone.rotation.y = Math.random() * Math.PI;
      this.group.add(cone);
    }
  }

  _buildAmbientSpiritDust() {
    const count = 320;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * (ARENA_RADIUS + 18);
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 18 + 0.3;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.38,
      map: createSparkTexture(),
      color: 0x6ec7c0,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    this.dustPoints = new THREE.Points(geo, mat);
    this.group.add(this.dustPoints);
  }

  _buildSkyPortal() {
    // 禁用横亘在俯视相机前的高空巨型发光面片，避免挡镜头造成光污染
    const geo = new THREE.PlaneGeometry(1, 1);
    this.skyPortalMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.skyPortal = new THREE.Mesh(geo, this.skyPortalMat);
    this.skyPortal.visible = false;
    this.skyPortalTargetOpacity = 0;
  }

  setMood(mood, duration = 3.0) {
    this.moodTimer = duration;
    this.skyPortalTargetOpacity = 0;
    if (mood === 'divine') {
      this.targetFogColor.setHex(0x0d0b07);
      this.targetAmbient.setHex(0x6e6246);
    } else if (mood === 'immortal') {
      this.targetFogColor.setHex(0x110609);
      this.targetAmbient.setHex(0x6b3540);
    } else if (mood === 'domain') {
      this.targetFogColor.setHex(0x080f18);
      this.targetAmbient.setHex(0x58718a);
    } else if (mood === 'boss_enrage') {
      this.targetFogColor.setHex(0x100712);
      this.targetAmbient.setHex(0x5c3856);
    } else {
      this.targetFogColor.setHex(0x070b14);
      this.targetAmbient.setHex(0x526b8c);
    }
  }

  update(dt, playerPos) {
    this.time += dt;

    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      if (this.moodTimer <= 0) {
        this.setMood('normal', 0);
      }
    }

    // 平滑天象色彩过渡
    this.currentFogColor.lerp(this.targetFogColor, dt * 3.0);
    this.scene.fog.color.copy(this.currentFogColor);
    this.scene.background.copy(this.currentFogColor);
    this.ambientLight.color.lerp(this.targetAmbient, dt * 3.0);

    // 天门旋转渐显
    this.skyPortalMat.opacity += (this.skyPortalTargetOpacity - this.skyPortalMat.opacity) * Math.min(1, dt * 4);
    if (this.skyPortalMat.opacity > 0.01) {
      this.skyPortal.visible = true;
      this.skyPortal.rotation.y += dt * 0.65;
    } else {
      this.skyPortal.visible = false;
    }

    // 中央阵眼低速流转
    this.centerArrayMesh.rotation.y += dt * 0.08;

    // 仙火盆与浮石律动
    for (const b of this.braziers) {
      b.mesh.position.y = b.baseY + Math.sin(this.time * 3.2 + b.phase) * 0.22;
      b.mesh.rotation.y += dt * 2.2;
    }
    for (const r of this.floatingRocks) {
      r.mesh.position.y = r.baseY + Math.sin(this.time * 1.4 + r.phase) * 0.55;
      r.mesh.rotation.x += dt * 0.25;
      r.mesh.rotation.y += dt * 0.35;
    }

    // 灵尘缓慢升腾
    const posAttr = this.dustPoints.geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      let y = posAttr.getY(i) + dt * 0.65;
      if (y > 18.5) y = 0.3;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;

    // 玩家接近边界时结界微光提示
    if (playerPos) {
      const dist = Math.hypot(playerPos.x, playerPos.z);
      const edgeFactor = THREE.MathUtils.clamp((dist - (ARENA_RADIUS - 7)) / 7, 0, 1);
      this.barrierMat.opacity = 0.04 + edgeFactor * 0.24;
    }
  }
}
