/* COREFALL TD — procedural audio (WebAudio, no assets) */
'use strict';

const Sfx = {
  ctx: null,
  lastPlay: {},
  master: null,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  get muted() { return SaveSys.data.settings.mute; },

  /* rate-limit identical sounds so mass events don't clip into noise */
  throttle(name, ms) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < ms) return true;
    this.lastPlay[name] = now;
    return false;
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  noise(dur, vol, freq, delay) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },

  shoot(kind) {
    if (this.throttle('shoot' + kind, 45)) return;
    switch (kind) {
      case 'arrow':  this.tone(880, 0.06, 'square', 0.18, 500); break;
      case 'cannon': this.noise(0.18, 0.35, 500); this.tone(120, 0.15, 'sine', 0.4, 50); break;
      case 'frost':  this.tone(1400, 0.1, 'sine', 0.16, 1900); break;
      case 'sniper': this.tone(200, 0.12, 'sawtooth', 0.3, 60); this.noise(0.08, 0.2, 3000); break;
      case 'tesla':  this.noise(0.12, 0.25, 4000); this.tone(1800, 0.08, 'sawtooth', 0.12, 400); break;
      case 'venom':  this.tone(320, 0.09, 'triangle', 0.2, 180); break;
    }
  },

  hit()    { if (!this.throttle('hit', 60)) this.noise(0.05, 0.12, 2500); },
  die()    { if (!this.throttle('die', 70)) { this.tone(300, 0.12, 'square', 0.2, 90); } },
  bossDie(){ this.noise(0.7, 0.6, 800); this.tone(90, 0.6, 'sawtooth', 0.5, 30); },
  leak()   { this.tone(220, 0.3, 'sawtooth', 0.4, 110); this.tone(160, 0.35, 'sawtooth', 0.3, 80, 0.08); },
  ui()     { if (!this.throttle('ui', 40)) this.tone(660, 0.05, 'sine', 0.25, 880); },
  place()  { this.tone(440, 0.08, 'triangle', 0.3, 660); this.tone(660, 0.1, 'triangle', 0.25, 880, 0.06); },
  upgrade(){ [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, null, i * 0.07)); },
  sell()   { this.tone(784, 0.08, 'triangle', 0.25, 523); },
  waveStart(){ this.tone(392, 0.12, 'square', 0.3, 392); this.tone(523, 0.16, 'square', 0.3, 523, 0.1); },
  bossWarn(){ [220, 220, 220].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.35, 200, i * 0.28)); },
  gold()   { if (!this.throttle('gold', 90)) this.tone(1320, 0.06, 'sine', 0.14, 1760); },
  achUnlock(){ [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.35, null, i * 0.09)); },
  techBuy(){ [440, 587, 880].forEach((f, i) => this.tone(f, 0.12, 'square', 0.25, null, i * 0.06)); },
  levelUp(){ [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.3, null, i * 0.08)); },
  win()    { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.35, null, i * 0.13)); },
  lose()   { [440, 415, 349, 262].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.3, f * 0.95, i * 0.2)); },
};
