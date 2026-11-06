import * as THREE from 'three';
import { ARENA_RADIUS } from './arena.js';
import { createDangerCircleTexture } from './textures.js';
import { sfx } from './audio.js';

export class EnemyManager {
  constructor(scene, vfx, callbacks) {
    this.scene = scene;
    this.vfx = vfx;
    this.callbacks = callbacks; // { onBossPhase2, onBossCastChange, onKill, onDamageDealt }

    this.enemies = []; // 包含 boss 和所有小怪
    this.boss = null;
    this.enemyProjectiles = [];
    this.dangerZones = []; // 地面红圈/矩形预警列表

    this.dangerCircleTex = createDangerCircleTexture();
    this.spawnTimer = 2.0;
    this.kills = 0;

    this.spawnBoss();
    this.spawnMinionWave(8);
  }

  // 构建登仙后期大妖 Boss：【太古凶神·九幽烛龙魔尊】
  spawnBoss() {
    if (this.boss) {
      if (this.boss.laserBeams) {
        this.scene.remove(this.boss.laserBeams);
        this.boss.laserBeams = null;
      }
      const idx = this.enemies.indexOf(this.boss);
      if (idx !== -1) this.enemies.splice(idx, 1);
      this.scene.remove(this.boss.mesh);
    }
    for (const dz of this.dangerZones) {
      this.scene.remove(dz.mesh);
    }
    this.dangerZones.length = 0;

    const root = new THREE.Group();
    root.position.set(0, 0, -16);

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // 暗金黑曜魔甲材质
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1c1224,
      emissive: 0x3b0d28,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      metalness: 0.75
    });
    const crimsonGlowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff2e4c).multiplyScalar(2.2)
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe6b35a,
      emissive: 0x6e4411,
      roughness: 0.3,
      metalness: 0.85
    });

    // 1. 魁梧悬浮魔躯胸甲与下摆魔裙
    const torso = new THREE.Mesh(new THREE.ConeGeometry(1.85, 3.8, 7), armorMat);
    torso.rotation.x = Math.PI;
    torso.position.y = 3.5;
    bodyGroup.add(torso);

    const lowerSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.9, 2.3, 8, 1, true), armorMat);
    lowerSkirt.position.y = 1.65;
    bodyGroup.add(lowerSkirt);

    // 胸口九幽魔核（高亮跳动红晶）
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), crimsonGlowMat);
    coreMesh.position.set(0, 3.65, 1.15);
    bodyGroup.add(coreMesh);

    // 双肩峥嵘魔铠
    for (const dir of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), armorMat);
      pauldron.position.set(dir * 2.05, 4.45, 0);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.45, 5), goldMat);
      spike.position.set(dir * 2.45, 5.2, 0);
      spike.rotation.z = -dir * 0.48;
      bodyGroup.add(pauldron, spike);
    }

    // 2. 魔尊头颅与冲天赤金烛龙双角
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 1.05), armorMat);
    head.position.set(0, 5.15, 0.2);
    bodyGroup.add(head);

    // 燃烧魔瞳
    for (const dir of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.12), crimsonGlowMat);
      eye.position.set(dir * 0.26, 5.22, 0.74);
      bodyGroup.add(eye);

      // 苍白赤金巨龙角
      const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.1, 6), crimsonGlowMat);
      horn1.position.set(dir * 0.65, 6.1, -0.05);
      horn1.rotation.z = -dir * 0.42;
      horn1.rotation.x = -0.22;
      bodyGroup.add(horn1);
    }

    // 3. 背后旋转的巨型【九幽血煞法轮】
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 4.3, -1.25);
    const mainRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.11, 8, 36),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff385c).multiplyScalar(1.9) })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.07, 6, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb84dff).multiplyScalar(1.8) })
    );
    haloGroup.add(mainRing, innerRing);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.1, 4), crimsonGlowMat);
      blade.position.set(Math.cos(a) * 2.95, Math.sin(a) * 2.95, 0);
      blade.rotation.z = a - Math.PI / 2;
      haloGroup.add(blade);
    }
    bodyGroup.add(haloGroup);

    // 4. 悬浮四臂魔渊巨刃
    const clawArms = [];
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const upper = i < 2 ? 1 : 0;
      const armPivot = new THREE.Group();
      armPivot.position.set(dir * (2.8 + upper * 0.6), 3.0 + upper * 1.6, 0.4);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.5, 4), crimsonGlowMat);
      blade.rotation.x = Math.PI * 0.55;
      blade.position.z = 1.1;
      armPivot.add(blade);
      bodyGroup.add(armPivot);
      clawArms.push({ pivot: armPivot, baseX: armPivot.position.x, baseY: armPivot.position.y, phase: i * 1.4 });
    }

    // 5. 脚下暗红魔气光环与【剑斩】印记环
    const footRing = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.65, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xff2a4b,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    footRing.position.y = 0.06;
    root.add(footRing);

    const markRing = this._createSwordMarkIndicator(2.9);
    root.add(markRing);

    this.scene.add(root);

    this.boss = {
      isBoss: true,
      name: '太古凶神 · 九幽烛龙魔尊',
      mesh: root,
      bodyGroup,
      haloGroup,
      clawArms,
      coreMesh,
      armorMat,
      markRing,
      pos: root.position,
      radius: 2.35,
      maxHp: 5000000,
      hp: 5000000,
      enraged: false,
      swordMarks: 0,
      flashTimer: 0,
      aiState: 'idle',
      stateTimer: 1.5,
      skillIndex: 0,
      spiralTimer: 0,
      spiralAngle: 0,
      dashDir: new THREE.Vector3(),
      dashTarget: new THREE.Vector3(),
      laserBeams: null,
      dead: false
    };

    this.enemies.push(this.boss);
    if (this.callbacks.onBossCastChange) {
      this.callbacks.onBossCastChange('');
    }
  }

  // 批量召唤冥山荒兽群（小怪割草体验）
  spawnMinionWave(count = 14) {
    // 限制同屏上限以保持丝滑帧率
    const currentMinions = this.enemies.filter((e) => !e.isBoss && !e.dead).length;
    const toSpawn = Math.min(count, Math.max(0, 46 - currentMinions));

    for (let i = 0; i < toSpawn; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = ARENA_RADIUS - 3.5 - Math.random() * 6;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;

      const roll = Math.random();
      let kind = 'wolf';
      if (roll > 0.72) kind = 'mage';
      else if (roll > 0.42) kind = 'guard';

      this._createMinion(kind, x, z);
    }
  }

  _createMinion(kind, x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);

    let hp = 95000;
    let speed = 8.8;
    let radius = 0.95;
    let bodyMat;

    if (kind === 'wolf') {
      // 冥渊魔狼：迅捷黑红棱刺兽躯
      bodyMat = new THREE.MeshStandardMaterial({
        color: 0x2a1421,
        emissive: 0x5c1124,
        roughness: 0.5
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 1.65), bodyMat);
      body.position.y = 0.65;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 5), bodyMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0.85, 1.0);
      const backSpike = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.75, 4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff425e).multiplyScalar(1.8) })
      );
      backSpike.position.set(0, 1.2, 0);
      root.add(body, head, backSpike);
      hp = 85000;
      speed = 9.8;
      radius = 0.9;
    } else if (kind === 'guard') {
      // 荒古重甲骨卫：魁梧青铜紫炎战鬼
      bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1d2b38,
        emissive: 0x19384a,
        roughness: 0.4,
        metalness: 0.65
      });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 1.85, 6), bodyMat);
      torso.position.y = 1.25;
      const helm = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0x52e5ff).multiplyScalar(1.6) })
      );
      helm.position.y = 2.45;
      root.add(torso, helm);
      hp = 165000;
      speed = 6.2;
      radius = 1.15;
    } else {
      // 九幽邪修妖魂：悬浮紫火法袍
      bodyMat = new THREE.MeshStandardMaterial({
        color: 0x26163b,
        emissive: 0x4b1d7a,
        roughness: 0.45
      });
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.0, 7), bodyMat);
      robe.position.y = 1.35;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd16bff).multiplyScalar(2.0) })
      );
      orb.position.set(0, 2.55, 0);
      root.add(robe, orb);
      hp = 78000;
      speed = 5.4;
      radius = 0.9;
    }

    // 头顶简易小血条
    const hpBarBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x140a0d, side: THREE.DoubleSide })
    );
    hpBarBg.position.y = kind === 'wolf' ? 1.85 : 3.05;

    const hpFillGeo = new THREE.PlaneGeometry(1.44, 0.11);
    hpFillGeo.translate(0.72, 0, 0);
    const hpBarFill = new THREE.Mesh(
      hpFillGeo,
      new THREE.MeshBasicMaterial({ color: 0xe63946, side: THREE.DoubleSide })
    );
    hpBarFill.position.set(-0.72, 0, 0.01);
    hpBarBg.add(hpBarFill);
    root.add(hpBarBg);

    const markRing = this._createSwordMarkIndicator(radius + 0.35);
    root.add(markRing);

    this.scene.add(root);
    this.vfx.spawnShockwave(root.position, 2.2, 0xb84dff, 0.35);

    this.enemies.push({
      isBoss: false,
      kind,
      mesh: root,
      bodyMat,
      hpBarBg,
      hpBarFill,
      markRing,
      pos: root.position,
      radius,
      maxHp: hp,
      hp,
      speed,
      swordMarks: 0,
      flashTimer: 0,
      attackCd: 1.2 + Math.random() * 1.5,
      dead: false
    });
  }

  _createSwordMarkIndicator(radius) {
    const geo = new THREE.RingGeometry(radius, radius + 0.18, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x5cf7ee).multiplyScalar(1.9),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.08;
    return mesh;
  }

  // 对单个敌人施加伤害与【剑斩】叠层
  damageEnemy(enemy, rawAmount, {
    isCrit = false,
    addSwordMarks = 0,
    style = 'normal',
    label = '',
    inDomain = false
  } = {}) {
    if (!enemy || enemy.dead) return 0;

    let amount = rawAmount;
    if (inDomain) {
      amount *= 1.5; // 玄天三剑域易伤 +50%
    }

    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.flashTimer = 0.09;

    if (addSwordMarks > 0) {
      enemy.swordMarks = Math.min(99, enemy.swordMarks + addSwordMarks);
    }

    // 飘字类型
    let textStyle = style;
    if (textStyle === 'normal' && isCrit) textStyle = 'crit';
    this.vfx.spawnDamageText(enemy.pos, amount, textStyle, label || (isCrit && style === 'normal' ? '暴击' : ''));

    if (this.callbacks.onDamageDealt) {
      this.callbacks.onDamageDealt(amount);
    }

    // 检查大妖二阶段狂暴
    if (enemy.isBoss && !enemy.enraged && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.55) {
      this._triggerBossEnrage(enemy);
    }

    // 死亡结算
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true;
      this.kills++;
      this.vfx.burstParticles(enemy.pos.clone().setY(1.4), enemy.isBoss ? 90 : 22, 0xff3d5a, enemy.isBoss ? 24 : 11, 9, 0.75);
      this.vfx.spawnShockwave(enemy.pos, enemy.isBoss ? 18 : 3.2, 0xff4760, enemy.isBoss ? 0.85 : 0.32);

      if (this.callbacks.onKill) {
        this.callbacks.onKill(enemy);
      }

      if (enemy.isBoss) {
        if (enemy.laserBeams) {
          this.scene.remove(enemy.laserBeams);
          enemy.laserBeams = null;
        }
        if (this.callbacks.onBossCastChange) {
          this.callbacks.onBossCastChange('已伏诛（3秒后重聚真身）');
        }
        // 大妖被轰杀后 3.5 秒自动涅槃重塑更高战意真身，保证演武不冷场
        setTimeout(() => {
          if (this.boss && this.boss.dead) {
            this.spawnBoss();
          }
        }, 3500);
      } else {
        this.scene.remove(enemy.mesh);
      }
    }

    return amount;
  }

  // 范围伤害辅助
  damageArea(center, radius, baseDamage, critChance, opts = {}) {
    let total = 0;
    let hitCount = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - center.x, e.pos.z - center.z);
      if (d <= radius + e.radius) {
        const isCrit = Math.random() < critChance;
        const dmg = baseDamage * (0.92 + Math.random() * 0.16) * (isCrit ? 1.85 : 1.0);
        total += this.damageEnemy(e, dmg, { ...opts, isCrit });
        hitCount++;
      }
    }
    return { total, hitCount };
  }

  _triggerBossEnrage(boss) {
    boss.enraged = true;
    boss.mesh.scale.setScalar(1.18);
    boss.armorMat.emissive.setHex(0x7a0e48);
    boss.armorMat.emissiveIntensity = 1.25;
    sfx.playCataclysmImpact();
    this.vfx.spawnShockwave(boss.pos, 24, 0xff2255, 0.85);
    this.vfx.spawnSkyPillar(boss.pos, 3.2, 38, 0xff2255, 0.9);
    this.spawnMinionWave(10);
    if (this.callbacks.onBossPhase2) {
      this.callbacks.onBossPhase2();
    }
  }

  // 创建圆形朱砂红圈预警
  spawnCircleDanger(pos, radius, delay, onTrigger) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.06, pos.z);

    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: this.dangerCircleTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      })
    );
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xff2b3a,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    fill.scale.setScalar(0.05);
    group.add(outer, fill);
    this.scene.add(group);

    this.dangerZones.push({
      shape: 'circle',
      mesh: group,
      fill,
      pos: new THREE.Vector3(pos.x, 0, pos.z),
      radius,
      age: 0,
      delay,
      onTrigger
    });
  }

  // 创建长条矩形预警走廊（裂地斩、冲锋）
  spawnRectDanger(origin, angle, length, width, delay, onTrigger) {
    const group = new THREE.Group();
    group.position.set(origin.x, 0.06, origin.z);
    group.rotation.y = angle;

    const borderGeo = new THREE.PlaneGeometry(width, length);
    borderGeo.rotateX(-Math.PI / 2);
    borderGeo.translate(0, 0, length / 2);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xc91e2c,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const border = new THREE.Mesh(borderGeo, borderMat);

    const fillGeo = new THREE.PlaneGeometry(width * 0.94, length);
    fillGeo.rotateX(-Math.PI / 2);
    fillGeo.translate(0, 0, length / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff4a3d,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.scale.set(1, 1, 0.02);

    group.add(border, fill);
    this.scene.add(group);

    this.dangerZones.push({
      shape: 'rect',
      mesh: group,
      fill,
      origin: origin.clone(),
      angle,
      length,
      width,
      age: 0,
      delay,
      onTrigger
    });
  }

  // 发射敌人妖火弹幕球
  spawnEnemyOrb(origin, dir, speed = 15, damage = 9500, colorHex = 0xff3b7f, radius = 0.48) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 10, 10),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex).multiplyScalar(2.1)
      })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.enemyProjectiles.push({
      mesh,
      vel: dir.clone().normalize().multiplyScalar(speed),
      damage,
      radius,
      life: 5.5
    });
  }

  // 供玩家 AI 自动巡航检测危险红圈中心
  getActiveDangerZones() {
    return this.dangerZones;
  }

  update(dt, player, camera) {
    const inDomain = player.domainTimer > 0;
    const domainCenter = player.domainPos;
    const domainRadius = 22.5;

    // 定期补充少量荒兽供叠剑斩与吸血
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6.5;
      const aliveMinions = this.enemies.filter((e) => !e.isBoss && !e.dead).length;
      if (aliveMinions < 8) {
        this.spawnMinionWave(6);
      }
    }

    // 1. 更新红圈预警倒计时与触发
    for (let i = this.dangerZones.length - 1; i >= 0; i--) {
      const dz = this.dangerZones[i];
      dz.age += dt;
      const p = Math.min(1, dz.age / dz.delay);
      if (dz.shape === 'circle') {
        dz.fill.scale.setScalar(0.08 + p * 0.92);
      } else {
        dz.fill.scale.set(1, 1, 0.04 + p * 0.96);
      }
      if (dz.age >= dz.delay) {
        this.scene.remove(dz.mesh);
        dz.mesh.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        dz.onTrigger();
        this.dangerZones.splice(i, 1);
      }
    }

    // 2. 更新敌人弹幕球
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const orb = this.enemyProjectiles[i];
      orb.life -= dt;
      orb.mesh.position.addScaledVector(orb.vel, dt);

      const dPlayer = Math.hypot(orb.mesh.position.x - player.pos.x, orb.mesh.position.z - player.pos.z);
      if (dPlayer < orb.radius + 0.85) {
        player.takeDamage(orb.damage);
        this.vfx.burstParticles(orb.mesh.position, 8, 0xff4588, 7, 3, 0.3);
        this.scene.remove(orb.mesh);
        orb.mesh.geometry.dispose();
        orb.mesh.material.dispose();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (orb.life <= 0 || Math.hypot(orb.mesh.position.x, orb.mesh.position.z) > ARENA_RADIUS + 4) {
        this.scene.remove(orb.mesh);
        orb.mesh.geometry.dispose();
        orb.mesh.material.dispose();
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // 3. 更新所有敌人与 Boss
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        if (!e.isBoss) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // 判断是否处于玩家的玄天三剑域内
      const insideDomain =
        inDomain && Math.hypot(e.pos.x - domainCenter.x, e.pos.z - domainCenter.z) <= domainRadius;
      const slowMult = insideDomain ? 0.56 : 1.0;

      // 剑斩层数光环显隐与旋转
      if (e.swordMarks > 0) {
        e.markRing.material.opacity = Math.min(0.92, 0.25 + e.swordMarks * 0.02);
        e.markRing.rotation.z += dt * (2.2 + e.swordMarks * 0.08);
      } else {
        e.markRing.material.opacity = 0;
      }

      // 受击闪光恢复
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        const mat = e.isBoss ? e.armorMat : e.bodyMat;
        if (mat) mat.emissiveIntensity = e.flashTimer > 0 ? 2.6 : e.isBoss && e.enraged ? 1.25 : 0.65;
      }

      if (e.isBoss) {
        this._updateBossAI(e, dt, slowMult, player, insideDomain);
      } else {
        this._updateMinionAI(e, dt, slowMult, player, camera);
      }

      // 场地圆形结界约束
      const distFromCenter = Math.hypot(e.pos.x, e.pos.z);
      if (distFromCenter > ARENA_RADIUS - e.radius) {
        const ratio = (ARENA_RADIUS - e.radius) / distFromCenter;
        e.pos.x *= ratio;
        e.pos.z *= ratio;
      }
    }
  }

  _updateMinionAI(e, dt, slowMult, player, camera) {
    // 小怪头顶血条始终朝向镜头
    e.hpBarBg.quaternion.copy(camera.quaternion);
    e.hpBarFill.scale.x = Math.max(0, e.hp / e.maxHp);

    // 受到玩家九天逍遥风（风身法）飓风牵引聚怪效果！
    if (player.windActive) {
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.8 && dist < 17.5) {
        const pull = 13.5 * dt;
        e.pos.x += (dx / dist) * pull;
        e.pos.z += (dz / dist) * pull;
      }
    }

    const dx = player.pos.x - e.pos.x;
    const dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    e.mesh.rotation.y = Math.atan2(dx, dz);

    const stopDist = e.kind === 'mage' ? 14.5 : e.radius + 1.3;
    if (dist > stopDist) {
      const step = e.speed * slowMult * dt;
      e.pos.x += (dx / dist) * step;
      e.pos.z += (dz / dist) * step;
    }

    e.attackCd -= dt * slowMult;
    if (e.attackCd <= 0) {
      if (e.kind === 'mage' && dist < 24) {
        e.attackCd = 2.6;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        this.spawnEnemyOrb(e.pos.clone().setY(1.6), dir, 13.5, 6500, 0xd16bff, 0.38);
      } else if (dist <= stopDist + 1.0) {
        e.attackCd = 1.5;
        player.takeDamage(e.kind === 'guard' ? 9200 : 5800);
      }
    }
  }

  _updateBossAI(boss, dt, slowMult, player) {
    const t = performance.now() * 0.001;
    // 悬浮呼吸与法轮旋转动画
    boss.bodyGroup.position.y = Math.sin(t * 2.4) * 0.25;
    boss.haloGroup.rotation.z -= dt * (boss.enraged ? 2.4 : 1.15);
    boss.coreMesh.rotation.y += dt * 3.0;
    for (const arm of boss.clawArms) {
      arm.pivot.position.y = arm.baseY + Math.sin(t * 3.2 + arm.phase) * 0.22;
    }

    const dx = player.pos.x - boss.pos.x;
    const dz = player.pos.z - boss.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;

    if (boss.aiState !== 'dashing' && boss.aiState !== 'laser') {
      const targetYaw = Math.atan2(dx, dz);
      // 平滑转向玩家
      let diff = targetYaw - boss.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      boss.mesh.rotation.y += diff * Math.min(1, dt * 6);
    }

    const speedFactor = (boss.enraged ? 1.28 : 1.0) * slowMult;
    boss.stateTimer -= dt * speedFactor;

    if (boss.aiState === 'idle') {
      // 缓慢压迫逼近玩家
      if (dist > 9.5) {
        boss.pos.x += (dx / dist) * 5.8 * speedFactor * dt;
        boss.pos.z += (dz / dist) * 5.8 * speedFactor * dt;
      }
      if (boss.stateTimer <= 0) {
        this._pickNextBossSkill(boss, player);
      }
    } else if (boss.aiState === 'spiral') {
      // 持续释放九幽螺旋弹幕
      boss.spiralTimer -= dt;
      if (boss.spiralTimer <= 0) {
        boss.spiralTimer = boss.enraged ? 0.11 : 0.14;
        boss.spiralAngle += 0.36;
        const arms = boss.enraged ? 5 : 4;
        for (let k = 0; k < arms; k++) {
          const a = boss.spiralAngle + (k * Math.PI * 2) / arms;
          const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
          this.spawnEnemyOrb(
            boss.pos.clone().setY(1.5),
            dir,
            boss.enraged ? 16.5 : 13.5,
            11000,
            k % 2 === 0 ? 0xff2e63 : 0xb53dff,
            0.52
          );
        }
      }
      if (boss.stateTimer <= 0) {
        boss.aiState = 'idle';
        boss.stateTimer = 1.6;
        if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('');
      }
    } else if (boss.aiState === 'dashing') {
      // 凶神狂飙突进
      boss.pos.addScaledVector(boss.dashDir, 38 * dt);
      this.vfx.burstParticles(boss.pos.clone().setY(1.5), 4, 0xff2950, 6, 3, 0.25);
      if (Math.hypot(player.pos.x - boss.pos.x, player.pos.z - boss.pos.z) < boss.radius + 1.4) {
        player.takeDamage(18500);
      }
      if (boss.stateTimer <= 0) {
        // 冲锋终点大地震荡
        sfx.playThunder();
        this.vfx.spawnShockwave(boss.pos, 9.5, 0xff304f, 0.5);
        if (Math.hypot(player.pos.x - boss.pos.x, player.pos.z - boss.pos.z) < 9.2) {
          player.takeDamage(21000);
        }
        boss.aiState = 'idle';
        boss.stateTimer = 1.5;
        if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('');
      }
    } else if (boss.aiState === 'laser') {
      // 二阶段专属：四道九幽蚀日毁灭射线旋转扫场
      if (boss.laserBeams) {
        boss.laserBeams.position.copy(boss.pos).setY(1.3);
        boss.laserBeams.rotation.y += dt * 0.92;
        const baseYaw = boss.laserBeams.rotation.y;
        for (let k = 0; k < 4; k++) {
          const beamAngle = baseYaw + (k * Math.PI) / 2;
          // 点到射线距离判定
          const bx = Math.sin(beamAngle);
          const bz = Math.cos(beamAngle);
          const px = player.pos.x - boss.pos.x;
          const pz = player.pos.z - boss.pos.z;
          const proj = px * bx + pz * bz;
          if (proj > 0 && proj < 36) {
            const perp = Math.abs(px * bz - pz * bx);
            if (perp < 1.15) {
              player.takeDamage(14000 * dt * 4);
            }
          }
        }
      }
      if (boss.stateTimer <= 0) {
        if (boss.laserBeams) {
          this.scene.remove(boss.laserBeams);
          boss.laserBeams = null;
        }
        boss.aiState = 'idle';
        boss.stateTimer = 1.6;
        if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('');
      }
    } else if (boss.aiState === 'casting') {
      if (boss.stateTimer <= 0) {
        boss.aiState = 'idle';
        boss.stateTimer = 1.4;
        if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('');
      }
    }
  }

  _pickNextBossSkill(boss, player) {
    const pool = boss.enraged ? ['cleave', 'meteors', 'spiral', 'dash', 'laser'] : ['cleave', 'meteors', 'spiral', 'dash'];
    const choice = pool[boss.skillIndex % pool.length];
    boss.skillIndex++;

    const baseAngle = Math.atan2(player.pos.x - boss.pos.x, player.pos.z - boss.pos.z);

    if (choice === 'cleave') {
      // 1. 九幽裂地三连斩（三条扇形预警走廊）
      boss.aiState = 'casting';
      boss.stateTimer = 1.35;
      if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('蓄势：九幽裂地三连斩');
      const spreads = boss.enraged ? [-0.48, -0.24, 0, 0.24, 0.48] : [-0.32, 0, 0.32];
      const origin = boss.pos.clone();
      spreads.forEach((offset) => {
        const ang = baseAngle + offset;
        this.spawnRectDanger(origin, ang, 30, 3.1, 1.1, () => {
          if (boss.dead) return;
          sfx.playGiantSlash();
          const mid = origin.clone().add(new THREE.Vector3(Math.sin(ang) * 15, 0, Math.cos(ang) * 15));
          this.vfx.spawnGroundScar(mid, -ang + Math.PI / 2, 30, 0.9, 0xff2952, 2.0);
          this.vfx.burstParticles(mid.clone().setY(0.8), 18, 0xff2952, 12, 6, 0.45);
          // 矩形命中检测
          const rx = player.pos.x - origin.x;
          const rz = player.pos.z - origin.z;
          const forward = rx * Math.sin(ang) + rz * Math.cos(ang);
          const side = Math.abs(rx * Math.cos(ang) - rz * Math.sin(ang));
          if (forward >= 0 && forward <= 30.5 && side <= 1.85) {
            player.takeDamage(22000);
          }
        });
      });
    } else if (choice === 'meteors') {
      // 2. 荒古血陨天降（多重红圈轰炸）
      boss.aiState = 'casting';
      boss.stateTimer = 1.5;
      if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('蓄势：荒古九幽魔陨');
      const count = boss.enraged ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const target =
          i === 0
            ? player.pos.clone()
            : new THREE.Vector3(
                player.pos.x + (Math.random() - 0.5) * 22,
                0,
                player.pos.z + (Math.random() - 0.5) * 22
              );
        const d = Math.hypot(target.x, target.z);
        if (d > ARENA_RADIUS - 4) {
          target.multiplyScalar((ARENA_RADIUS - 4) / d);
        }
        this.spawnCircleDanger(target, 4.5, 1.15 + i * 0.1, () => {
          if (boss.dead) return;
          sfx.playThunder();
          this.vfx.spawnSkyPillar(target, 2.2, 28, 0xff2e55, 0.45);
          this.vfx.spawnShockwave(target, 4.8, 0xff3b5c, 0.4);
          this.vfx.burstParticles(target.clone().setY(0.8), 20, 0xff3b5c, 14, 8, 0.5);
          if (Math.hypot(player.pos.x - target.x, player.pos.z - target.z) <= 4.7) {
            player.takeDamage(19500);
          }
        });
      }
    } else if (choice === 'spiral') {
      // 3. 蚀日螺旋弹幕大阵
      boss.aiState = 'spiral';
      boss.stateTimer = 2.7;
      boss.spiralTimer = 0.2;
      if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('施展：九幽噬魂弹幕');
    } else if (choice === 'dash') {
      // 4. 凶神冲撞长廊预警
      boss.aiState = 'casting';
      boss.stateTimer = 1.65;
      if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('蓄势：凶神裂空冲撞');
      const origin = boss.pos.clone();
      const dashLen = Math.min(28, Math.hypot(player.pos.x - origin.x, player.pos.z - origin.z) + 7);
      this.spawnRectDanger(origin, baseAngle, dashLen, 4.6, 0.92, () => {
        if (boss.dead) return;
        sfx.playWindDash();
        boss.aiState = 'dashing';
        boss.dashDir.set(Math.sin(baseAngle), 0, Math.cos(baseAngle));
        boss.mesh.rotation.y = baseAngle;
        boss.stateTimer = dashLen / 38;
      });
    } else if (choice === 'laser') {
      // 5. 二阶段专属：九幽蚀日十字旋转魔光
      boss.aiState = 'casting';
      boss.stateTimer = 4.2;
      if (this.callbacks.onBossCastChange) this.callbacks.onBossCastChange('凶神极招：九幽蚀日魔光');
      this.spawnCircleDanger(boss.pos, 6.0, 0.9, () => {
        if (boss.dead) return;
        sfx.playImmortalBell(140);
        const beamGroup = new THREE.Group();
        beamGroup.position.copy(boss.pos).setY(1.3);
        const beamMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(0xff2458).multiplyScalar(2.6),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        });
        for (let k = 0; k < 4; k++) {
          const geo = new THREE.CylinderGeometry(0.38, 0.38, 36, 10);
          geo.rotateX(Math.PI / 2);
          geo.translate(0, 0, 18);
          const m = new THREE.Mesh(geo, beamMat);
          m.rotation.y = (k * Math.PI) / 2;
          beamGroup.add(m);
        }
        this.scene.add(beamGroup);
        boss.laserBeams = beamGroup;
        boss.aiState = 'laser';
        boss.stateTimer = 3.2;
      });
    }
  }
}
