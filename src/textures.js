import * as THREE from 'three';

// 1. 太极八卦星宿大阵贴图（用于道魂领域、诛仙法阵、仙台阵眼）
export function createBaguaTexture({
  mainColor = '#ffd875',
  subColor = '#5bf0e6',
  runeText = '乾坤震巽坎离艮兑天地玄黄宇宙洪荒临兵斗者皆阵列前行太虚万剑归宗',
  drawTaiji = true
} = {}) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.shadowColor = mainColor;
  ctx.shadowBlur = 4;

  // 多重同心阵环
  const rings = [
    { r: 482, w: 5, color: mainColor, dash: [] },
    { r: 465, w: 2, color: subColor, dash: [12, 8] },
    { r: 412, w: 4, color: mainColor, dash: [] },
    { r: 396, w: 2, color: mainColor, dash: [6, 6] },
    { r: 305, w: 3.5, color: subColor, dash: [] },
    { r: 215, w: 3, color: mainColor, dash: [] },
    { r: 128, w: 3, color: mainColor, dash: [] }
  ];

  rings.forEach((ring) => {
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.w;
    ctx.setLineDash(ring.dash);
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 八芒星交错阵纹线 (两个旋转45度的正方形)
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 2.6;
  for (let offset = 0; offset < 2; offset++) {
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const ang = (i * Math.PI) / 2 + (offset * Math.PI) / 4;
      const x = cx + Math.cos(ang) * 395;
      const y = cy + Math.sin(ang) * 395;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 放射状八方剑脉线
  for (let i = 0; i < 16; i++) {
    const ang = (i * Math.PI) / 8;
    ctx.strokeStyle = i % 2 === 0 ? mainColor : subColor;
    ctx.lineWidth = i % 2 === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 130, cy + Math.sin(ang) * 130);
    ctx.lineTo(cx + Math.cos(ang) * 480, cy + Math.sin(ang) * 480);
    ctx.stroke();
  }

  // 外环古篆符文圈
  ctx.fillStyle = mainColor;
  ctx.font = 'bold 28px "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = runeText.split('');
  const count = 32;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * 438, cy + Math.sin(ang) * 438);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(chars[i % chars.length], 0, 0);
    ctx.restore();
  }

  // 先天八卦三爻符号绘制
  const trigrams = [
    [1, 1, 1], // 乾
    [0, 1, 1], // 兑
    [1, 0, 1], // 离
    [0, 0, 1], // 震
    [1, 1, 0], // 巽
    [0, 1, 0], // 坎
    [1, 0, 0], // 艮
    [0, 0, 0]  // 坤
  ];
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * 260, cy + Math.sin(ang) * 260);
    ctx.rotate(ang + Math.PI / 2);
    const lines = trigrams[i];
    for (let row = 0; row < 3; row++) {
      const y = (row - 1) * 15;
      if (lines[row] === 1) {
        ctx.beginPath();
        ctx.moveTo(-26, y);
        ctx.lineTo(26, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-26, y);
        ctx.lineTo(-6, y);
        ctx.moveTo(6, y);
        ctx.lineTo(26, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 中心太极阴阳纹
  if (drawTaiji) {
    const r = 98;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = mainColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // 阳鱼半弧（清透薄染不遮挡地面与预警圈）
    ctx.fillStyle = mainColor;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    ctx.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
    ctx.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
    ctx.closePath();
    ctx.fill();

    // 双鱼眼
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = subColor;
    ctx.beginPath();
    ctx.arc(cx, cy - r / 2, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(cx, cy + r / 2, 13, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// 2. 荒古青石仙台地面纹理
export function createArenaFloorTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  // 深水墨玄武青石底色
  const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 512);
  grad.addColorStop(0, '#1a2533');
  grad.addColorStop(0.55, '#121924');
  grad.addColorStop(1, '#090d14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 石板噪点肌理
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 2 + Math.random() * 6;
    const alpha = Math.random() * 0.055;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(160, 195, 225, ${alpha})` : `rgba(0, 0, 0, ${alpha * 1.8})`;
    ctx.fillRect(x, y, w, w);
  }

  // 环形青石砖缝与灵脉暗金刻线
  ctx.strokeStyle = 'rgba(72, 108, 135, 0.34)';
  ctx.lineWidth = 2;
  for (let r = 80; r <= 490; r += 58) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const segs = Math.floor(r / 16);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + (r % 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + 58), cy + Math.sin(a) * (r + 58));
      ctx.stroke();
    }
  }

  // 仙台八方古阵暗金纹
  ctx.strokeStyle = 'rgba(218, 178, 96, 0.28)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 472, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
    ctx.lineTo(cx + Math.cos(a) * 472, cy + Math.sin(a) * 472);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 3. 十字星芒辉光粒子贴图
export function createSparkTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.22, 'rgba(255,250,220,0.85)');
  grad.addColorStop(0.55, 'rgba(160,225,255,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 十字星芒锐利核心
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(c, c, c * 0.88, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c, c, 3.2, c * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// 4. 鬼谷红圈预警纹理（圆形）
export function createDangerCircleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, 10, c, c, 120);
  grad.addColorStop(0, 'rgba(225, 25, 35, 0.14)');
  grad.addColorStop(0.75, 'rgba(235, 30, 35, 0.34)');
  grad.addColorStop(0.95, 'rgba(255, 75, 55, 0.85)');
  grad.addColorStop(1, 'rgba(255, 90, 60, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, 122, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 115, 85, 0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, 118, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 96, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// 5. 生成弯月形剑气波 BufferGeometry（两头尖锐、中间弧度饱满）
export function createCrescentSlashGeometry(radius = 3.2, width = 1.25, arc = Math.PI * 0.78, segments = 28) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 -> 1
    const angle = (t - 0.5) * arc;
    // 两端收尖的正弦包络
    const profile = Math.sin(t * Math.PI);
    const innerR = radius - width * profile * 0.85;
    const outerR = radius + width * profile * 0.28;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // 内侧顶点 (渐隐尾部)
    positions.push(sin * innerR, 0, cos * innerR);
    uvs.push(t, 0);
    colors.push(profile * 0.25, profile * 0.25, profile * 0.25);

    // 外侧锋刃顶点 (高亮刀锋)
    positions.push(sin * outerR, 0, cos * outerR);
    uvs.push(t, 1);
    colors.push(profile, profile, profile);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// 仙剑共享几何体与材质缓存（保证万剑齐发零显存泄漏）
let _cachedSwordGeos = null;
const _swordMatCache = new Map();

function _getSwordGeos() {
  if (_cachedSwordGeos) return _cachedSwordGeos;

  const bladeShape = new THREE.BufferGeometry();
  const bl = 2.15;
  const bw = 0.16;
  const bt = 0.055;
  const verts = new Float32Array([
    0, 0, bl,
    -bw * 0.85, 0, bl * 0.68,
    bw * 0.85, 0, bl * 0.68,
    0, bt, bl * 0.5,
    0, -bt, bl * 0.5,
    -bw, 0, 0,
    bw, 0, 0,
    0, bt * 1.15, 0,
    0, -bt * 1.15, 0
  ]);
  const idx = [
    0, 3, 1, 0, 2, 3, 0, 1, 4, 0, 4, 2,
    1, 3, 7, 1, 7, 5, 3, 2, 6, 3, 6, 7,
    1, 5, 8, 1, 8, 4, 4, 8, 6, 4, 6, 2,
    5, 7, 6, 5, 6, 8
  ];
  bladeShape.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  bladeShape.setIndex(idx);
  bladeShape.computeVertexNormals();

  const coreGeo = new THREE.BoxGeometry(0.05, 0.075, bl * 0.86);
  coreGeo.translate(0, 0, bl * 0.43);

  const guardGeo = new THREE.BoxGeometry(0.58, 0.11, 0.14);
  const wingGeo = new THREE.ConeGeometry(0.08, 0.24, 4);

  const gripGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.48, 6);
  gripGeo.rotateX(Math.PI / 2);
  gripGeo.translate(0, 0, -0.32);

  const pommelGeo = new THREE.OctahedronGeometry(0.085, 0);

  _cachedSwordGeos = { bladeShape, coreGeo, guardGeo, wingGeo, gripGeo, pommelGeo };
  return _cachedSwordGeos;
}

function _getSwordMat(hex, mult) {
  const key = `${hex}_${mult.toFixed(2)}`;
  let mat = _swordMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(mult)
    });
    _swordMatCache.set(key, mat);
  }
  return mat;
}

// 6. 构建精致古风仙剑 3D 模型（剑尖朝向 +Z 轴，清透玉铁质感不刺眼）
export function createImmortalSwordMesh({
  bladeColor = 0x5cdbd3,
  coreColor = 0xe8fbff,
  guardColor = 0xc99b42,
  scale = 1.0,
  glowIntensity = 0.95
} = {}) {
  const geos = _getSwordGeos();
  const group = new THREE.Group();

  const clampedGlow = Math.min(1.06, glowIntensity * 0.46);
  const bladeMat = _getSwordMat(bladeColor, clampedGlow);
  const coreMat = _getSwordMat(coreColor, Math.min(1.12, clampedGlow * 1.15));
  const guardMat = _getSwordMat(guardColor, 0.85);
  const gripMat = _getSwordMat(0x2b1e14, 1.0);

  group.add(new THREE.Mesh(geos.bladeShape, bladeMat));
  group.add(new THREE.Mesh(geos.coreGeo, coreMat));

  const guard = new THREE.Mesh(geos.guardGeo, guardMat);
  guard.position.z = -0.04;
  group.add(guard);

  const leftWing = new THREE.Mesh(geos.wingGeo, guardMat);
  leftWing.rotation.set(Math.PI * 0.2, 0, Math.PI * 0.35);
  leftWing.position.set(-0.31, 0, 0.04);
  const rightWing = new THREE.Mesh(geos.wingGeo, guardMat);
  rightWing.rotation.set(Math.PI * 0.2, 0, -Math.PI * 0.35);
  rightWing.position.set(0.31, 0, 0.04);
  group.add(leftWing, rightWing);

  group.add(new THREE.Mesh(geos.gripGeo, gripMat));

  const pommel = new THREE.Mesh(geos.pommelGeo, guardMat);
  pommel.position.z = -0.6;
  group.add(pommel);

  group.scale.setScalar(scale);
  return group;
}
