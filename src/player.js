import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import {
  createBaguaTexture,
  createCrescentSlashGeometry,
  createImmortalSwordMesh
} from './textures.js';
import { SwordRibbon } from './vfx.js';
import { sfx } from './audio.js';

export const SKILL_META = {
  lmb: {
    name: '武技 · 月影清风剑【登仙】',
    meta: '冷却：0.08秒 | 消耗：微量灵力 | 词条：穿透 · 追踪 · 叠剑斩',
    desc: '凝聚太虚剑意极速连射三道弧光飞剑，命中叠加【剑斩】印记。每施展 5 次自动唤醒羽化冥羽【烛照青鸾】，斩出巨型青鸾剑气波贯穿全场。'
  },
  rmb: {
    name: '绝技 · 万神绝影剑【登仙】',
    meta: '冷却：4.5秒 (满词条 1.8秒) | 核心：引爆全场剑斩',
    desc: '于目标区域降下十二柄天罡巨剑轰击，同时引爆全场妖兽身上的所有【剑斩】层数，每数层额外幻化一柄紫金追魂剑穿刺目标！'
  },
  space: {
    name: '身法 · 九天逍遥风【登仙】',
    meta: '冷却：7.0秒 (满词条 2.8秒) | 特效：无敌帧 · 飓风聚怪 · 风剑倾泻',
    desc: '化作太虚青莲飓风自由穿梭，期间【完全无敌】无视一切伤害，强力牵引周围荒兽并向四周倾泻 360° 旋风飞剑，现身时大幅缩减绝技冷却。'
  },
  artifact: {
    name: '本命仙器 · 皇极天剑匣',
    meta: '冷却：12.0秒 (满词条 4.5秒) | 特效：混元剑盾 · 紫霄神雷',
    desc: '祭出仙阶法宝皇极剑匣悬浮护主 12 秒，立刻获得高额混元剑盾，剑匣持续引动紫霄剑雷轰击场内强敌。'
  },
  domain: {
    name: '道魂领域 · 玄天三剑域',
    meta: '冷却：22.0秒 (满词条 7.5秒) | 三剑融合道魂 · 元神法相',
    desc: '展开太极八卦星宿剑域与八柄镇域古剑（持续 15 秒），领域内妖兽减速且受创加深 50%；同时凝聚【鎏金剑仙元神法相】随主角同步挥斩十米黄金剑波！'
  },
  divine: {
    name: '终极神通 · 骤天万剑诀',
    meta: '冷却：26.0秒 (满词条 8.5秒) | 逆天改命：兵刃专精直放',
    desc: '苍穹化作黄金剑漩天门，先倾泻六十柄天剑洗地，随后召唤【百丈太古皇道巨剑】撕裂云层轰然贯地，引发毁天灭地的金色冲击波！'
  },
  immortal: {
    name: '成道仙法 · 太上诛仙阵',
    meta: '冷却：32.0秒 (满词条 10.0秒) | 登仙极境 · 次元绝杀',
    desc: '召唤诛仙、戮仙、陷仙、绝仙四柄太古凶剑镇锁四方，拉起赤金剑界对全屏进行三十六重次元空间切割，最终万剑归墟引爆天地！'
  }
};

export class ImmortalPlayer {
  constructor(scene, vfx, arena, callbacks) {
    this.scene = scene;
    this.vfx = vfx;
    this.arena = arena;
    this.callbacks = callbacks; // { onCutin, onScreenShake, onPlayerHurt }

    this.maxHp = 240000;
    this.hp = this.maxHp;
    this.shield = 0;
    this.maxMp = 85000;
    this.mp = this.maxMp;

    this.godMode = true; // 默认开启大成满词条爽玩模式
    this.baseCritChance = 0.42;
    this.tianWaiTimer = 0; // 逆天改命：天外有天增益计时
    this.moveStacks = 0;   // 逆天改命：穿云电闪层数

    // 冷却表
    this.cds = {
      lmb: 0,
      rmb: 0,
      space: 0,
      artifact: 0,
      domain: 0,
      divine: 0,
      immortal: 0
    };
    this.maxCds = {
      lmb: 0.08,
      rmb: 4.5,
      space: 7.0,
      artifact: 12.0,
      domain: 22.0,
      divine: 26.0,
      immortal: 32.0
    };

    this.lmbCount = 0;
    this.windActive = false;
    this.windTimer = 0;
    this.windShootTimer = 0;

    this.artifactTimer = 0;
    this.artifactZapTimer = 0;

    this.domainTimer = 0;
    this.domainPos = new THREE.Vector3();

    // 飞行投射物与演出队列
    this.flyingSwords = [];
    this.slashWaves = [];
    this.scheduledTasks = [];

    this.crescentGeo = createCrescentSlashGeometry(3.4, 1.35, Math.PI * 0.82, 28);

    this._buildCharacterMesh();
    this._buildSwordSpirit();
    this._buildArtifactMesh();
    this._buildDomainGroup();
    this._buildAimIndicator();
  }

