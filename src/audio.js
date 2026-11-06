// 程序化古风修仙音效引擎 (Web Audio API)
class ImmortalAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.lastTime = {};
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.34;

    // 简易动态压缩防爆音
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    this.masterGain.connect(compressor);
    compressor.connect(this.ctx.destination);

    // 预生成白噪声 Buffer（用于剑风、雷震、罡风）
    const length = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  canPlay(tag, minIntervalMs) {
    if (!this.enabled || !this.ctx) return false;
    const now = performance.now();
    if (this.lastTime[tag] && now - this.lastTime[tag] < minIntervalMs) {
      return false;
    }
    this.lastTime[tag] = now;
    return true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this.init();
    return this.enabled;
  }

  // 1. 清风月影飞剑破空铮鸣
  playSwordShoot(pitchShift = 1.0) {
    if (!this.canPlay('shoot', 58)) return;
    const t = this.ctx.currentTime;
    const base = (880 + Math.random() * 320) * pitchShift;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base * 1.45, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.65, t + 0.11);

    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  // 2. 飞剑命中金铁清脆声
  playHit(isCrit = false) {
    if (!this.canPlay('hit', 45)) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'sine';
    const freq = isCrit ? 1750 + Math.random() * 450 : 1150 + Math.random() * 300;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.085);

    gain.gain.setValueAtTime(isCrit ? 0.16 : 0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 3. 青鸾冥羽剑凤长吟 / 元神法相巨剑挥斩
  playGiantSlash() {
    if (!this.canPlay('giantSlash', 180)) return;
    const t = this.ctx.currentTime;

    // 剑鸣泛音
    const osc = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(185, t + 0.34);
    g1.gain.setValueAtTime(0.22, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.34);

    osc.connect(filter);
    filter.connect(g1);
    g1.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.36);

    // 破风声
    this._playFilteredNoise(0.28, 950, 260, 0.2);
  }

  // 4. 绝技：万神绝影剑阵落剑轰鸣
  playSpecialBurst() {
    if (!this.canPlay('special', 220)) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const st = t + idx * 0.045;
      osc.frequency.setValueAtTime(f * 1.5, st);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, st + 0.32);
      g.gain.setValueAtTime(0.18, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.34);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(st);
      osc.stop(st + 0.35);
    });
    this._playFilteredNoise(0.38, 600, 110, 0.28);
  }

  // 5. 身法：九天逍遥风罡风呼啸
  playWindDash() {
    if (!this.canPlay('wind', 300)) return;
    this._playFilteredNoise(0.75, 420, 1450, 0.26);
  }

  // 6. 紫霄神雷（法宝皇极剑匣）
  playThunder() {
    if (!this.canPlay('thunder', 160)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.28);
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.31);
    this._playFilteredNoise(0.24, 1800, 240, 0.22);
  }

  // 7. 道魂领域 / 神通开启：太古仙钟嗡鸣
  playImmortalBell(pitch = 220) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const partials = [1, 1.5, 2.02, 2.98, 4.15];
    partials.forEach((ratio, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch * ratio, t);
      const amp = 0.26 / (idx + 1);
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6 - idx * 0.18);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.65);
    });
  }

  // 8. 百丈巨剑轰然坠地 / 诛仙阵终极爆裂
  playCataclysmImpact() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;

    // 超重低频冲击
    const sub = this.ctx.createOscillator();
    const subG = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.95);
    subG.gain.setValueAtTime(0.55, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    sub.connect(subG);
    subG.connect(this.masterGain);
    sub.start(t);
    sub.stop(t + 1.02);

    // 轰雷爆裂噪声
    this._playFilteredNoise(0.95, 1100, 75, 0.48);
  }

  // 9. 次元空间剑痕切割声（太上诛仙阵连斩）
  playDimensionSlice(step = 0) {
    if (!this.canPlay('dimSlice', 55)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const f = 900 + (step % 8) * 160;
    osc.frequency.setValueAtTime(f * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.15);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  _playFilteredNoise(duration, startFreq, endFreq, volume) {
    if (!this.noiseBuffer || !this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(startFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(t);
    src.stop(t + duration);
  }
}

export const sfx = new ImmortalAudio();
