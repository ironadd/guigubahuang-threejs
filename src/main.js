import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { ImmortalArena, ARENA_RADIUS } from './arena.js';
import { VFXManager } from './vfx.js';
import { EnemyManager } from './enemies.js';
import { ImmortalPlayer, SKILL_META } from './player.js';
import { sfx } from './audio.js';

// ==================== 初始化渲染器与后处理 ====================
const container = document.getElementById('canvas-container');
const damageLayer = document.getElementById('damage-layer');
const vignetteEl = document.getElementById('screen-vignette');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 260);
camera.position.set(0, 32, 36);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22, // 大幅收敛辉光强度，彻底告别刺眼光污染
  0.24, // 紧凑锐利半径
  0.92  // 高阈值：仅极高光点有柔和微光，场景与招式清晰分明
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ==================== 战斗统计与全局演出状态 ====================
let started = false;
let autoPlay = false;
let cameraZoom = 1.05;
let shakeIntensity = 0;
let slowMoTimer = 0;
let comboCount = 0;
let comboResetTimer = 0;
const damageHistory = []; // { t, val } 用于计算滑动 3 秒 DPS

// Cut-in 水墨大招特写横幅控制
const cutinBanner = document.getElementById('cutin-banner');
const cutinSeal = document.getElementById('cutin-seal');
const cutinTitle = document.getElementById('cutin-title');
const cutinSub = document.getElementById('cutin-sub');
let cutinTimeout = null;

function triggerCutin(sealText, titleText, subText, isCrimson = false) {
  cutinSeal.textContent = sealText;
  cutinTitle.textContent = titleText;
  cutinSub.textContent = subText;
  cutinBanner.classList.remove('hidden');
  // 重新触发 CSS 动画
  cutinBanner.style.animation = 'none';
  void cutinBanner.offsetWidth;
  cutinBanner.style.animation = '';

  slowMoTimer = 0.22; // 瞬间仙威顿帧张力

  if (isCrimson) {
    vignetteEl.classList.add('immortal-active');
    setTimeout(() => vignetteEl.classList.remove('immortal-active'), 2800);
  }

  if (cutinTimeout) clearTimeout(cutinTimeout);
  cutinTimeout = setTimeout(() => {
    cutinBanner.classList.add('hidden');
  }, 2100);
}

// ==================== 实例化秘境、特效、大妖与登仙剑修 ====================
const arena = new ImmortalArena(scene);
const vfx = new VFXManager(scene, camera, damageLayer);

const bossCastTagEl = document.getElementById('boss-cast-tag');
const bossPhaseTextEl = document.getElementById('boss-phase-text');
const bossHpFillEl = document.getElementById('boss-hp-fill');

const enemyManager = new EnemyManager(scene, vfx, {
  onBossPhase2() {
    arena.setMood('boss_enrage', 6.0);
    shakeIntensity = Math.max(shakeIntensity, 0.95);
    bossHpFillEl.classList.add('enraged');
    bossPhaseTextEl.textContent = '第二重狂暴魔躯 · 九幽蚀日灭世';
    triggerCutin('凶威', '九 幽 蚀 日', '太古烛龙真魔狂暴 · 万妖朝宗', true);
  },
  onBossCastChange(text) {
    if (text) {
      bossCastTagEl.textContent = text;
      bossCastTagEl.classList.remove('hidden');
    } else {
      bossCastTagEl.classList.add('hidden');
    }
  },
  onDamageDealt(val) {
    damageHistory.push({ t: performance.now(), val });
  },
  onKill() {
    document.getElementById('stat-kills').textContent = enemyManager.kills.toString();
  }
});

const player = new ImmortalPlayer(scene, vfx, arena, {
  onCutin(seal, title, sub) {
    triggerCutin(seal, title, sub, seal === '仙法');
  },
  onScreenShake(amount) {
    shakeIntensity = Math.max(shakeIntensity, amount);
  },
  onPlayerHurt() {
    vignetteEl.classList.add('hurt-flash');
    setTimeout(() => vignetteEl.classList.remove('hurt-flash'), 220);
  },
  onComboHit() {
    comboCount++;
    comboResetTimer = 3.2;
  }
});