  _buildCharacterMesh() {
    this.root = new THREE.Group();
    this.root.position.set(0, 0, 14);
    this.pos = this.root.position;
    this.scene.add(this.root);

    this.bodyGroup = new THREE.Group();
    this.root.add(this.bodyGroup);

    // 1. 登仙玄白青金长袍身躯
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0xeaf4ff,
      emissive: 0x1c3d52,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.25
    });
    const goldTrimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xf7d274).multiplyScalar(1.5)
    });
    const darkHairMat = new THREE.MeshStandardMaterial({
      color: 0x141824,
      roughness: 0.6
    });

    // 飘逸下摆与修长身形
    const lowerRobe = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.65, 10), robeMat);
    lowerRobe.position.y = 0.92;
    this.bodyGroup.add(lowerRobe);

    const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.46, 0.92, 8), robeMat);
    upperTorso.position.y = 1.92;
    this.bodyGroup.add(upperTorso);

    // 金玉束腰带
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, 0.14, 10), goldTrimMat);
    belt.position.y = 1.55;
    this.bodyGroup.add(belt);

    // 宽袍大袖双臂
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.88, 6), robeMat);
      sleeve.position.set(side * 0.56, 1.82, 0.1);
      sleeve.rotation.z = side * 0.45;
      this.bodyGroup.add(sleeve);
    }

    // 头部与玄发紫金冠
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe4cc, roughness: 0.6 })
    );
    head.position.y = 2.62;
    this.bodyGroup.add(head);

    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.65, 8), darkHairMat);
    hair.position.set(0, 2.75, -0.06);
    this.bodyGroup.add(hair);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.24, 6), goldTrimMat);
    crown.position.set(0, 3.04, -0.02);
    this.bodyGroup.add(crown);

    // 2. 羽化境特征：【烛照青鸾双色流光冥羽】
    this.leftWing = this._createFeatherWing(1);
    this.rightWing = this._createFeatherWing(-1);
    this.leftWing.position.set(0.22, 2.15, -0.26);
    this.rightWing.position.set(-0.22, 2.15, -0.26);
    this.bodyGroup.add(this.leftWing, this.rightWing);

    // 3. 背后悬浮【太虚八剑剑轮】
    this.swordHalo = new THREE.Group();
    this.swordHalo.position.set(0, 2.35, -0.58);
    for (let i = 0; i < 8; i++) {
      const sw = createImmortalSwordMesh({
        bladeColor: i % 2 === 0 ? 0x6cfcf2 : 0xffdf80,
        scale: 0.55,
        glowIntensity: 1.8
      });
      const ang = (i / 8) * Math.PI * 2;
      sw.position.set(Math.cos(ang) * 1.15, Math.sin(ang) * 1.15, 0);
      sw.rotation.x = -Math.PI / 2;
      sw.rotation.z = -ang;
      this.swordHalo.add(sw);
    }
    this.bodyGroup.add(this.swordHalo);

    // 4. 脚下御风剑莲光环 & 混元护盾球 & 九天逍遥风龙卷网格
    const footLotus = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x66fcf2).multiplyScalar(1.8),
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    footLotus.position.y = 0.06;
    this.root.add(footLotus);
    this.footLotus = footLotus;

    // 护盾光球
    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.75, 20, 16),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffe082).multiplyScalar(1.5),
        transparent: true,
        opacity: 0,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.shieldBubble.position.y = 1.6;
    this.root.add(this.shieldBubble);

    // 九天逍遥风（风身法无敌飓风特效组）
    this.tornadoGroup = new THREE.Group();
    this.tornadoGroup.visible = false;
    for (let layer = 0; layer < 4; layer++) {
      const r = 1.1 + layer * 0.68;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.065, 6, 28),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(layer % 2 === 0 ? 0x6effcb : 0x62f4ff).multiplyScalar(2.2),
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2 + (layer % 2 === 0 ? 0.16 : -0.16);
      ring.position.y = 0.5 + layer * 0.85;
      this.tornadoGroup.add(ring);
    }
    this.root.add(this.tornadoGroup);

    // 5. 道魂领域开启时的【丈六鎏金剑仙元神法相】
    this.avatarGroup = this._createGoldenAvatar();
    this.avatarGroup.visible = false;
    this.root.add(this.avatarGroup);
  }

  _createFeatherWing(dirSign) {
    const wing = new THREE.Group();
    const feathers = 6;
    for (let i = 0; i < feathers; i++) {
      const len = 1.85 - i * 0.2;
      const geo = new THREE.ConeGeometry(0.11, len, 4);
      geo.translate(0, len * 0.5, 0);
      const isGold = i % 2 === 1;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(isGold ? 0xffd875 : 0x56f7e8).multiplyScalar(1.9),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const f = new THREE.Mesh(geo, mat);
      f.rotation.z = -dirSign * (0.45 + i * 0.21);
      f.rotation.x = -0.18;
      wing.add(f);
    }
    return wing;
  }

  // 构建半透明璀璨黄金剑仙元神巨像
  _createGoldenAvatar() {
    const g = new THREE.Group();
    g.position.set(0, 0.6, -1.35);

    const spiritMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffcf60).multiplyScalar(1.9),
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff0a8).multiplyScalar(2.2),
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const torso = new THREE.Mesh(new THREE.ConeGeometry(1.75, 4.4, 7), spiritMat);
    torso.rotation.x = Math.PI;
    torso.position.y = 4.5;
    const torsoWire = new THREE.Mesh(new THREE.ConeGeometry(1.78, 4.42, 7), wireMat);
    torsoWire.rotation.x = Math.PI;
    torsoWire.position.y = 4.5;

    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.68, 1), spiritMat);
    head.position.y = 7.25;

    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 6, 32), wireMat);
    halo.position.set(0, 6.8, -0.5);

    // 元神巨剑右臂枢轴（随左键挥砍摆动！）
    this.avatarSwordPivot = new THREE.Group();
    this.avatarSwordPivot.position.set(1.9, 5.4, 0.4);
    const giantAvatarSword = createImmortalSwordMesh({
      bladeColor: 0xffd666,
      coreColor: 0xffffff,
      guardColor: 0xffae33,
      scale: 2.35,
      glowIntensity: 2.4
    });
    this.avatarSwordPivot.add(giantAvatarSword);

    g.add(torso, torsoWire, head, halo, this.avatarSwordPivot);
    return g;
  }

  // 逆天改命：【剑灵精通】自动索敌本命金剑灵
  _buildSwordSpirit() {
    this.spiritSword = createImmortalSwordMesh({
      bladeColor: 0xffe066,
      coreColor: 0xffffff,
      guardColor: 0xffaa33,
      scale: 0.82,
      glowIntensity: 2.4
    });
    this.spiritPos = new THREE.Vector3(2, 2.2, 14);
    this.spiritVel = new THREE.Vector3(0, 0, 1);
    this.spiritSword.position.copy(this.spiritPos);
    this.scene.add(this.spiritSword);
    this.spiritRibbon = new SwordRibbon(this.scene, 14, 0.36, 0xffd45e);
    this.spiritRibbon.reset(this.spiritPos);
    this.spiritHitCd = 0;
  }

  // 本命法宝：【皇极天剑匣】
  _buildArtifactMesh() {
    this.artifactGroup = new THREE.Group();
    this.artifactGroup.visible = false;

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x1e2838,
      emissive: 0x2b5082,
      roughness: 0.3,
      metalness: 0.85
    });
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.55), boxMat);
    this.artifactGroup.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.06, 6, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ac0ff).multiplyScalar(2.3) })
    );
    ring.rotation.x = Math.PI / 2;
    this.artifactGroup.add(ring);
    this.artifactRing = ring;

    for (let i = 0; i < 4; i++) {
      const miniSword = createImmortalSwordMesh({
        bladeColor: 0x80c8ff,
        scale: 0.52,
        glowIntensity: 2.2
      });
      const a = (i * Math.PI) / 2;
      miniSword.position.set(Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35);
      miniSword.rotation.x = -Math.PI / 2;
      ring.add(miniSword);
    }

    this.scene.add(this.artifactGroup);
  }

  // 道魂领域：【玄天三剑域】立体八卦剑阵
  _buildDomainGroup() {
    this.domainGroup = new THREE.Group();
    this.domainGroup.visible = false;

    const texOuter = createBaguaTexture({
      mainColor: '#ffe082',
      subColor: '#5cf7ee',
      drawTaiji: true
    });
    const outerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 45).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: texOuter,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    outerMesh.position.y = 0.07;
    this.domainOuter = outerMesh;
    this.domainGroup.add(outerMesh);

    const innerMesh = new THREE.Mesh(
      new THREE.RingGeometry(21.8, 22.5, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffdc78).multiplyScalar(2.0),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    innerMesh.position.y = 0.09;
    this.domainGroup.add(innerMesh);

    // 领域八方镇域古剑与光柱
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * 22.0;
      const pz = Math.sin(a) * 22.0;
      const sword = createImmortalSwordMesh({
        bladeColor: i % 2 === 0 ? 0xffdb78 : 0x68fcf2,
        scale: 2.1,
        glowIntensity: 2.1
      });
      sword.position.set(px, 4.8, pz);
      sword.rotation.x = Math.PI / 2; // 剑尖直插大地
      this.domainGroup.add(sword);
    }

    this.scene.add(this.domainGroup);
  }

  // 地面施法准星法阵
  _buildAimIndicator() {
    const g = new THREE.Group();
    const r1 = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.02, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x7efcf4,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    r1.position.y = 0.08;
    g.add(r1);
    this.aimReticle = g;
    this.scene.add(g);
  }

  getEffectiveMaxCd(key) {
    if (key === 'lmb') return this.godMode ? 0.07 : 0.095;
    return this.godMode ? this.maxCds[key] * 0.36 : this.maxCds[key];
  }

  getCritChance() {
    return Math.min(0.95, this.baseCritChance + (this.tianWaiTimer > 0 ? 0.4 : 0));
  }

  getDamageMultiplier() {
    return 1.0 + Math.min(0.35, this.moveStacks * 0.01);
  }

  // 血魔大法吸血
  _applyLifesteal(dealtDamage) {
    if (dealtDamage <= 0) return;
    const heal = dealtDamage * 0.045;
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + heal);
    }
  }

  takeDamage(rawDamage) {
    // 风身法无敌帧完全免疫！
    if (this.windActive) return;

    let dmg = rawDamage;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      this.hp = Math.max(this.godMode ? this.maxHp * 0.15 : 1, this.hp - dmg);
      this.vfx.spawnDamageText(this.pos, dmg, 'player-hurt', '-');
      if (this.callbacks.onPlayerHurt) this.callbacks.onPlayerHurt();
    }
  }

  resetStatus() {
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    this.shield = 0;
    for (const k of Object.keys(this.cds)) {
      this.cds[k] = 0;
    }
  }

  // ==================== 七大后期核心招式实现 ====================

  // 1. 左键：【月影清风剑】+ 青鸾冥羽被动 + 道魂元神协战斩
  castPrimary(aimPoint, enemyManager) {
    if (this.cds.lmb > 0) return;
    this.cds.lmb = this.getEffectiveMaxCd('lmb');

    if (!this.godMode && this.mp < 180) return;
    if (!this.godMode) this.mp -= 180;

    this.lmbCount++;
    sfx.playSwordShoot(0.95 + (this.lmbCount % 4) * 0.06);

    const baseDir = new THREE.Vector3(aimPoint.x - this.pos.x, 0, aimPoint.z - this.pos.z);
    if (baseDir.lengthSq() < 0.01) baseDir.set(0, 0, -1);
    baseDir.normalize();
    const baseYaw = Math.atan2(baseDir.x, baseDir.z);

    // 三剑齐发（中间直贯穿透剑，左右弧线灵动追魂剑）
    const offsets = [-0.42, 0, 0.42];
    offsets.forEach((angOffset, idx) => {
      const yaw = baseYaw + angOffset;
      const startPos = new THREE.Vector3(
        this.pos.x + Math.cos(baseYaw) * (idx - 1) * 0.75,
        1.75 + (idx === 1 ? 0.25 : 0),
        this.pos.z - Math.sin(baseYaw) * (idx - 1) * 0.75
      );
      const vel = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(42);
      this._spawnFlyingSword({
        pos: startPos,
        vel,
        color: idx === 1 ? 0x9ffff8 : 0x5bf0e6,
        damage: 24500 * this.getDamageMultiplier(),
        homingStrength: idx === 1 ? 2.5 : 8.5,
        pierce: idx === 1 ? 3 : 1,
        addMarks: 1,
        scale: 0.76
      });
    });

    // 羽化冥羽被动：每 5 次武技触发【烛照青鸾·炽炎剑凤波】
    if (this.lmbCount % 5 === 0) {
      sfx.playGiantSlash();
      this._spawnCrescentWave({
        origin: this.pos.clone().setY(1.45),
        dir: baseDir,
        speed: 36,
        scale: 1.55,
        color: 0x4effd8,
        damage: 78000 * this.getDamageMultiplier(),
        maxDist: 38,
        addMarks: 3
      });
    }

    // 道魂领域激活时：背后【丈六鎏金剑仙元神】同步挥出十米黄金月牙巨斩！
    if (this.domainTimer > 0 && this.lmbCount % 2 === 0) {
      if (this.avatarSwordPivot) {
        this.avatarSwordPivot.rotation.x = Math.sin(this.lmbCount * 1.9) * 0.85;
        this.avatarSwordPivot.rotation.y = Math.cos(this.lmbCount * 1.9) * 0.55;
      }
      this._spawnCrescentWave({
        origin: this.pos.clone().setY(1.85),
        dir: baseDir,
        speed: 38,
        scale: 2.35,
        color: 0xffd463,
        damage: 105000 * this.getDamageMultiplier(),
        maxDist: 42,
        addMarks: 2
      });
    }
  }

  // 2. 右键：【绝技 · 万神绝影剑】（天罡落剑阵 + 引爆全场剑斩层数）
  castSpecial(aimPoint, enemyManager) {
    if (this.cds.rmb > 0) return false;
    this.cds.rmb = this.getEffectiveMaxCd('rmb');
    sfx.playSpecialBurst();
    if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(0.32);

    const center = aimPoint.clone();
    const d = Math.hypot(center.x, center.z);
    if (d > ARENA_RADIUS - 2) center.multiplyScalar((ARENA_RADIUS - 2) / d);

    this.vfx.spawnShockwave(center, 9.5, 0xc978ff, 0.5);

    // 12 柄天罡巨剑依次轰落目标剑阵
    for (let i = 0; i < 12; i++) {
      this._schedule(i * 0.055, () => {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
        const r = i === 0 ? 0 : 2.2 + Math.random() * 5.8;
        const strikePos = new THREE.Vector3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
        this._dropSkySword(strikePos, {
          color: 0xd58aff,
          scale: 1.65,
          radius: 5.2,
          damage: 68000 * this.getDamageMultiplier(),
          enemyManager
        });
      });
    }

    // 引爆全场所有敌人身上的【剑斩】印记！幻化紫金追魂剑万剑穿心！
    for (const enemy of enemyManager.enemies) {
      if (enemy.dead || enemy.swordMarks <= 0) continue;
      const marks = enemy.swordMarks;
      enemy.swordMarks = 0;
      const bonusSwords = Math.min(18, Math.max(2, Math.ceil(marks / 3)));
      const perSwordDmg = (32000 + marks * 2800) * this.getDamageMultiplier();

      for (let k = 0; k < bonusSwords; k++) {
        this._schedule(k * 0.04, () => {
          if (enemy.dead) return;
          const ang = (k / bonusSwords) * Math.PI * 2;
          const spawnPos = new THREE.Vector3(
            enemy.pos.x + Math.cos(ang) * 9.5,
            3.5 + (k % 3) * 1.4,
            enemy.pos.z + Math.sin(ang) * 9.5
          );
          const toTarget = enemy.pos.clone().setY(1.6).sub(spawnPos).normalize().multiplyScalar(48);
          this._spawnFlyingSword({
            pos: spawnPos,
            vel: toTarget,
            color: 0xe08cff,
            damage: perSwordDmg,
            homingStrength: 18,
            preferredTarget: enemy,
            pierce: 1,
            addMarks: 0,
            scale: 0.92,
            dmgStyle: 'slash-burst',
            dmgLabel: '绝影引爆'
          });
        });
      }
    }
    return true;
  }

  // 3. Space：【身法 · 九天逍遥风】（化风无敌 + 聚怪 + 360°风剑雨）
  castMovement() {
    if (this.cds.space > 0) return false;
    this.cds.space = this.getEffectiveMaxCd('space');
    sfx.playWindDash();

    this.windActive = true;
    this.windTimer = 2.6;
    this.windShootTimer = 0;
    this.tornadoGroup.visible = true;
    this.bodyGroup.visible = false; // 本体化作清风隐匿无敌
    this.vfx.spawnShockwave(this.pos, 7.5, 0x6effcb, 0.42);
    this.vfx.burstParticles(this.pos.clone().setY(1.4), 28, 0x6effcb, 14, 7, 0.5);
    return true;
  }

  // 4. E键：【本命仙器 · 皇极天剑匣】
  castArtifact() {
    if (this.cds.artifact > 0) return false;
    this.cds.artifact = this.getEffectiveMaxCd('artifact');
    sfx.playImmortalBell(330);

    this.artifactTimer = 12.0;
    this.artifactZapTimer = 0.1;
    this.artifactGroup.visible = true;
    this.artifactGroup.position.set(this.pos.x - 2.2, 3.6, this.pos.z - 1.8);

    // 赋予混元剑盾
    this.shield = Math.round(this.maxHp * 0.4);
    this.vfx.spawnShockwave(this.pos, 6.5, 0x7ac0ff, 0.45);
    return true;
  }

  // 5. Q键：【道魂领域 · 玄天三剑域】
  castDomain() {
    if (this.cds.domain > 0) return false;
    this.cds.domain = this.getEffectiveMaxCd('domain');

    sfx.playImmortalBell(196);
    if (this.callbacks.onCutin) {
      this.callbacks.onCutin('道魂', '玄 天 三 剑 域', '三剑道魂融合 · 剑仙法相临凡');
    }
    if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(0.45);

    this.domainTimer = 15.0;
    this.domainPos.copy(this.pos);
    this.domainGroup.position.set(this.pos.x, 0, this.pos.z);
    this.domainGroup.visible = true;
    this.avatarGroup.visible = true;

    this.arena.setMood('domain', 15.0);
    this.vfx.spawnShockwave(this.pos, 23.0, 0xffdc78, 0.75);
    this.vfx.burstParticles(this.pos.clone().setY(1.5), 55, 0xffdc78, 18, 10, 0.8);
    return true;
  }

  // 6. R键：【终极神通 · 骤天万剑诀】（万剑天来 + 百丈太古皇道仙剑坠落！）
  castDivine(aimPoint, enemyManager) {
    if (this.cds.divine > 0) return false;
    this.cds.divine = this.getEffectiveMaxCd('divine');

    sfx.playImmortalBell(165);
    this.tianWaiTimer = 12.0; // 激活【天外有天】

    if (this.callbacks.onCutin) {
      this.callbacks.onCutin('神通', '骤 天 万 剑 诀', '万剑归宗洗炼 · 百丈太古仙剑坠世');
    }
    this.arena.setMood('divine', 4.8);

    // 锁定大妖 Boss 或鼠标中心作为百丈巨剑终极落点
    const targetCenter =
      enemyManager.boss && !enemyManager.boss.dead ? enemyManager.boss.pos.clone() : aimPoint.clone();

    // 第一阶段：54 柄黄金流光天剑暴雨洗地 (0 ~ 1.65s)
    for (let i = 0; i < 54; i++) {
      this._schedule(0.15 + i * 0.028, () => {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 26;
        const p = new THREE.Vector3(
          targetCenter.x + Math.cos(ang) * r,
          0,
          targetCenter.z + Math.sin(ang) * r
        );
        const clampD = Math.hypot(p.x, p.z);
        if (clampD > ARENA_RADIUS - 2) p.multiplyScalar((ARENA_RADIUS - 2) / clampD);

        this._dropSkySword(p, {
          color: 0xffd466,
          scale: 1.5,
          radius: 4.8,
          damage: 58000 * this.getDamageMultiplier(),
          enemyManager
        });
      });
    }

    // 第二阶段：百丈太古皇道巨剑撕裂苍穹轰然贯地！(1.75s 开始坠落，2.1s 轰击大地)
    this._schedule(1.55, () => {
      const impactPos =
        enemyManager.boss && !enemyManager.boss.dead ? enemyManager.boss.pos.clone() : targetCenter.clone();
      impactPos.y = 0;

      const colossalSword = createImmortalSwordMesh({
        bladeColor: 0xffdf7a,
        coreColor: 0xffffff,
        guardColor: 0xff9f2e,
        scale: 13.5, // 长达三十余米的遮天巨剑！
        glowIntensity: 2.6
      });
      colossalSword.rotation.x = Math.PI / 2; // 剑尖垂直朝下
      colossalSword.position.set(impactPos.x, 58, impactPos.z);
      this.scene.add(colossalSword);

      // 地面黄金法阵锁定预警光环
      this.vfx.spawnShockwave(impactPos, 18, 0xffd56b, 0.55);

      let elapsed = 0;
      const fallDuration = 0.42;
      let impacted = false;

      this.vfx.transientMeshes.push({
        mesh: colossalSword,
        age: 0,
        duration: 2.8,
        onUpdate: (t) => {
          elapsed = t * 2.8;
          if (elapsed < fallDuration) {
            const p = elapsed / fallDuration;
            colossalSword.position.y = 58 * (1 - p * p) + 1.5;
          } else {
            if (!impacted) {
              impacted = true;
              colossalSword.position.y = 1.5;
              sfx.playCataclysmImpact();
              if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(1.15);

              // 巨剑贯地核爆级多重金环与八方裂地剑痕
              this.vfx.spawnSkyPillar(impactPos, 6.5, 48, 0xffe28a, 0.95);
              this.vfx.spawnShockwave(impactPos, 32, 0xffe082, 0.85, 0.12);
              this.vfx.spawnShockwave(impactPos, 20, 0x6efcf2, 0.65, 0.25);
              this.vfx.burstParticles(impactPos.clone().setY(2.0), 140, 0xffd870, 30, 18, 1.1);

              for (let k = 0; k < 8; k++) {
                const a = (k * Math.PI) / 4;
                this.vfx.spawnGroundScar(impactPos, a, 38, 1.2, 0xffd466, 3.2);
              }

              // 毁天灭地全屏神通伤害！
              const res = enemyManager.damageArea(
                impactPos,
                34,
                680000 * this.getDamageMultiplier(),
                this.getCritChance(),
                {
                  style: 'immortal',
                  label: '骤天巨剑',
                  addSwordMarks: 15,
                  inDomain: this.domainTimer > 0
                }
              );
              this._applyLifesteal(res.total);
            }
            // 巨剑插地余震后化光消散
            const fadeT = (elapsed - fallDuration) / (2.8 - fallDuration);
            if (fadeT > 0.6) {
              const s = 13.5 * (1 - (fadeT - 0.6) / 0.4);
              colossalSword.scale.set(Math.max(0.01, s), Math.max(0.01, s), 13.5);
            }
          }
        }
      });
    });

    return true;
  }

  // 7. F键：【成道仙法 · 太上诛仙剑阵】（四剑锁空 + 三十六重次元斩 + 归墟爆裂！）
  castImmortalArt(enemyManager) {
    if (this.cds.immortal > 0) return false;
    this.cds.immortal = this.getEffectiveMaxCd('immortal');

    sfx.playImmortalBell(130);
    this.tianWaiTimer = 15.0;

    if (this.callbacks.onCutin) {
      this.callbacks.onCutin('仙法', '太 上 诛 仙 阵', '非铜非铁亦非钢 · 诛仙四剑绝阴阳');
    }
    if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(0.65);
    this.arena.setMood('immortal', 4.6);

    const center = new THREE.Vector3(0, 0, 0);
    const pillarRadius = 29;
    const fourCorners = [];
    const cornerColors = [0xff2e4c, 0xffbe42, 0xd938ff, 0x4efce8]; // 诛、戮、陷、绝四剑异色

    // 1. 四方降下诛仙四柄通天古剑
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const pos = new THREE.Vector3(Math.cos(ang) * pillarRadius, 0, Math.sin(ang) * pillarRadius);
      fourCorners.push(pos);

      const sword = createImmortalSwordMesh({
        bladeColor: cornerColors[i],
        coreColor: 0xffffff,
        guardColor: 0xffd269,
        scale: 6.2,
        glowIntensity: 2.6
      });
      sword.rotation.x = Math.PI / 2;
      sword.position.set(pos.x, 8.5, pos.z);
      this.scene.add(sword);

      this.vfx.spawnSkyPillar(pos, 2.8, 42, cornerColors[i], 3.2);
      this.vfx.spawnShockwave(pos, 11, cornerColors[i], 0.6);

      this.vfx.transientMeshes.push({
        mesh: sword,
        age: 0,
        duration: 3.3,
        onUpdate(t) {
          sword.position.y = 8.5 + Math.sin(t * Math.PI * 6) * 0.6;
          if (t > 0.85) sword.scale.setScalar(6.2 * (1 - (t - 0.85) / 0.15));
        }
      });
    }

    // 地面展开巨型血金诛仙大阵图
    const zhuXianTex = createBaguaTexture({
      mainColor: '#ff3b56',
      subColor: '#ffd466',
      runeText: '诛仙戮仙陷仙绝仙太上敕令万神诛魔天地无极剑界归墟',
      drawTaiji: false
    });
    const arrayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(66, 66).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: zhuXianTex,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    arrayMesh.position.y = 0.11;
    this.scene.add(arrayMesh);
    this.vfx.transientMeshes.push({
      mesh: arrayMesh,
      mat: arrayMesh.material,
      ownGeo: arrayMesh.geometry,
      age: 0,
      duration: 3.3,
      onUpdate(t) {
        arrayMesh.rotation.z = t * 2.4;
        arrayMesh.material.opacity = t < 0.82 ? 0.9 : (1 - (t - 0.82) / 0.18) * 0.9;
      }
    });

    // 2. 三十二重全屏次元空间切割剑网！(0.25s ~ 2.45s)
    const sliceCount = 32;
    for (let s = 0; s < sliceCount; s++) {
      this._schedule(0.25 + s * 0.068, () => {
        sfx.playDimensionSlice(s);
        const a1 = Math.random() * Math.PI * 2;
        const a2 = a1 + Math.PI * (0.65 + Math.random() * 0.7);
        const p1 = new THREE.Vector3(Math.cos(a1) * 32, 1.2 + Math.random() * 6, Math.sin(a1) * 32);
        const p2 = new THREE.Vector3(Math.cos(a2) * 32, 1.2 + Math.random() * 6, Math.sin(a2) * 32);
        const col = s % 2 === 0 ? 0xff3355 : 0xffd86b;
        this.vfx.spawnDimensionRift(p1, p2, col, 0.85, 0.48);

        // 四剑之间随机迸发赤金闪电链
        const cIdx = s % 4;
        this.vfx.spawnLightning(
          fourCorners[cIdx].clone().setY(9),
          fourCorners[(cIdx + 1) % 4].clone().setY(9),
          0xff4766,
          10,
          1.2,
          0.16
        );

        // 每 2 次空间切割结算一次全阵无死角仙法斩击伤害
        if (s % 2 === 0) {
          if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(0.18);
          const res = enemyManager.damageArea(
            center,
            40,
            62000 * this.getDamageMultiplier(),
            this.getCritChance(),
            {
              style: 'immortal',
              label: s % 6 === 0 ? '诛仙剑气' : '',
              addSwordMarks: 2,
              inDomain: this.domainTimer > 0
            }
          );
          this._applyLifesteal(res.total);
        }
      });
    }

    // 3. 终焉一击：四剑剑意归墟大爆炸 (2.65s)
    this._schedule(2.65, () => {
      sfx.playCataclysmImpact();
      if (this.callbacks.onScreenShake) this.callbacks.onScreenShake(1.35);

      for (const corner of fourCorners) {
        this.vfx.spawnLightning(corner.clone().setY(8), new THREE.Vector3(0, 2, 0), 0xffe07d, 12, 1.5, 0.55);
      }
      this.vfx.spawnSkyPillar(center, 9.5, 52, 0xff3855, 1.1);
      this.vfx.spawnShockwave(center, 40, 0xff3855, 0.9, 0.15);
      this.vfx.spawnShockwave(center, 28, 0xffe082, 0.75, 0.3);
      this.vfx.burstParticles(new THREE.Vector3(0, 2.5, 0), 180, 0xff4560, 34, 22, 1.2);

      const res = enemyManager.damageArea(
        center,
        42,
        920000 * this.getDamageMultiplier(),
        0.95,
        {
          style: 'immortal',
          label: '诛仙归墟',
          addSwordMarks: 20,
          inDomain: this.domainTimer > 0
        }
      );
      this._applyLifesteal(res.total);
    });

    return true;
  }

  // ==================== 投射物生成与更新 ====================

  _spawnFlyingSword({
    pos,
    vel,
    color = 0x68fff4,
    damage = 22000,
    homingStrength = 6.0,
    preferredTarget = null,
    pierce = 1,
    addMarks = 1,
    scale = 0.75,
    dmgStyle = 'normal',
    dmgLabel = ''
  }) {
    const mesh = createImmortalSwordMesh({
      bladeColor: color,
      scale,
      glowIntensity: 2.2
    });
    mesh.position.copy(pos);
    const targetLook = pos.clone().add(vel);
    mesh.lookAt(targetLook);
    this.scene.add(mesh);

    const ribbon = new SwordRibbon(this.scene, 10, 0.3 * scale, color);
    ribbon.reset(pos);

    this.flyingSwords.push({
      mesh,
      ribbon,
      pos: mesh.position,
      vel,
      color,
      damage,
      homingStrength,
      preferredTarget,
      pierce,
      addMarks,
      dmgStyle,
      dmgLabel,
      hitSet: new Set(),
      life: 1.75
    });
  }

  _spawnCrescentWave({
    origin,
    dir,
    speed = 35,
    scale = 1.6,
    color = 0x5cf7ee,
    damage = 80000,
    maxDist = 38,
    addMarks = 2
  }) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2.4),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(this.crescentGeo, mat);
    mesh.position.copy(origin);
    mesh.scale.setScalar(scale);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    this.scene.add(mesh);

    this.slashWaves.push({
      mesh,
      mat,
      vel: dir.clone().normalize().multiplyScalar(speed),
      scale,
      color,
      damage,
      traveled: 0,
      maxDist,
      addMarks,
      hitSet: new Set()
    });
  }

  // 天罡巨剑垂直坠落打击
  _dropSkySword(targetPos, { color = 0xd58aff, scale = 1.6, radius = 4.8, damage = 60000, enemyManager }) {
    const sword = createImmortalSwordMesh({
      bladeColor: color,
      scale,
      glowIntensity: 2.3
    });
    sword.rotation.x = Math.PI / 2;
    sword.position.set(targetPos.x, 26, targetPos.z);
    this.scene.add(sword);

    let hitDone = false;
    this.vfx.transientMeshes.push({
      mesh: sword,
      age: 0,
      duration: 0.52,
      onUpdate: (t) => {
        if (t < 0.36) {
          const p = t / 0.36;
          sword.position.y = 26 * (1 - p) + 0.8;
        } else {
          sword.position.y = 0.8;
          if (!hitDone) {
            hitDone = true;
            this.vfx.spawnSkyPillar(targetPos, 1.15, 22, color, 0.32);
            this.vfx.spawnShockwave(targetPos, radius, color, 0.34);
            this.vfx.burstParticles(targetPos.clone().setY(0.8), 14, color, 12, 6, 0.4);
            const res = enemyManager.damageArea(targetPos, radius, damage, this.getCritChance(), {
              addSwordMarks: 1,
              inDomain: this.domainTimer > 0
            });
            this._applyLifesteal(res.total);
          }
          const fade = 1 - (t - 0.36) / 0.64;
          sword.scale.setScalar(Math.max(0.01, scale * fade));
        }
      }
    });
  }

  _schedule(delaySec, fn) {
    this.scheduledTasks.push({ timer: delaySec, fn });
  }

  _findNearestEnemy(fromPos, enemyManager, excludeSet = null, maxRange = 28) {
    let best = null;
    let bestDist = maxRange;
    for (const e of enemyManager.enemies) {
      if (e.dead || (excludeSet && excludeSet.has(e))) continue;
      const d = Math.hypot(e.pos.x - fromPos.x, e.pos.z - fromPos.z);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  update(dt, moveVec, aimPoint, isFiringLmb, enemyManager) {
    const now = performance.now() * 0.001;

    // 1. 冷却递减与灵力自然吐纳恢复
    for (const key of Object.keys(this.cds)) {
      if (this.cds[key] > 0) this.cds[key] = Math.max(0, this.cds[key] - dt);
    }
    this.mp = Math.min(this.maxMp, this.mp + (this.godMode ? 25000 : 4500) * dt);
    if (this.tianWaiTimer > 0) this.tianWaiTimer = Math.max(0, this.tianWaiTimer - dt);

    // 2. 延时演出任务队列推进
    for (let i = this.scheduledTasks.length - 1; i >= 0; i--) {
      const task = this.scheduledTasks[i];
      task.timer -= dt;
      if (task.timer <= 0) {
        task.fn();
        this.scheduledTasks.splice(i, 1);
      }
    }

    // 3. 御风移动与【穿云电闪】叠层
    let moveSpeed = 14.5;
    if (this.windActive) moveSpeed *= 1.82;
    if (this.tianWaiTimer > 0) moveSpeed *= 1.22;

    if (moveVec.lengthSq() > 0.001) {
      moveVec.normalize();
      this.pos.x += moveVec.x * moveSpeed * dt;
      this.pos.z += moveVec.z * moveSpeed * dt;
      this.moveStacks = Math.min(35, this.moveStacks + dt * 16);
    } else {
      this.moveStacks = Math.max(0, this.moveStacks - dt * 8);
    }

    // 场地边界限制
    const distFromOrigin = Math.hypot(this.pos.x, this.pos.z);
    if (distFromOrigin > ARENA_RADIUS - 1.2) {
      const r = (ARENA_RADIUS - 1.2) / distFromOrigin;
      this.pos.x *= r;
      this.pos.z *= r;
    }

    // 角色朝向鼠标准星
    const lookDx = aimPoint.x - this.pos.x;
    const lookDz = aimPoint.z - this.pos.z;
    if (lookDx * lookDx + lookDz * lookDz > 0.01) {
      this.root.rotation.y = Math.atan2(lookDx, lookDz);
    }
    this.aimReticle.position.set(aimPoint.x, 0, aimPoint.z);
    this.aimReticle.rotation.y += dt * 2.5;

    // 角色仙袍悬浮、烛照青鸾冥羽扇动、八剑剑轮流转
    this.bodyGroup.position.y = Math.sin(now * 3.4) * 0.14;
    const flap = Math.sin(now * 5.2) * 0.24;
    this.leftWing.rotation.y = flap;
    this.rightWing.rotation.y = -flap;
    this.swordHalo.rotation.z += dt * 1.6;
    this.footLotus.rotation.z -= dt * 1.4;

    // 护盾球可视化
    this.shieldBubble.material.opacity = this.shield > 0 ? 0.26 + Math.sin(now * 6) * 0.06 : 0;
    this.shieldBubble.rotation.y += dt * 0.8;

    // 4. 按住左键持续发射清风月影剑
    if (isFiringLmb) {
      this.castPrimary(aimPoint, enemyManager);
    }

    // 5. 更新【身法 · 九天逍遥风】无敌旋风状态
    if (this.windActive) {
      this.windTimer -= dt;
      this.tornadoGroup.rotation.y += dt * 14.0;
      this.windShootTimer -= dt;
      if (this.windShootTimer <= 0) {
        this.windShootTimer = 0.085;
        sfx.playSwordShoot(1.25);
        // 自动向四周发射 2 柄青翠旋风追魂剑
        for (let w = 0; w < 2; w++) {
          const ang = Math.random() * Math.PI * 2;
          const v = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(40);
          this._spawnFlyingSword({
            pos: this.pos.clone().setY(1.6),
            vel: v,
            color: 0x6effcb,
            damage: 21000 * this.getDamageMultiplier(),
            homingStrength: 12.5,
            pierce: 2,
            addMarks: 1,
            scale: 0.72
          });
        }
      }
      if (this.windTimer <= 0) {
        this.windActive = false;
        this.tornadoGroup.visible = false;
        this.bodyGroup.visible = true;
        // 现身震开剑环并缩减绝技冷却 50%！
        this.cds.rmb *= 0.45;
        this.vfx.spawnShockwave(this.pos, 8.5, 0x6effcb, 0.4);
        enemyManager.damageArea(this.pos, 8.5, 52000, this.getCritChance(), {
          addSwordMarks: 3,
          inDomain: this.domainTimer > 0
        });
      }
    }

    // 6. 更新逆天改命【剑灵精通】自动御敌飞剑
    this._updateSwordSpirit(dt, now, enemyManager);

    // 7. 更新法宝【皇极天剑匣】紫霄神雷轰击
    if (this.artifactTimer > 0) {
      this.artifactTimer -= dt;
      const targetHover = new THREE.Vector3(
        this.pos.x + Math.cos(now * 1.4) * 2.8,
        3.5 + Math.sin(now * 2.8) * 0.25,
        this.pos.z + Math.sin(now * 1.4) * 2.8
      );
      this.artifactGroup.position.lerp(targetHover, dt * 5);
      this.artifactRing.rotation.z += dt * 3.5;

      this.artifactZapTimer -= dt;
      if (this.artifactZapTimer <= 0) {
        this.artifactZapTimer = 0.42;
        const target =
          enemyManager.boss && !enemyManager.boss.dead
            ? enemyManager.boss
            : this._findNearestEnemy(this.pos, enemyManager, null, 38);
        if (target) {
          sfx.playThunder();
          this.vfx.spawnLightning(
            this.artifactGroup.position.clone(),
            target.pos.clone().setY(1.8),
            0x7ac0ff,
            8,
            0.8,
            0.22
          );
          this.vfx.spawnSkyPillar(target.pos, 1.35, 26, 0x7ac0ff, 0.3);
          const isCrit = Math.random() < this.getCritChance();
          const dealt = enemyManager.damageEnemy(
            target,
            54000 * this.getDamageMultiplier() * (isCrit ? 1.8 : 1),
            { isCrit, addSwordMarks: 2, inDomain: this.domainTimer > 0 }
          );
          this._applyLifesteal(dealt);
        }
      }

      if (this.artifactTimer <= 0) {
        this.artifactGroup.visible = false;
      }
    }

    // 8. 更新【道魂领域 · 玄天三剑域】
    if (this.domainTimer > 0) {
      this.domainTimer -= dt;
      this.domainOuter.rotation.z += dt * 0.38;
      if (this.domainTimer <= 0) {
        this.domainGroup.visible = false;
        this.avatarGroup.visible = false;
      }
    }

    // 9. 更新所有流光飞剑投射物
    for (let i = this.flyingSwords.length - 1; i >= 0; i--) {
      const sw = this.flyingSwords[i];
      sw.life -= dt;

      // 自动弧线索敌导引
      const target =
        sw.preferredTarget && !sw.preferredTarget.dead
          ? sw.preferredTarget
          : this._findNearestEnemy(sw.pos, enemyManager, sw.hitSet, 24);

      if (target && sw.homingStrength > 0) {
        const desired = new THREE.Vector3(
          target.pos.x - sw.pos.x,
          1.45 - sw.pos.y,
          target.pos.z - sw.pos.z
        ).normalize().multiplyScalar(sw.vel.length());
        sw.vel.lerp(desired, Math.min(1, sw.homingStrength * dt));
      }

      sw.pos.addScaledVector(sw.vel, dt);
      sw.mesh.lookAt(sw.pos.x + sw.vel.x, sw.pos.y + sw.vel.y, sw.pos.z + sw.vel.z);
      sw.ribbon.pushPoint(sw.pos);

      // 碰撞检测
      for (const e of enemyManager.enemies) {
        if (e.dead || sw.hitSet.has(e)) continue;
        const d = Math.hypot(e.pos.x - sw.pos.x, e.pos.z - sw.pos.z);
        if (d <= e.radius + 0.95) {
          sw.hitSet.add(e);
          sw.pierce--;
          const isCrit = Math.random() < this.getCritChance();
          sfx.playHit(isCrit);
          this.vfx.spawnHitSlash(sw.pos.clone(), sw.color, isCrit ? 3.2 : 2.2);
          this.vfx.burstParticles(sw.pos, 6, sw.color, 9, 4, 0.28);

          const dealt = enemyManager.damageEnemy(
            e,
            sw.damage * (isCrit ? 1.85 : 1.0),
            {
              isCrit,
              addSwordMarks: sw.addMarks,
              style: sw.dmgStyle,
              label: sw.dmgLabel,
              inDomain: this.domainTimer > 0
            }
          );
          this._applyLifesteal(dealt);

          if (this.callbacks.onComboHit) this.callbacks.onComboHit();
          if (sw.pierce <= 0) break;
        }
      }

      if (sw.pierce <= 0 || sw.life <= 0 || Math.hypot(sw.pos.x, sw.pos.z) > ARENA_RADIUS + 8) {
        this.scene.remove(sw.mesh);
        sw.ribbon.dispose();
        this.flyingSwords.splice(i, 1);
      }
    }

    // 10. 更新弯月剑气波（青鸾剑凤波 & 元神黄金巨斩）
    for (let i = this.slashWaves.length - 1; i >= 0; i--) {
      const w = this.slashWaves[i];
      const step = w.vel.length() * dt;
      w.traveled += step;
      w.mesh.position.addScaledVector(w.vel, dt);

      const hitWidth = 2.6 * w.scale;
      for (const e of enemyManager.enemies) {
        if (e.dead || w.hitSet.has(e)) continue;
        const d = Math.hypot(e.pos.x - w.mesh.position.x, e.pos.z - w.mesh.position.z);
        if (d <= e.radius + hitWidth) {
          w.hitSet.add(e);
          const isCrit = Math.random() < this.getCritChance();
          sfx.playHit(true);
          this.vfx.spawnHitSlash(e.pos.clone().setY(1.6), w.color, 3.6);
          const dealt = enemyManager.damageEnemy(
            e,
            w.damage * (isCrit ? 1.85 : 1.0),
            {
              isCrit,
              addSwordMarks: w.addMarks,
              inDomain: this.domainTimer > 0
            }
          );
          this._applyLifesteal(dealt);
          if (this.callbacks.onComboHit) this.callbacks.onComboHit();
        }
      }

      const lifeRatio = w.traveled / w.maxDist;
      if (lifeRatio > 0.7) {
        w.mat.opacity = (1 - (lifeRatio - 0.7) / 0.3) * 0.95;
      }
      if (w.traveled >= w.maxDist) {
        this.scene.remove(w.mesh);
        w.mat.dispose();
        this.slashWaves.splice(i, 1);
      }
    }
  }

  _updateSwordSpirit(dt, now, enemyManager) {
    const target = this._findNearestEnemy(this.pos, enemyManager, null, 34);
    let desiredPos;
    if (target) {
      // 围绕敌人高速穿花刺击
      const orbitA = now * 6.5;
      desiredPos = new THREE.Vector3(
        target.pos.x + Math.cos(orbitA) * 2.2,
        1.7 + Math.sin(now * 4) * 0.4,
        target.pos.z + Math.sin(orbitA) * 2.2
      );
      this.spiritHitCd -= dt;
      if (this.spiritHitCd <= 0 && this.spiritPos.distanceTo(target.pos) < 4.5) {
        this.spiritHitCd = 0.38;
        const isCrit = Math.random() < this.getCritChance();
        this.vfx.spawnHitSlash(target.pos.clone().setY(1.6), 0xffe066, 2.4);
        enemyManager.damageEnemy(
          target,
          29000 * this.getDamageMultiplier() * (isCrit ? 1.8 : 1),
          { isCrit, addSwordMarks: 1, inDomain: this.domainTimer > 0 }
        );
        this.mp = Math.min(this.maxMp, this.mp + 1200);
      }
    } else {
      desiredPos = new THREE.Vector3(
        this.pos.x + Math.cos(now * 2.5) * 2.6,
        2.3,
        this.pos.z + Math.sin(now * 2.5) * 2.6
      );
    }

    const diff = desiredPos.sub(this.spiritPos);
    this.spiritVel.lerp(diff.multiplyScalar(7.5), Math.min(1, dt * 8));
    this.spiritPos.addScaledVector(this.spiritVel, dt);
    this.spiritSword.position.copy(this.spiritPos);
    this.spiritSword.lookAt(this.spiritPos.clone().add(this.spiritVel));
    this.spiritRibbon.pushPoint(this.spiritPos);
  }
}
