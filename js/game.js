/* COREFALL TD — core game engine: run state, waves, combat, rendering */
'use strict';

const Game = {
  g: null,
  canvas: null, ctx: null,
  bg: null, // pre-rendered background canvas
  time: 0,

  /* ============================ RUN SETUP ============================ */
  newRun(mapId, diffKey) {
    const map = MAPS.find(m => m.id === mapId);
    const diff = DIFFS[diffKey];
    const mods = MetaMods();
    const path = this.buildPath(map);

    this.g = {
      map, diff, diffKey, mods, path,
      gold: 200 + mods.startGold,
      lives: 20 + mods.lives,
      startLives: 20 + mods.lives,
      wave: 0,               // highest wave started
      clearedUpTo: 0,        // highest wave fully cleared
      state: 'build',        // build | wave | over
      endless: false, won: false, ended: false,
      towers: [], enemies: [], projectiles: [], particles: [], texts: [], arcs: [],
      spawnQueue: [],        // {type, t, waveNo}
      waveTime: 0,
      autoStart: false,      // endless: auto-send next wave
      autoTimer: 0,          // countdown (real seconds) until auto-start
      nextWave: makeWave(1, DIFF_ORDER.indexOf(diffKey)),
      speed: SaveSys.data.settings.speed || 1,
      paused: false,
      placing: null,         // tower type being placed
      selected: null,        // selected placed tower
      hoverTile: null,
      shake: 0,
      corePts: 0,
      coreShield: 0, secondWindUsed: false,
      kills: 0, goldEarned: 0,
      bossBannerShown: false,
    };
    this.time = 0;
    this.renderBG();
    SaveSys.data.stats.runs++;
    SaveSys.save();
  },

  buildPath(map) {
    const pts = map.waypoints.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, len, start: total });
      total += len;
    }
    // blocked tiles
    const blocked = new Set();
    const wp = map.waypoints;
    for (let i = 0; i < wp.length - 1; i++) {
      let [x0, y0] = wp[i], [x1, y1] = wp[i + 1];
      const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
      let x = x0, y = y0;
      while (x !== x1 || y !== y1) {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) blocked.add(x + ',' + y);
        x += dx; y += dy;
      }
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) blocked.add(x + ',' + y);
    }
    const end = pts[pts.length - 1];
    const coreTile = { x: Math.floor(end.x / TILE), y: Math.floor(end.y / TILE) };
    return { pts, segs, total, blocked, coreTile };
  },

  samplePath(d) {
    const p = this.g.path;
    d = Math.max(0, Math.min(d, p.total));
    for (const s of p.segs) {
      if (d <= s.start + s.len) {
        const t = s.len === 0 ? 0 : (d - s.start) / s.len;
        return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      }
    }
    const last = p.segs[p.segs.length - 1];
    return { x: last.b.x, y: last.b.y };
  },

  /* ============================ WAVES ============================ */
  startWave(early) {
    const g = this.g;
    if (!g || g.ended) return;
    if (early && g.state !== 'wave') return;
    if (!early && g.state === 'wave') return;
    const n = g.wave + 1;
    const w = g.nextWave;
    g.wave = n;
    g.state = 'wave';
    g.autoTimer = 0;
    if (early) {
      const bonus = Math.round((15 + n * 2) * g.mods.earlyBonus);
      g.gold += bonus; g.goldEarned += bonus;
      this.addText(W / 2, 60, `Early call +${bonus}g`, '#ffd23f', 18);
    }
    // flatten groups into timed spawn queue, merged by time so early-called
    // waves overlap the wave still spawning (greed has a price)
    let cursor = g.waveTime + 0.3;
    for (const grp of w.groups) {
      const def = ENEMIES[grp.type];
      for (let i = 0; i < grp.count; i++) {
        g.spawnQueue.push({ type: grp.type, t: cursor, waveNo: n });
        cursor += grp.gap;
      }
      cursor += 1.2;
    }
    g.spawnQueue.sort((a, b) => a.t - b.t);
    // core shield recharges each wave
    g.coreShield = g.mods.coreShield;
    if (w.isBoss) {
      this.banner(`⚠ BOSS WAVE ${n} ⚠`, true);
      Sfx.bossWarn();
    } else {
      this.banner(`WAVE ${n}`, false);
      Sfx.waveStart();
    }
    g.nextWave = makeWave(n + 1, DIFF_ORDER.indexOf(g.diffKey));
    UI.updateHUD(); UI.updateWaveBar();
  },

  spawnEnemy(type, waveNo, distOverride) {
    const g = this.g;
    const def = ENEMIES[type];
    const n = waveNo;
    let hpScale = (1 + 0.19 * (n - 1)) * g.diff.hp;
    if (n > FINAL_WAVE) hpScale *= Math.pow(1.12, n - FINAL_WAVE);
    if (def.boss) hpScale *= (1 + (Math.floor(n / 10) - 1) * 0.6);
    const pos = this.samplePath(distOverride || 0);
    g.enemies.push({
      type, def, waveNo: n,
      dist: distOverride || 0, x: pos.x, y: pos.y,
      hp: def.hp * hpScale, maxHp: def.hp * hpScale,
      shield: def.shield ? def.shield * (1 + 0.1 * (n - 1)) * g.diff.hp : 0,
      maxShield: def.shield ? def.shield * (1 + 0.1 * (n - 1)) * g.diff.hp : 0,
      spd: def.spd * g.diff.spd,
      armor: def.armor,
      reward: Math.round(def.reward * (1 + 0.02 * n)),
      lives: def.lives, r: def.r,
      slowFrac: 0, slowUntil: 0,
      frozenUntil: 0, stunUntil: 0,
      poisons: [], toxicSlow: 0,
      blinkAt: def.blink ? this.time + def.blinkCd : 0,
      broodAt: def.brood ? this.time + def.broodCd : 0,
      broodLeft: def.broodCount || 0,
      healFxAt: 0,
      dead: false,
      wobble: Math.random() * Math.PI * 2,
    });
  },

  checkWaveClears() {
    const g = this.g;
    while (g.clearedUpTo < g.wave) {
      const w = g.clearedUpTo + 1;
      const pending = g.spawnQueue.some(q => q.waveNo === w);
      const alive = g.enemies.some(e => !e.dead && e.waveNo === w);
      if (pending || alive) break;
      g.clearedUpTo = w;
      this.onWaveCleared(w);
    }
  },

  onWaveCleared(w) {
    const g = this.g;
    const bonus = 15 + w * 4;
    const interest = Math.floor(g.gold * Math.min(g.mods.interest, g.mods.interestCap));
    g.gold += bonus + interest;
    g.goldEarned += bonus + interest;
    g.corePts += (w <= FINAL_WAVE ? 2 : 1) * g.map.mult * g.diff.mult;
    if (g.mods.repair > 0 && w % 5 === 0 && w > 0) {
      g.lives += g.mods.repair;
      this.addText(W / 2, 40, `Nanite repair +${g.mods.repair} ❤`, '#4ade80', 16);
    }
    this.addText(W - 130, 30, `+${bonus}g${interest > 0 ? ` (+${interest} interest)` : ''}`, '#ffd23f', 14);
    Sfx.gold();
    if (w === FINAL_WAVE && !g.endless && !g.won) {
      g.won = true;
      g.corePts += 40 * g.map.mult * g.diff.mult;
      this.endRun(true);
      return;
    }
    if (g.wave === g.clearedUpTo) {
      g.state = 'build';
      if (g.endless && g.autoStart) g.autoTimer = 5;
    }
    UI.updateHUD(); UI.updateWaveBar();
  },

  /* ============================ TOWERS ============================ */
  towerCost(type) {
    return Math.round(TOWERS[type].cost * this.g.mods.discount);
  },
  upgradeCost(t) {
    return Math.round(TOWERS[t.type].upcosts[t.level - 1] * this.g.mods.discount);
  },
  investedIn(t) {
    const def = TOWERS[t.type];
    let sum = def.cost;
    for (let i = 0; i < t.level - 1; i++) sum += def.upcosts[i];
    if (t.variant) sum += def.variants.find(v => v.id === t.variant).cost;
    return Math.round(sum * this.g.mods.discount);
  },

  canPlace(tx, ty) {
    const g = this.g;
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
    if (g.path.blocked.has(tx + ',' + ty)) return false;
    if (g.towers.some(t => t.tx === tx && t.ty === ty)) return false;
    return true;
  },

  placeTower(type, tx, ty) {
    const g = this.g;
    const cost = this.towerCost(type);
    if (!this.canPlace(tx, ty) || g.gold < cost) return false;
    g.gold -= cost;
    const def = TOWERS[type];
    g.towers.push({
      type, def, tx, ty,
      x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
      level: 1, variant: null, cool: 0, angle: -Math.PI / 2, target: null, mode: 'first',
      kills: 0, dmgDone: 0,
    });
    SaveSys.data.stats.towersBuilt++;
    Sfx.place();
    this.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, def.color, 10, 2.5);
    UI.updateHUD();
    return true;
  },

  upgradeTower(t) {
    const g = this.g;
    if (t.level >= 4) return false;
    const cost = this.upgradeCost(t);
    if (g.gold < cost) return false;
    g.gold -= cost;
    t.level++;
    Sfx.upgrade();
    this.burst(t.x, t.y, '#ffd23f', 14, 3);
    UI.updateHUD(); UI.showSelection(t);
    return true;
  },

  variantCost(v) {
    return Math.round(v.cost * this.g.mods.discount);
  },

  variantOf(t) {
    return t.variant ? t.def.variants.find(v => v.id === t.variant) : null;
  },

  /* Tier-5 specialization: pick one of two variants at level 4 (tech-gated). */
  applyVariant(t, vid) {
    const g = this.g;
    if (t.level < 4 || t.variant || !t.def.variants) return false;
    if (!g.mods.specs[t.type]) return false;
    const v = t.def.variants.find(x => x.id === vid);
    if (!v) return false;
    const cost = this.variantCost(v);
    if (g.gold < cost) return false;
    g.gold -= cost;
    t.variant = vid;
    Sfx.upgrade();
    this.burst(t.x, t.y, t.def.color, 20, 3.5);
    this.ring(t.x, t.y, 32, '#ffd23f');
    UI.updateHUD(); UI.showSelection(t);
    return true;
  },

  sellTower(t) {
    const g = this.g;
    const refund = Math.round(this.investedIn(t) * g.mods.salvage);
    g.gold += refund;
    g.towers = g.towers.filter(x => x !== t);
    if (g.selected === t) g.selected = null;
    Sfx.sell();
    this.addText(t.x, t.y - 10, `+${refund}g`, '#ffd23f', 14);
    this.burst(t.x, t.y, '#94a3b8', 8, 2);
    UI.updateHUD(); UI.showSelection(null);
  },

  towerStats(t) {
    const g = this.g, d = t.def, i = t.level - 1, m = g.mods;
    const v = this.variantOf(t);
    const vs = v ? v.stats : null;
    const flags = v && v.flags ? v.flags : {};
    // variant stats are flat values; base stats are per-level arrays
    const pick = (arr, key, dflt) => vs ? (vs[key] !== undefined ? vs[key] : dflt) : (arr ? arr[i] : dflt);
    // amplifier aura (max, not stacked)
    let aura = 0, rateAura = 0;
    if (!d.support) {
      for (const o of g.towers) {
        if (!o.def.support) continue;
        const ost = this.towerStats(o);
        if (Math.hypot(o.x - t.x, o.y - t.y) <= ost.range) {
          aura = Math.max(aura, ost.aura);
          rateAura = Math.max(rateAura, ost.rateAura);
        }
      }
    }
    let dmgMul = m.dmg * (1 + aura);
    if (m.lastStand) {
      const c = g.path.coreTile;
      if (Math.hypot(c.x - t.tx, c.y - t.ty) <= 3.2) dmgMul *= 1.25;
    }
    return {
      dmg: pick(d.dmg, 'dmg', 0) * dmgMul,
      rate: pick(d.rate, 'rate', 0) * m.rate * (1 + rateAura),
      range: pick(d.range, 'range', 0) * TILE * m.range,
      splash: pick(d.splash, 'splash', 0) * TILE * m.splash,
      slow: Math.min(0.85, pick(d.slow, 'slow', 0) * m.frost),
      slowDur: pick(d.slowDur, 'slowDur', 0),
      freeze: pick(d.freeze, 'freeze', 0),
      stun: pick(d.stun, 'stun', 0),
      pierce: vs ? !!vs.pierce : (d.pierce ? d.pierce[i] : false),
      chain: pick(d.chain, 'chain', 0),
      falloff: pick(d.falloff, 'falloff', 0),
      chainR: (vs && vs.chainR !== undefined ? vs.chainR : 2.3) * TILE,
      poisonDps: pick(d.poisonDps, 'poisonDps', 0) * m.dmg,
      poisonDur: pick(d.poisonDur, 'poisonDur', 0),
      toxicSlow: pick(d.toxicSlow, 'toxicSlow', 0),
      multi: vs ? (vs.multi || 1) : (d.multi ? d.multi[i] : 1),
      aura: pick(d.aura, 'aura', 0),
      rateAura: pick(d.rateAura, 'rateAura', 0),
      // variant behavior flags
      critBonus: flags.critBonus || 0,
      spread: !!flags.spread,
      linePierce: !!flags.linePierce,
      shatter: flags.shatter || 0,
      plague: flags.plague || 0,
      meltArmor: flags.meltArmor || 0,
      shieldShred: flags.shieldShred || 0,
      openingBonus: flags.openingBonus || 0,
    };
  },

  acquireTarget(t, range) {
    const g = this.g;
    let best = null, bestKey = null;
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) > range) continue;
      let key;
      switch (t.mode) {
        case 'last':   key = -e.dist; break;
        case 'strong': key = e.hp + e.shield; break;
        case 'weak':   key = -(e.hp + e.shield); break;
        default:       key = e.dist; // first
      }
      if (best === null || key > bestKey) { best = e; bestKey = key; }
    }
    return best;
  },

  fireTower(t, st) {
    const g = this.g;
    const target = t.target;
    if (!target) return;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    const crit = Math.random() < g.mods.crit + st.critBonus;
    let dmg = st.dmg * (crit ? g.mods.critDmg : 1);
    if (st.openingBonus && target.hp > target.maxHp * 0.6) dmg *= 1 + st.openingBonus;
    Sfx.shoot(t.type);

    if (st.linePierce) {
      // railgun: instant slug that hits every enemy along the firing line
      const ex = t.x + Math.cos(t.angle) * st.range, ey = t.y + Math.sin(t.angle) * st.range;
      const dx = ex - t.x, dy = ey - t.y;
      const len2 = dx * dx + dy * dy;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const tp = ((e.x - t.x) * dx + (e.y - t.y) * dy) / len2;
        if (tp < 0 || tp > 1) continue;
        const px = t.x + tp * dx, py = t.y + tp * dy;
        if (Math.hypot(e.x - px, e.y - py) <= e.r + 10) {
          this.damageEnemy(e, dmg, { pierce: true, crit, src: t, showText: true });
        }
      }
      g.arcs.push({ pts: [{ x: t.x, y: t.y }, { x: ex, y: ey }], ttl: 0.18, color: 'rgba(244,114,182,0.95)', width: 3.5 });
      this.burst(t.x + Math.cos(t.angle) * 20, t.y + Math.sin(t.angle) * 20, '#f472b6', 5, 2);
      return;
    }

    if (t.type === 'tesla') {
      // instant chain lightning
      let cur = target, dmgNow = dmg;
      const hitSet = new Set();
      const pts = [{ x: t.x, y: t.y }];
      for (let i = 0; i < st.chain && cur; i++) {
        pts.push({ x: cur.x, y: cur.y });
        hitSet.add(cur);
        this.damageEnemy(cur, dmgNow, { pierce: true, crit, src: t });
        dmgNow *= st.falloff;
        let next = null, nd = st.chainR;
        for (const e of g.enemies) {
          if (e.dead || hitSet.has(e)) continue;
          const dd = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (dd < nd) { nd = dd; next = e; }
        }
        cur = next;
      }
      // jagged arc effect
      const jag = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const segs = 4;
        for (let s = 1; s <= segs; s++) {
          const tt = s / segs;
          const mx = a.x + (b.x - a.x) * tt, my = a.y + (b.y - a.y) * tt;
          const off = s === segs ? 0 : 10;
          jag.push({ x: mx + (Math.random() - 0.5) * off, y: my + (Math.random() - 0.5) * off });
        }
      }
      g.arcs.push({ pts: jag, ttl: 0.15 });
      return;
    }

    const count = st.multi || 1;
    // spread volleys seek a different target per projectile
    const targets = [target];
    if (st.spread && count > 1) {
      for (const e of g.enemies) {
        if (targets.length >= count) break;
        if (e.dead || targets.includes(e)) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= st.range) targets.push(e);
      }
    }
    for (let k = 0; k < count; k++) {
      const tk = targets[k] || target;
      g.projectiles.push({
        x: t.x + Math.cos(t.angle) * 16, y: t.y + Math.sin(t.angle) * 16,
        target: tk, lx: tk.x, ly: tk.y,
        speed: t.def.projSpeed * TILE,
        dmg, crit, kind: t.type, src: t,
        splash: st.splash, stun: st.stun, pierce: st.pierce,
        slowFrac: st.slow, slowDur: st.slowDur, freeze: st.freeze,
        poisonDps: st.poisonDps, poisonDur: st.poisonDur, toxicSlow: st.toxicSlow,
        shatter: st.shatter, plague: st.plague, meltArmor: st.meltArmor, shieldShred: st.shieldShred,
        delay: k * 0.06,
      });
    }
  },

  damageEnemy(e, dmg, opts) {
    const g = this.g;
    if (e.dead) return;
    opts = opts || {};
    if (g.mods.exec && e.hp < e.maxHp * 0.35) dmg *= 1.25;
    if (e.shatterUntil > this.time && e.shatterMul) dmg *= 1 + e.shatterMul;
    if (!opts.pierce && !opts.poison && e.armor > 0) dmg *= (1 - e.armor);
    if (opts.poison) {
      e.hp -= dmg; // toxins seep past shields
    } else if (e.shield > 0) {
      const shred = opts.shieldShred || 1;
      const absorbed = Math.min(e.shield, dmg * shred);
      e.shield -= absorbed;
      dmg -= absorbed / shred;
      e.hp -= dmg;
    } else {
      e.hp -= dmg;
    }
    if (opts.src) opts.src.dmgDone += dmg;
    if (opts.showText && dmg >= 1) {
      this.addText(e.x, e.y - e.r - 6, String(Math.round(dmg)), opts.crit ? '#ffd23f' : '#ffffff', opts.crit ? 15 : 11);
    }
    if (e.hp <= 0) this.killEnemy(e, opts.src);
  },

  killEnemy(e, src) {
    const g = this.g;
    if (e.dead) return;
    e.dead = true;
    const gold = Math.round(e.reward * g.mods.bounty);
    g.gold += gold;
    g.goldEarned += gold;
    g.kills++;
    SaveSys.data.stats.kills++;
    if (src) src.kills++;
    this.addText(e.x, e.y - 4, `+${gold}`, '#ffd23f', 12);
    this.burst(e.x, e.y, e.def.color, e.def.boss ? 40 : 10, e.def.boss ? 5 : 2.5);
    if (e.def.boss) {
      Sfx.bossDie();
      g.shake = 14;
      this.banner('BOSS DESTROYED', false);
    } else {
      Sfx.die();
    }
    if (e.def.spawns) {
      for (let i = 0; i < e.def.spawnCount; i++) {
        this.spawnEnemy(e.def.spawns, e.waveNo, Math.max(0, e.dist - 6 * i));
      }
    }
    // plaguebearer: poisoned enemies infect their neighbors on death
    if (e.plague && e.poisons.length) {
      const dps = Math.max(...e.poisons.map(p => p.dps)) * 0.75;
      const r2 = e.plague * TILE;
      let infected = 0;
      for (const o of g.enemies) {
        if (o.dead || o === e) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > r2) continue;
        o.poisons.push({ dps, until: this.time + 3 });
        if (o.poisons.length > 6) o.poisons.shift();
        infected++;
      }
      if (infected) this.ring(e.x, e.y, r2, '#a3e635');
    }
  },

  leak(e) {
    const g = this.g;
    if (g.coreShield > 0) {
      g.coreShield--;
      this.addText(e.x, e.y, 'CORE SHIELD', '#38bdf8', 16);
      this.ring(e.x, e.y, 30, '#38bdf8');
      Sfx.hit();
      return;
    }
    g.lives -= e.lives;
    SaveSys.data.stats.leaks++;
    g.shake = Math.max(g.shake, 8);
    Sfx.leak();
    const v = document.getElementById('damage-vignette');
    v.classList.add('hit');
    setTimeout(() => v.classList.remove('hit'), 120);
    this.addText(e.x, e.y, `-${e.lives} ❤`, '#ff5a5a', 18);
    if (g.lives <= 0) {
      if (g.mods.secondWind && !g.secondWindUsed) {
        g.secondWindUsed = true;
        g.lives = 1;
        this.banner('SECOND WIND — CORE HOLDS AT 1 ❤', false);
        Sfx.bossWarn();
      } else {
        g.lives = 0;
        this.endRun(false);
      }
    }
    UI.updateHUD();
  },

  /* ============================ UPDATE ============================ */
  update(rawDt) {
    const g = this.g;
    if (!g || g.paused || g.ended) return;
    const dt = Math.min(rawDt, 0.05) * g.speed;
    this.time += dt;
    const now = this.time;

    // spawner
    if (g.state === 'wave' || g.spawnQueue.length) {
      g.waveTime += dt;
      while (g.spawnQueue.length && g.spawnQueue[0].t <= g.waveTime) {
        const q = g.spawnQueue.shift();
        this.spawnEnemy(q.type, q.waveNo);
      }
    }

    // endless auto-start countdown (real seconds, ignores game speed)
    if (g.autoTimer > 0) {
      g.autoTimer -= rawDt;
      if (g.autoTimer <= 0) {
        g.autoTimer = 0;
        this.startWave(false);
      }
    }

    // enemies
    for (const e of g.enemies) {
      if (e.dead) continue;
      // poison ticks (ignore armor & shields)
      if (e.poisons.length) {
        e.poisons = e.poisons.filter(p => p.until > now);
        let dot = 0;
        for (const p of e.poisons) dot += p.dps;
        if (dot > 0) {
          e.hp -= dot * dt;
          if (e.hp <= 0) { this.killEnemy(e, null); continue; }
        }
      }
      // movement
      let sp = e.spd;
      if (!e.def.ccImmune && (now < e.frozenUntil || now < e.stunUntil)) sp = 0;
      else {
        let slow = e.slowFrac > 0 && now < e.slowUntil ? e.slowFrac : 0;
        if (now >= e.slowUntil) e.slowFrac = 0;
        if (e.def.ccImmune) slow = 0;
        if (e.toxicSlow > 0 && e.poisons.length && !e.def.ccImmune) slow = Math.min(0.9, slow + e.toxicSlow);
        sp *= (1 - slow);
      }
      // phase stalker: blink forward
      if (e.def.blink && now >= e.blinkAt) {
        e.blinkAt = now + e.def.blinkCd;
        e.dist = Math.min(e.dist + e.def.blink * TILE, g.path.total - 1);
        this.burst(e.x, e.y, e.def.color, 8, 3);
      }
      // broodmother: births children as it walks
      if (e.def.brood && e.broodLeft > 0 && now >= e.broodAt) {
        e.broodAt = now + e.def.broodCd;
        e.broodLeft--;
        this.spawnEnemy(e.def.brood, e.waveNo, Math.max(0, e.dist - 8));
        this.burst(e.x, e.y, e.def.color, 5, 2);
      }
      e.dist += sp * TILE * dt;
      if (e.dist >= g.path.total) {
        e.dead = true;
        this.leak(e);
        continue;
      }
      const pos = this.samplePath(e.dist);
      e.x = pos.x; e.y = pos.y;
    }
    // mender: heal nearby allies (not other menders, not bosses' summons cap-free)
    for (const m of g.enemies) {
      if (m.dead || !m.def.heal) continue;
      for (const e of g.enemies) {
        if (e.dead || e === m || e.def.heal) continue;
        if (e.hp >= e.maxHp) continue;
        if (Math.hypot(e.x - m.x, e.y - m.y) > m.def.healR * TILE) continue;
        e.hp = Math.min(e.maxHp, e.hp + m.def.heal * (1 + 0.1 * (m.waveNo - 1)) * dt);
        if (now >= m.healFxAt) {
          m.healFxAt = now + 0.4;
          this.burst(e.x, e.y, '#34d399', 2, 1.2);
        }
      }
    }
    g.enemies = g.enemies.filter(e => !e.dead);

    // towers
    for (const t of g.towers) {
      if (t.def.support) continue;
      const stats = this.towerStats(t);
      t.cool -= dt;
      // validate / acquire target
      if (t.target && (t.target.dead || Math.hypot(t.target.x - t.x, t.target.y - t.y) > stats.range)) t.target = null;
      if (!t.target) t.target = this.acquireTarget(t, stats.range);
      if (t.target) {
        const want = Math.atan2(t.target.y - t.y, t.target.x - t.x);
        let da = want - t.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        t.angle += da * Math.min(1, dt * 12);
      }
      if (t.target && t.cool <= 0) {
        this.fireTower(t, stats);
        t.cool = 1 / stats.rate;
      }
    }

    // projectiles
    for (const p of g.projectiles) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      if (p.target && !p.target.dead) { p.lx = p.target.x; p.ly = p.target.y; }
      const dx = p.lx - p.x, dy = p.ly - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 4) {
        this.impact(p);
        p.dead = true;
      } else {
        p.x += dx / d * step;
        p.y += dy / d * step;
      }
    }
    g.projectiles = g.projectiles.filter(p => !p.dead);

    // particles / texts / arcs
    for (const pt of g.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.ttl -= dt;
    }
    g.particles = g.particles.filter(p => p.ttl > 0);
    for (const tx of g.texts) { tx.y += tx.vy * dt; tx.ttl -= dt; }
    g.texts = g.texts.filter(t => t.ttl > 0);
    for (const a of g.arcs) a.ttl -= dt;
    g.arcs = g.arcs.filter(a => a.ttl > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 30);

    this.checkWaveClears();
  },

  impact(p) {
    const g = this.g;
    if (p.kind === 'cannon') {
      Sfx.hit();
      this.ring(p.lx, p.ly, p.splash, '#fb923c');
      this.burst(p.lx, p.ly, '#fb923c', 8, 3);
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.lx, e.y - p.ly) <= p.splash) {
          this.damageEnemy(e, p.dmg, { pierce: p.pierce, crit: p.crit, src: p.src, showText: e === p.target });
          if (p.stun > 0) e.stunUntil = Math.max(e.stunUntil, this.time + p.stun);
        }
      }
      return;
    }
    const e = p.target;
    if (!e || e.dead) return;
    this.damageEnemy(e, p.dmg, { pierce: p.pierce, crit: p.crit, src: p.src, showText: true, shieldShred: p.shieldShred });
    Sfx.hit();
    if (p.kind === 'frost') {
      const chill = (o) => {
        if (o.def.ccImmune) {
          if (o === e && Math.random() < 0.25) this.addText(o.x, o.y - o.r - 6, 'IMMUNE', '#e2e8f0', 10);
          return;
        }
        o.slowFrac = Math.max(o.slowFrac, p.slowFrac);
        o.slowUntil = this.time + p.slowDur;
        if (p.freeze > 0 && Math.random() < p.freeze) {
          o.frozenUntil = this.time + 1;
          if (p.shatter) { o.shatterMul = p.shatter; o.shatterUntil = o.frozenUntil; }
          this.ring(o.x, o.y, 24, '#67e8f9');
        }
      };
      chill(e);
      // glacier: the bolt bursts, chilling everything in the splash area
      if (p.splash > 0) {
        this.ring(p.lx, p.ly, p.splash, '#67e8f9');
        for (const o of g.enemies) {
          if (o.dead || o === e) continue;
          if (Math.hypot(o.x - p.lx, o.y - p.ly) > p.splash) continue;
          this.damageEnemy(o, p.dmg, { pierce: p.pierce, crit: p.crit, src: p.src });
          chill(o);
        }
      }
      this.burst(p.lx, p.ly, '#67e8f9', 4, 1.5);
    } else if (p.kind === 'venom') {
      e.poisons.push({ dps: p.poisonDps, until: this.time + p.poisonDur });
      if (e.poisons.length > 6) e.poisons.shift();
      e.toxicSlow = p.toxicSlow;
      if (p.meltArmor && e.armor > 0) {
        e.armor = Math.max(0, e.armor - p.meltArmor);
        this.addText(e.x, e.y - e.r - 6, 'ARMOR MELT', '#a3e635', 10);
      }
      if (p.plague) e.plague = p.plague;
      this.burst(p.lx, p.ly, '#a3e635', 4, 1.5);
    } else if (p.kind === 'sniper') {
      this.burst(p.lx, p.ly, '#f472b6', 5, 2);
    } else {
      this.burst(p.lx, p.ly, '#d9f99d', 3, 1.2);
    }
  },

  /* ============================ FX HELPERS ============================ */
  burst(x, y, color, n, spd) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * spd * TILE * 0.09;
      g.particles.push({ x, y, vx: Math.cos(a) * s * 10, vy: Math.sin(a) * s * 10, ttl: 0.35 + Math.random() * 0.3, color, size: 1.5 + Math.random() * 2.5 });
    }
  },
  ring(x, y, r, color) {
    this.g.particles.push({ x, y, vx: 0, vy: 0, ttl: 0.25, color, size: r, ring: true });
  },
  addText(x, y, txt, color, size) {
    this.g.texts.push({ x, y, txt, color, size: size || 12, ttl: 1.1, vy: -34 });
  },
  banner(txt, isBoss) {
    const b = document.getElementById('game-banner');
    b.textContent = txt;
    b.classList.toggle('boss', !!isBoss);
    b.classList.remove('hidden');
    clearTimeout(this._bannerTo);
    this._bannerTo = setTimeout(() => b.classList.add('hidden'), 1600);
  },

  /* ============================ END OF RUN ============================ */
  endRun(won) {
    const g = this.g;
    if (g.ended) return;
    g.ended = true;
    g.state = 'over';
    // snapshot unlock state before recording this run
    const beforeMaps = MAPS.map(m => this.isMapUnlockedSafe(m));
    const beforeDiffs = MAPS.map(m => DIFF_ORDER.map(d => SaveSys.isDiffUnlocked(m, d)));

    // cumulative totals minus what earlier end-of-run payouts in this run already banked
    const totalCores = Math.round(g.corePts * g.mods.coreGain);
    const cores = totalCores - (g.bankedCores || 0);
    g.bankedCores = totalCores;
    const totalXp = Math.round(g.kills + g.clearedUpTo * 10 + (g.won ? 60 : 0));
    const xp = totalXp - (g.bankedXp || 0);
    g.bankedXp = totalXp;

    const summary = {
      won, mapId: g.map.id, mapName: g.map.name, diffKey: g.diffKey, diffName: g.diff.name,
      wavesCleared: g.clearedUpTo, bestWave: Math.max(g.wave, g.clearedUpTo),
      lives: g.lives, kills: g.kills, goldEarned: g.goldEarned, cores, xp,
      endless: g.endless,
    };
    SaveSys.addCores(cores);
    const levels = SaveSys.addXp(xp);
    if (won) SaveSys.data.stats.wins++;
    SaveSys.recordRun(g.map.id, g.diffKey, won, g.clearedUpTo, g.lives);

    // newly unlocked maps / difficulties
    const unlocks = [];
    MAPS.forEach((m, i) => {
      if (!beforeMaps[i] && this.isMapUnlockedSafe(m)) unlocks.push(`New operation: ${m.name}`);
      DIFF_ORDER.forEach((d, j) => {
        if (!beforeDiffs[i][j] && SaveSys.isDiffUnlocked(m, d)) unlocks.push(`${m.name} — ${DIFFS[d].name} difficulty`);
      });
    });

    const newAch = SaveSys.checkAchievements(summary);
    SaveSys.save();
    if (won) Sfx.win(); else Sfx.lose();
    UI.showResults(summary, newAch, levels, unlocks);
  },

  isMapUnlockedSafe(map) { return SaveSys.isMapUnlocked(map); },

  continueEndless() {
    const g = this.g;
    g.endless = true;
    g.ended = false;
    g.won = true; // already banked the win
    g.state = 'build';
    // note: cores from endless waves continue accumulating into a new endRun later
    UI.updateHUD(); UI.updateWaveBar();
  },

  /* ============================ BACKGROUND ============================ */
  renderBG() {
    const g = this.g;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const th = g.map.theme;
    // ground
    x.fillStyle = th.ground;
    x.fillRect(0, 0, W, H);
    // subtle checker
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if ((tx + ty) % 2 === 0) {
        x.fillStyle = th.ground2;
        x.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    // decorations (deterministic-ish scatter)
    let seed = 0;
    for (let i = 0; i < g.map.id.length; i++) seed += g.map.id.charCodeAt(i) * 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) {
      const dx = rnd() * W, dy = rnd() * H;
      x.fillStyle = th.deco[i % th.deco.length];
      x.globalAlpha = 0.5 + rnd() * 0.5;
      const s = 2 + rnd() * 7;
      x.beginPath(); x.arc(dx, dy, s, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    // path: stamp wide dark edge then inner
    const stamp = (rad, color) => {
      x.fillStyle = color;
      for (let d = 0; d <= g.path.total; d += 6) {
        const p = this.samplePathRaw(g.path, d);
        x.beginPath(); x.arc(p.x, p.y, rad, 0, Math.PI * 2); x.fill();
      }
    };
    stamp(TILE * 0.46, th.pathEdge);
    stamp(TILE * 0.38, th.path);
    // build pads outline on buildable tiles
    x.strokeStyle = 'rgba(255,255,255,0.05)';
    x.lineWidth = 1;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if (!g.path.blocked.has(tx + ',' + ty)) {
        x.strokeRect(tx * TILE + 3.5, ty * TILE + 3.5, TILE - 7, TILE - 7);
      }
    }
    this.bg = c;
  },

  samplePathRaw(path, d) {
    d = Math.max(0, Math.min(d, path.total));
    for (const s of path.segs) {
      if (d <= s.start + s.len) {
        const t = s.len === 0 ? 0 : (d - s.start) / s.len;
        return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      }
    }
    const last = path.segs[path.segs.length - 1];
    return { x: last.b.x, y: last.b.y };
  },

  /* ============================ RENDER ============================ */
  render() {
    const g = this.g;
    if (!g) return;
    const ctx = this.ctx;
    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    ctx.drawImage(this.bg, 0, 0);

    // animated path direction chevrons
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    const off = (this.time * 40) % 56;
    for (let d = off; d < g.path.total; d += 56) {
      const p = this.samplePath(d);
      const p2 = this.samplePath(Math.min(d + 4, g.path.total));
      const a = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // spawn portal
    const sp = this.samplePath(0);
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.rotate(this.time * 2);
    ctx.strokeStyle = '#7c6cff'; ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + i * 6, i * 2.1, i * 2.1 + 4);
      ctx.stroke();
    }
    ctx.restore();

    // core (path end)
    const end = this.samplePath(g.path.total);
    const pulse = 1 + Math.sin(this.time * 3) * 0.08;
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    const grd = ctx.createLinearGradient(-14, -14, 14, 14);
    grd.addColorStop(0, '#6ee7ff'); grd.addColorStop(1, '#2b6cb0');
    ctx.fillStyle = grd;
    ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 22;
    ctx.fillRect(-13, -13, 26, 26);
    ctx.restore();

    // range preview
    const selT = g.selected;
    const placing = g.placing;
    if (selT) {
      const st = this.towerStats(selT);
      this.drawRange(selT.x, selT.y, st.range, true);
    }
    if (placing && g.hoverTile) {
      const { tx, ty } = g.hoverTile;
      const ok = this.canPlace(tx, ty) && g.gold >= this.towerCost(placing);
      const px = tx * TILE + TILE / 2, py = ty * TILE + TILE / 2;
      const def = TOWERS[placing];
      this.drawRange(px, py, def.range[0] * TILE * g.mods.range, ok);
      ctx.globalAlpha = 0.65;
      this.drawTower({ type: placing, def, x: px, y: py, level: 1, angle: -Math.PI / 2 }, true);
      ctx.globalAlpha = 1;
      if (!ok) {
        ctx.strokeStyle = 'rgba(255,80,80,.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
      }
    }

    // towers
    for (const t of g.towers) this.drawTower(t, false);

    // projectiles
    for (const p of g.projectiles) {
      if (p.delay > 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'arrow':
          ctx.rotate(Math.atan2(p.ly - p.y, p.lx - p.x));
          ctx.strokeStyle = p.crit ? '#ffd23f' : '#d9f99d'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
          break;
        case 'cannon':
          ctx.fillStyle = '#3f3f46';
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fb923c';
          ctx.beginPath(); ctx.arc(-1.5, -1.5, 2, 0, Math.PI * 2); ctx.fill();
          break;
        case 'frost':
          ctx.fillStyle = '#a5f3fc';
          ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          break;
        case 'sniper':
          ctx.strokeStyle = p.crit ? '#ffd23f' : '#f472b6'; ctx.lineWidth = 3;
          ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 6;
          ctx.rotate(Math.atan2(p.ly - p.y, p.lx - p.x));
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
          break;
        case 'venom':
          ctx.fillStyle = '#a3e635';
          ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
          break;
      }
      ctx.restore();
    }

    // enemies
    for (const e of g.enemies) this.drawEnemy(e);

    // lightning arcs
    for (const a of g.arcs) {
      ctx.strokeStyle = a.color || `rgba(196,181,253,${Math.min(1, a.ttl / 0.1)})`;
      ctx.lineWidth = a.width || 2.5;
      ctx.shadowColor = a.shadow || '#a78bfa'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x, a.pts[0].y);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // particles
    for (const pt of g.particles) {
      const al = Math.min(1, pt.ttl / 0.3);
      if (pt.ring) {
        ctx.strokeStyle = pt.color; ctx.globalAlpha = al; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1 - al * 0.4), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = pt.color; ctx.globalAlpha = al;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // floating texts
    ctx.textAlign = 'center';
    for (const t of g.texts) {
      ctx.globalAlpha = Math.min(1, t.ttl / 0.5);
      ctx.font = `700 ${t.size}px Rajdhani, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // paused overlay
    if (g.paused) {
      ctx.fillStyle = 'rgba(5,8,18,.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '800 34px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
    ctx.restore();
  },

  drawRange(x, y, r, ok) {
    const ctx = this.ctx;
    ctx.fillStyle = ok ? 'rgba(110,231,255,0.08)' : 'rgba(255,80,80,0.08)';
    ctx.strokeStyle = ok ? 'rgba(110,231,255,0.5)' : 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  },

  drawTower(t, ghost) {
    const ctx = this.ctx;
    const lvl = t.level;
    ctx.save();
    ctx.translate(t.x, t.y);
    // base
    ctx.fillStyle = '#1e2a4a';
    ctx.strokeStyle = t.def.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // turret head by type
    ctx.rotate(t.angle || 0);
    ctx.fillStyle = t.def.color;
    ctx.strokeStyle = t.def.color;
    switch (t.type) {
      case 'arrow':
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(16 + lvl * 2, 0); ctx.lineWidth = 3 + lvl * 0.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        if (lvl >= 4) { ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(16, -4); ctx.moveTo(4, 4); ctx.lineTo(16, 4); ctx.lineWidth = 2; ctx.stroke(); }
        break;
      case 'cannon':
        ctx.fillRect(-2, -5 - lvl, 14 + lvl * 2, 10 + lvl * 2);
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        break;
      case 'frost':
        ctx.rotate(-(t.angle || 0));
        ctx.rotate(this.time * 0.8);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * (9 + lvl * 1.5), Math.sin(a) * (9 + lvl * 1.5));
        }
        ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'sniper':
        ctx.lineWidth = 2.5 + lvl * 0.6;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 + lvl * 3, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'tesla':
        ctx.rotate(-(t.angle || 0));
        ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 8 + lvl * 3;
        ctx.beginPath(); ctx.arc(0, 0, 8 + lvl, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (Math.random() < 0.06) {
          ctx.strokeStyle = '#ddd6fe'; ctx.lineWidth = 1.5;
          const a = Math.random() * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.stroke();
        }
        break;
      case 'venom':
        ctx.beginPath(); ctx.arc(0, 0, 8 + lvl * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(13 + lvl * 2, 0); ctx.stroke();
        break;
      case 'amp':
        ctx.rotate(-(t.angle || 0));
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-8, -8, 16, 16);
        ctx.rotate(-Math.PI / 4);
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 3);
        ctx.beginPath(); ctx.arc(0, 0, 20 + lvl * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
    }
    ctx.restore();
    // tier-5 specialization: gold halo + variant icon
    if (t.variant && !ghost) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -this.time * 14;
      ctx.beginPath(); ctx.arc(t.x, t.y, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      const v = this.variantOf(t);
      if (v) {
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.icon, t.x, t.y - 24);
      }
      ctx.restore();
    }
    // level pips
    if (!ghost) {
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < lvl; i++) {
        ctx.beginPath(); ctx.arc(t.x - 12 + i * 8, t.y + 21, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      if (t.variant) {
        ctx.fillStyle = '#7c6cff';
        ctx.beginPath(); ctx.arc(t.x - 12 + lvl * 8, t.y + 21, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      if (this.g.selected === t) {
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x, t.y, 21, 0, Math.PI * 2); ctx.stroke();
      }
    }
  },

  drawEnemy(e) {
    const ctx = this.ctx;
    const now = this.time;
    ctx.save();
    ctx.translate(e.x, e.y);
    const frozen = now < e.frozenUntil || now < e.stunUntil;
    const slowed = e.slowFrac > 0 && now < e.slowUntil;

    // body
    ctx.fillStyle = e.def.color;
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    switch (e.type) {
      case 'tank': ctx.rect(-e.r * 0.85, -e.r * 0.85, e.r * 1.7, e.r * 1.7); break;
      case 'juggernaut':
        ctx.rect(-e.r * 0.9, -e.r * 0.9, e.r * 1.8, e.r * 1.8);
        ctx.moveTo(-e.r * 0.9, -e.r * 0.9); ctx.lineTo(e.r * 0.9, e.r * 0.9);
        ctx.moveTo(e.r * 0.9, -e.r * 0.9); ctx.lineTo(-e.r * 0.9, e.r * 0.9);
        break;
      case 'wraith': {
        // ghostly trailing diamond
        const w = Math.sin(e.wobble + now * 6) * 3;
        ctx.moveTo(0, -e.r); ctx.lineTo(e.r * 0.8, w); ctx.lineTo(0, e.r); ctx.lineTo(-e.r * 0.8, -w);
        ctx.closePath();
        break;
      }
      case 'mender':
        // rounded cross
        ctx.moveTo(-e.r * 0.35, -e.r); ctx.lineTo(e.r * 0.35, -e.r); ctx.lineTo(e.r * 0.35, -e.r * 0.35);
        ctx.lineTo(e.r, -e.r * 0.35); ctx.lineTo(e.r, e.r * 0.35); ctx.lineTo(e.r * 0.35, e.r * 0.35);
        ctx.lineTo(e.r * 0.35, e.r); ctx.lineTo(-e.r * 0.35, e.r); ctx.lineTo(-e.r * 0.35, e.r * 0.35);
        ctx.lineTo(-e.r, e.r * 0.35); ctx.lineTo(-e.r, -e.r * 0.35); ctx.lineTo(-e.r * 0.35, -e.r * 0.35);
        ctx.closePath();
        break;
      case 'stalker': {
        // four-pointed phase star
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + now * 1.5;
          const rr = i % 2 === 0 ? e.r : e.r * 0.45;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'broodmother': {
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        // egg sacs
        ctx.moveTo(e.r * 0.5, 0);
        ctx.arc(e.r * 0.25, -e.r * 0.3, e.r * 0.28, 0, Math.PI * 2);
        ctx.moveTo(e.r * 0.1, e.r * 0.5);
        ctx.arc(-e.r * 0.2, e.r * 0.3, e.r * 0.24, 0, Math.PI * 2);
        break;
      }
      case 'runner': {
        const p2 = this.samplePath(Math.min(e.dist + 4, this.g.path.total));
        ctx.rotate(Math.atan2(p2.y - e.y, p2.x - e.x));
        ctx.moveTo(e.r + 3, 0); ctx.lineTo(-e.r, -e.r * 0.7); ctx.lineTo(-e.r, e.r * 0.7); ctx.closePath();
        break;
      }
      case 'shielded':
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + Math.PI / 6;
          const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case 'boss':
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const rr = i % 2 === 0 ? e.r + 5 : e.r * 0.8;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      default: ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.stroke();

    // splitter seam
    if (e.type === 'splitter') {
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.moveTo(-e.r, 0); ctx.lineTo(e.r, 0); ctx.stroke();
    }
    // boss eyes
    if (e.def.boss) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-7, -4, 3.5, 0, Math.PI * 2); ctx.arc(7, -4, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(-7, -4, 1.8, 0, Math.PI * 2); ctx.arc(7, -4, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // slow / freeze tint
    if (frozen) {
      ctx.fillStyle = 'rgba(165,243,252,.55)';
      ctx.beginPath(); ctx.arc(0, 0, e.r + 2, 0, Math.PI * 2); ctx.fill();
    } else if (slowed) {
      ctx.strokeStyle = 'rgba(103,232,249,.8)';
      ctx.beginPath(); ctx.arc(0, 0, e.r + 2, 0, Math.PI * 2); ctx.stroke();
    }
    // poison tint
    if (e.poisons.length) {
      ctx.fillStyle = `rgba(163,230,53,${0.2 + 0.1 * Math.sin(now * 6)})`;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
    }
    // shield ring
    if (e.shield > 0) {
      ctx.strokeStyle = 'rgba(56,189,248,.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -now * 20;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // mender heal aura
    if (e.def.heal) {
      ctx.strokeStyle = `rgba(52,211,153,${0.18 + 0.1 * Math.sin(now * 4)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.def.healR * TILE, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // hp bar
    if (e.hp < e.maxHp || e.shield > 0 || e.def.boss) {
      const wpx = e.def.boss ? 44 : 26;
      const bx = e.x - wpx / 2, by = e.y - e.r - 9;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(bx - 1, by - 1, wpx + 2, 5);
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#ffd23f' : '#ff5a5a';
      ctx.fillRect(bx, by, wpx * frac, 3);
      if (e.maxShield > 0 && e.shield > 0) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(bx, by - 3, wpx * (e.shield / e.maxShield), 2);
      }
    }
  },
};

/* ============================ WAVE GENERATION ============================ */
/* diffLv: 0 normal, 1 hard, 2 nightmare — gates which enemy types can appear. */
function makeWave(n, diffLv) {
  diffLv = diffLv || 0;
  if (n % 10 === 0) {
    const groups = [{ type: 'boss', count: n >= 20 ? 1 + Math.floor(n / 20) : 1, gap: 7 }];
    groups.push({ type: 'grunt', count: 4 + Math.floor(n / 3), gap: 0.6 });
    if (n >= 20) groups.push({ type: 'tank', count: Math.max(1, Math.floor(n / 12)), gap: 1.6 });
    if (n >= 30) groups.push({ type: 'shielded', count: 4, gap: 0.9 });
    if (diffLv >= 1 && n >= 20) groups.push({ type: 'mender', count: 1 + Math.floor(n / 30), gap: 3 });
    if (diffLv >= 2 && n >= 30) groups.push({ type: 'broodmother', count: 1, gap: 2 });
    return { groups, isBoss: true };
  }
  const budget = 8 + n * 3.7 + Math.max(0, n - FINAL_WAVE) * 6;
  const avail = Object.keys(ENEMIES).filter(k =>
    !ENEMIES[k].boss && ENEMIES[k].minWave <= n && (ENEMIES[k].minDiff || 0) <= diffLv);
  const groups = [];
  let b = budget, guard = 0;
  while (b > 0.4 && guard++ < 30) {
    const type = avail[(Math.random() * avail.length) | 0];
    const def = ENEMIES[type];
    const count = Math.max(1, Math.round(def.group * (0.6 + Math.random() * 0.8)));
    groups.push({ type, count, gap: def.gap });
    b -= def.cost * count;
  }
  return { groups, isBoss: false };
}
