/* COREFALL TD — persistence (localStorage) */
'use strict';

const SAVE_KEY = 'corefall_td_save_v1';

function defaultSave() {
  return {
    cores: 0,
    xp: 0,
    level: 1,
    tech: {},        // nodeId -> rank
    ach: {},         // achId -> true
    maps: {},        // mapId -> { diffKey -> {won, bestWave, bestLives} }
    stats: { kills: 0, goldEarned: 0, towersBuilt: 0, runs: 0, wins: 0, leaks: 0 },
    settings: { mute: false, speed: 1 },
  };
}

const SaveSys = {
  data: defaultSave(),

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const d = defaultSave();
        this.data = Object.assign(d, parsed);
        this.data.stats = Object.assign(defaultSave().stats, parsed.stats || {});
        this.data.settings = Object.assign(defaultSave().settings, parsed.settings || {});
      }
    } catch (e) { this.data = defaultSave(); }
    this.recalcLevel();
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  reset() {
    this.data = defaultSave();
    this.save();
  },

  /* --- XP / levels --- */
  xpFor(level) { return Math.round(80 * Math.pow(level, 1.45)); },

  addXp(amount) {
    const d = this.data;
    d.xp += Math.round(amount);
    let leveled = 0;
    while (d.xp >= this.xpFor(d.level)) {
      d.xp -= this.xpFor(d.level);
      d.level++;
      leveled++;
    }
    return leveled;
  },

  recalcLevel() {
    // safety pass if xp exceeds threshold after load
    this.addXp(0);
  },

  addCores(n) { this.data.cores += Math.max(0, Math.round(n)); },

  /* --- tech --- */
  techRank(id) { return this.data.tech[id] || 0; },
  canBuyTech(node) {
    const rank = this.techRank(node.id);
    if (rank >= node.max) return { ok: false, why: 'maxed' };
    if (node.req && this.techRank(node.req.id) < node.req.rank) return { ok: false, why: 'req' };
    const cost = node.costs[rank];
    if (this.data.cores < cost) return { ok: false, why: 'cores' };
    return { ok: true, cost };
  },
  buyTech(node) {
    const c = this.canBuyTech(node);
    if (!c.ok) return false;
    this.data.cores -= c.cost;
    this.data.tech[node.id] = this.techRank(node.id) + 1;
    this.save();
    return true;
  },

  /* --- map progress --- */
  mapRec(mapId, diffKey) {
    const m = this.data.maps[mapId];
    return m && m[diffKey] ? m[diffKey] : null;
  },
  recordRun(mapId, diffKey, won, wavesCleared, lives) {
    const d = this.data;
    if (!d.maps[mapId]) d.maps[mapId] = {};
    if (!d.maps[mapId][diffKey]) d.maps[mapId][diffKey] = { won: false, bestWave: 0, bestLives: 0 };
    const rec = d.maps[mapId][diffKey];
    if (won) rec.won = true;
    rec.bestWave = Math.max(rec.bestWave, wavesCleared);
    if (won) rec.bestLives = Math.max(rec.bestLives, lives);
  },
  isMapUnlocked(map) {
    if (!map.unlock) return true;
    const rec = this.mapRec(map.unlock.map, map.unlock.diff);
    return !!(rec && rec.won);
  },
  isDiffUnlocked(map, diffKey) {
    if (diffKey === 'normal') return true;
    if (diffKey === 'hard') { const r = this.mapRec(map.id, 'normal'); return !!(r && r.won); }
    if (diffKey === 'nightmare') { const r = this.mapRec(map.id, 'hard'); return !!(r && r.won); }
    return false;
  },

  /* --- achievements --- */
  checkAchievements(runSummary) {
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.ach[a.id]) continue;
      let ok = false;
      try { ok = a.check(this.data, runSummary); } catch (e) {}
      if (ok) {
        this.data.ach[a.id] = true;
        this.addCores(a.reward);
        newly.push(a);
      }
    }
    if (newly.length) this.save();
    return newly;
  },
};