// ==================== 键鼠与 UI 交互绑定 ====================
const keys = {};
let isLmbDown = false;
const mouseNDC = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimWorldPos = new THREE.Vector3(0, 0, -10);

function updateAimFromMouse() {
  raycaster.setFromCamera(mouseNDC, camera);
  raycaster.ray.intersectPlane(groundPlane, aimWorldPos);
}

window.addEventListener('mousemove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('mousedown', (e) => {
  if (!started) return;
  // 忽略点在 UI 按钮上的点击
  if (e.target.closest('button') || e.target.closest('.skill-slot') || e.target.closest('.destiny-chip')) {
    return;
  }
  sfx.init();
  if (e.button === 0) {
    isLmbDown = true;
  } else if (e.button === 2) {
    updateAimFromMouse();
    flashSkillSlot('rmb');
    player.castSpecial(aimWorldPos, enemyManager);
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) isLmbDown = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener(
  'wheel',
  (e) => {
    cameraZoom = THREE.MathUtils.clamp(cameraZoom + e.deltaY * 0.0008, 0.62, 1.65);
  },
  { passive: true }
);

window.addEventListener('keydown', (e) => {
  const code = e.code;
  keys[code] = true;
  if (!started) return;
  sfx.init();

  if (code === 'Space') {
    e.preventDefault();
    if (player.castMovement()) flashSkillSlot('space');
  } else if (code === 'KeyE') {
    if (player.castArtifact()) flashSkillSlot('artifact');
  } else if (code === 'KeyQ') {
    if (player.castDomain()) flashSkillSlot('domain');
  } else if (code === 'KeyR') {
    updateAimFromMouse();
    if (player.castDivine(aimWorldPos, enemyManager)) flashSkillSlot('divine');
  } else if (code === 'KeyF') {
    if (player.castImmortalArt(enemyManager)) flashSkillSlot('immortal');
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// 底部技能槽点击释放与悬停词条卡片
const skillTooltip = document.getElementById('skill-tooltip');
document.querySelectorAll('.skill-slot').forEach((slot) => {
  const key = slot.dataset.skill;
  slot.addEventListener('mouseenter', () => {
    const info = SKILL_META[key];
    if (!info) return;
    skillTooltip.innerHTML = `
      <div class="tip-title">${info.name}</div>
      <div class="tip-meta">${info.meta}</div>
      <div class="tip-desc">${info.desc}</div>
    `;
    skillTooltip.classList.remove('hidden');
  });
  slot.addEventListener('mouseleave', () => {
    skillTooltip.classList.add('hidden');
  });
  slot.addEventListener('click', () => {
    if (!started) return;
    sfx.init();
    triggerSkillByKey(key);
  });
});

function triggerSkillByKey(key) {
  const target = enemyManager.boss && !enemyManager.boss.dead ? enemyManager.boss.pos : aimWorldPos;
  if (key === 'lmb') player.castPrimary(target, enemyManager);
  else if (key === 'rmb') player.castSpecial(target, enemyManager);
  else if (key === 'space') player.castMovement();
  else if (key === 'artifact') player.castArtifact();
  else if (key === 'domain') player.castDomain();
  else if (key === 'divine') player.castDivine(target, enemyManager);
  else if (key === 'immortal') player.castImmortalArt(enemyManager);
  flashSkillSlot(key);
}

function flashSkillSlot(key) {
  const el = document.querySelector(`.skill-slot[data-skill="${key}"]`);
  if (!el) return;
  el.classList.add('casting');
  setTimeout(() => el.classList.remove('casting'), 180);
}

// 逆天改命徽章悬浮提示
const destinyTip = document.getElementById('destiny-tooltip');
document.querySelectorAll('.destiny-chip').forEach((chip) => {
  chip.addEventListener('mouseenter', (e) => {
    destinyTip.textContent = chip.dataset.tip;
    destinyTip.classList.remove('hidden');
    destinyTip.style.left = `${Math.min(window.innerWidth - 295, e.clientX)}px`;
    destinyTip.style.top = `${e.clientY - 68}px`;
  });
  chip.addEventListener('mouseleave', () => {
    destinyTip.classList.add('hidden');
  });
});

// 右上角控制台按钮逻辑
const btnGod = document.getElementById('btn-godmode');
const btnAuto = document.getElementById('btn-autoplay');
const btnWave = document.getElementById('btn-wave');
const btnReset = document.getElementById('btn-reset-boss');
const btnAudio = document.getElementById('btn-audio');

btnGod.addEventListener('click', () => {
  player.godMode = !player.godMode;
  btnGod.classList.toggle('active', player.godMode);
  btnGod.textContent = player.godMode ? '⚡ 逆天满词条：开' : '⚡ 逆天满词条：关';
});

function setAutoPlayState(val) {
  autoPlay = val;
  btnAuto.classList.toggle('active', autoPlay);
  btnAuto.textContent = autoPlay ? '🤖 自动论道演示：开' : '🤖 自动论道演示：关';
}

btnAuto.addEventListener('click', () => {
  sfx.init();
  setAutoPlayState(!autoPlay);
});

btnWave.addEventListener('click', () => {
  sfx.init();
  enemyManager.spawnMinionWave(18);
});

btnReset.addEventListener('click', () => {
  sfx.init();
  enemyManager.spawnBoss();
  bossHpFillEl.classList.remove('enraged');
  bossPhaseTextEl.textContent = '第一重魔躯 · 荒古凶威';
  player.resetStatus();
});

btnAudio.addEventListener('click', () => {
  const on = sfx.toggle();
  btnAudio.classList.toggle('active', on);
  btnAudio.textContent = on ? '🔊 仙音剑鸣：开' : '🔇 仙音剑鸣：关';
});

// 入阵弹窗启动按钮
const introModal = document.getElementById('intro-modal');
document.getElementById('btn-start-game').addEventListener('click', () => {
  sfx.init();
  sfx.playImmortalBell(260);
  introModal.classList.add('hidden');
  started = true;
});

document.getElementById('btn-start-auto').addEventListener('click', () => {
  sfx.init();
  sfx.playImmortalBell(260);
  introModal.classList.add('hidden');
  started = true;
  setAutoPlayState(true);
});

// ==================== 自动论道巡航 AI 逻辑 ====================
let autoOrbitDir = 1;
let autoSwitchTimer = 3.5;

function computeAutoPlayInputs(dt, moveOut, aimOut) {
  autoSwitchTimer -= dt;
  if (autoSwitchTimer <= 0) {
    autoSwitchTimer = 2.5 + Math.random() * 2.5;
    autoOrbitDir *= -1;
  }

  // 选择主目标（优先 Boss，若 Boss 正在重生则选最近荒兽）
  let mainTarget = enemyManager.boss && !enemyManager.boss.dead ? enemyManager.boss : null;
  if (!mainTarget) {
    for (const e of enemyManager.enemies) {
      if (!e.dead) {
        mainTarget = e;
        break;
      }
    }
  }

  if (mainTarget) {
    aimOut.copy(mainTarget.pos);
    const dx = player.pos.x - mainTarget.pos.x;
    const dz = player.pos.z - mainTarget.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    // 维持约 15~19 米的飘逸御剑风筝距离并切向环绕
    const radialPush = dist < 13.5 ? 0.85 : dist > 21 ? -0.75 : 0;
    const nx = dx / dist;
    const nz = dz / dist;
    const tx = -nz * autoOrbitDir;
    const tz = nx * autoOrbitDir;
    moveOut.set(nx * radialPush + tx, 0, nz * radialPush + tz);
  } else {
    aimOut.set(0, 0, 0);
  }

  // 感知红圈危险：若处于红圈中则优先开启九天逍遥风（无敌身法）或闪避
  for (const dz of enemyManager.getActiveDangerZones()) {
    if (dz.shape === 'circle') {
      const d = Math.hypot(player.pos.x - dz.pos.x, player.pos.z - dz.pos.z);
      if (d < dz.radius + 1.5) {
        if (player.cds.space <= 0) {
          player.castMovement();
          flashSkillSlot('space');
        } else {
          moveOut.set(player.pos.x - dz.pos.x, 0, player.pos.z - dz.pos.z);
        }
      }
    }
  }

  // 自动连招：法宝 -> 道魂领域 -> 叠剑斩引爆绝技 -> 神通 -> 成道仙法
  if (player.cds.artifact <= 0 && player.artifactTimer <= 0) {
    player.castArtifact();
    flashSkillSlot('artifact');
  }
  if (player.cds.domain <= 0 && player.domainTimer <= 0) {
    player.castDomain();
    flashSkillSlot('domain');
  }
  if (mainTarget && mainTarget.swordMarks >= 14 && player.cds.rmb <= 0) {
    player.castSpecial(mainTarget.pos, enemyManager);
    flashSkillSlot('rmb');
  }
  if (player.cds.space <= 0 && enemyManager.enemies.length >= 6) {
    player.castMovement();
    flashSkillSlot('space');
  }
  if (player.cds.divine <= 0 && mainTarget) {
    player.castDivine(mainTarget.pos, enemyManager);
    flashSkillSlot('divine');
  } else if (player.cds.immortal <= 0 && player.cds.divine > 2.5 && mainTarget) {
    player.castImmortalArt(enemyManager);
    flashSkillSlot('immortal');
  }

  return Boolean(mainTarget);
}

// ==================== HUD 界面更新 ====================
const playerHpFill = document.getElementById('player-hp-fill');
const playerShieldFill = document.getElementById('player-shield-fill');
const playerHpText = document.getElementById('player-hp-text');
const playerMpFill = document.getElementById('player-mp-fill');
const playerMpText = document.getElementById('player-mp-text');
const bossHpDelayEl = document.getElementById('boss-hp-delay');
const bossHpTextEl = document.getElementById('boss-hp-text');
const minionCountEl = document.getElementById('minion-count-text');
const statDpsEl = document.getElementById('stat-dps');
const statComboEl = document.getElementById('stat-combo');
const buffBarEl = document.getElementById('buff-bar');

let hudTimer = 0;

function updateHUD(dt) {
  hudTimer += dt;
  if (hudTimer < 0.06) return;
  hudTimer = 0;

  // 1. 玩家血盾蓝条
  const hpPct = (player.hp / player.maxHp) * 100;
  const shieldPct = Math.min(100, (player.shield / player.maxHp) * 100);
  const mpPct = (player.mp / player.maxMp) * 100;
  playerHpFill.style.width = `${hpPct.toFixed(1)}%`;
  playerShieldFill.style.width = `${shieldPct.toFixed(1)}%`;
  playerHpText.textContent =
    player.shield > 0
      ? `${Math.round(player.hp).toLocaleString()} (+${Math.round(player.shield).toLocaleString()})`
      : `${Math.round(player.hp).toLocaleString()} / ${player.maxHp.toLocaleString()}`;
  playerMpFill.style.width = `${mpPct.toFixed(1)}%`;
  playerMpText.textContent = `${Math.round(player.mp).toLocaleString()} / ${player.maxMp.toLocaleString()}`;

  // 2. Boss 血条与小怪统计
  if (enemyManager.boss) {
    const b = enemyManager.boss;
    const bPct = Math.max(0, (b.hp / b.maxHp) * 100);
    bossHpFillEl.style.width = `${bPct.toFixed(2)}%`;
    bossHpDelayEl.style.width = `${bPct.toFixed(2)}%`;
    bossHpTextEl.textContent = `${Math.round(b.hp).toLocaleString()} / ${b.maxHp.toLocaleString()}`;
  }
  const minionCount = enemyManager.enemies.filter((e) => !e.isBoss && !e.dead).length;
  minionCountEl.textContent = `秘境荒兽：${minionCount}`;

  // 3. 技能冷却遮罩更新
  for (const key of Object.keys(player.cds)) {
    const rem = player.cds[key];
    const max = player.getEffectiveMaxCd(key);
    const overlay = document.getElementById(`cd-${key}`);
    const numEl = document.getElementById(`cdnum-${key}`);
    if (overlay && numEl) {
      if (rem > 0.05 && key !== 'lmb') {
        overlay.style.height = `${Math.min(100, (rem / max) * 100).toFixed(1)}%`;
        numEl.textContent = rem >= 1 ? Math.ceil(rem).toString() : rem.toFixed(1);
      } else {
        overlay.style.height = '0%';
        numEl.textContent = '';
      }
    }
  }

  // 4. 实时 DPS 与连斩统计
  const nowMs = performance.now();
  while (damageHistory.length > 0 && nowMs - damageHistory[0].t > 3000) {
    damageHistory.shift();
  }
  const sum3s = damageHistory.reduce((acc, item) => acc + item.val, 0);
  const dps = Math.round(sum3s / 3);
  statDpsEl.textContent = dps.toLocaleString();
  statComboEl.textContent = comboCount.toString();

  // 5. 动态战斗印记 Buff 标签栏
  const tags = [];
  const totalMarks = enemyManager.enemies.reduce((acc, e) => acc + (e.dead ? 0 : e.swordMarks), 0);
  if (totalMarks > 0) {
    tags.push(`<span class="buff-tag purple">【剑斩印记】×${totalMarks}</span>`);
  }
  if (player.windActive) {
    tags.push(`<span class="buff-tag">【逍遥风躯·无敌】${player.windTimer.toFixed(1)}s</span>`);
  }
  if (player.domainTimer > 0) {
    tags.push(`<span class="buff-tag gold">【玄天三剑域·法相】${player.domainTimer.toFixed(1)}s</span>`);
    vignetteEl.classList.add('domain-active');
  } else {
    vignetteEl.classList.remove('domain-active');
  }
  if (player.artifactTimer > 0) {
    tags.push(`<span class="buff-tag">【皇极天剑匣】${player.artifactTimer.toFixed(1)}s</span>`);
  }
  if (player.tianWaiTimer > 0) {
    tags.push(`<span class="buff-tag crimson">【天外有天 +40%暴击】${player.tianWaiTimer.toFixed(0)}s</span>`);
  }
  if (player.moveStacks >= 5) {
    tags.push(`<span class="buff-tag gold">【穿云电闪】+${Math.round(player.moveStacks)}%剑伤</span>`);
  }
  buffBarEl.innerHTML = tags.join('');
}

// ==================== 主游戏帧循环 ====================
const clock = new THREE.Clock();
const moveInput = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const rawDt = Math.min(0.05, clock.getDelta());
  let dt = rawDt;
  if (slowMoTimer > 0) {
    slowMoTimer -= rawDt;
    dt = rawDt * 0.28; // 大招开启瞬间仙威子弹时间
  }

  if (comboResetTimer > 0) {
    comboResetTimer -= rawDt;
    if (comboResetTimer <= 0) comboCount = 0;
  }

  moveInput.set(0, 0, 0);
  let firing = false;

  if (started) {
    const manualMove =
      keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
      keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];

    if (autoPlay && !manualMove && !isLmbDown) {
      firing = computeAutoPlayInputs(dt, moveInput, aimWorldPos);
    } else {
      if (keys['KeyW'] || keys['ArrowUp']) moveInput.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) moveInput.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) moveInput.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveInput.x += 1;
      updateAimFromMouse();
      firing = isLmbDown;
    }

    player.update(dt, moveInput, aimWorldPos, firing, enemyManager);
    enemyManager.update(dt, player, camera);
    vfx.update(dt);
    updateHUD(rawDt);
  }

  arena.update(dt, player.pos);

  // 修仙俯视镜头平滑跟随 + 准星前瞻偏移 + 震屏反馈
  const leadX = THREE.MathUtils.clamp((aimWorldPos.x - player.pos.x) * 0.16, -5.5, 5.5);
  const leadZ = THREE.MathUtils.clamp((aimWorldPos.z - player.pos.z) * 0.16, -5.5, 5.5);
  const desiredLookX = player.pos.x * 0.78 + leadX;
  const desiredLookZ = player.pos.z * 0.78 + leadZ;

  camTarget.lerp(new THREE.Vector3(desiredLookX, 1.2, desiredLookZ), Math.min(1, rawDt * 6.5));
  desiredCamPos.set(camTarget.x, 30 * cameraZoom, camTarget.z + 25.5 * cameraZoom);
  camera.position.lerp(desiredCamPos, Math.min(1, rawDt * 6.5));

  if (shakeIntensity > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity * 1.8;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity * 1.2;
    camera.position.z += (Math.random() - 0.5) * shakeIntensity * 1.8;
    shakeIntensity = Math.max(0, shakeIntensity - rawDt * 2.6);
  }

  camera.lookAt(camTarget);
  composer.render();
}

animate();
