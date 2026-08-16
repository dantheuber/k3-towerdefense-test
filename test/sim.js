/* Headless smoke test: stub browser APIs, simulate real gameplay ticks. */
/* NOTE: no 'use strict' here — sloppy-mode direct eval lets game files share scope. */
const fs = require('fs');
const path = require('path');

/* ---- browser stubs ---- */
const noopCtx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return typeof k === 'string' ? () => {} : undefined;
  },
  set: () => true,
});
const stubEl = () => ({
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  style: {}, dataset: {},
  textContent: '', innerHTML: '', width: 768, height: 528,
  getContext: () => noopCtx,
  addEventListener() {}, appendChild() {}, querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 528 }),
});
global.document = {
  getElementById: () => stubEl(),
  createElement: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener() {},
};
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };

/* ---- load game files in order ---- */
for (const f of ['data.js', 'save.js', 'audio.js', 'game.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')
    .replace(/^'use strict';/m, '')
    .replace(/^(const|let) /gm, 'var ');
  eval(src);
}

/* ---- UI stub ---- */
let resultShown = null;
global.UI = {
  updateHUD() {}, updateWaveBar() {}, showSelection() {}, refreshPaletteSel() {},
  toast() {}, showResults(s) { resultShown = s; },
};

/* ---- boot ---- */
SaveSys.load();
let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.error('FAIL:', msg); } else console.log('ok:', msg); };

/* ---- run 1: full wave-1 clear on map 1 ---- */
Game.newRun('verdant', 'normal');
const g = Game.g;
assert(g.gold === 200, `starting gold 200 (got ${g.gold})`);
assert(g.lives === 20, `starting lives 20 (got ${g.lives})`);
assert(g.path.total > 500, `path length sane (${Math.round(g.path.total)}px)`);
assert(g.path.blocked.size > 10, `blocked tiles marked (${g.path.blocked.size})`);

// place a row of towers near the path
let placed = 0;
outer:
for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
  if (Game.canPlace(tx, ty)) {
    // near path? check dist to any blocked tile within 2
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) {
      if (g.path.blocked.has((tx + dx) + ',' + (ty + dy))) near = true;
    }
    if (!near) continue;
    const type = placed % 3 === 0 ? 'cannon' : 'arrow';
    if (g.gold < Game.towerCost(type)) {
      g.gold += 200; // test subsidy: we want a full board
    }
    if (Game.placeTower(type, tx, ty)) placed++;
    if (placed >= 12) break outer;
  }
}
assert(placed >= 8, `placed ${placed} towers`);

// simulate waves 1..5
for (let w = 1; w <= 5; w++) {
  g.gold += 300; // keep economy flowing for the test
  Game.startWave(false);
  assert(g.state === 'wave', `wave ${w} started`);
  let ticks = 0;
  while (g.state === 'wave' && ticks++ < 60 * 240) Game.update(1 / 60);
  assert(g.clearedUpTo === w, `wave ${w} fully cleared (clearedUpTo=${g.clearedUpTo}, enemies=${g.enemies.length}, queue=${g.spawnQueue.length}, lives=${g.lives})`);
}
assert(g.kills > 30, `kills accumulated (${g.kills})`);
assert(g.corePts > 0, `core points accumulating (${g.corePts.toFixed(1)})`);
assert(g.goldEarned > 200, `gold earned (${g.goldEarned})`);

/* ---- tower upgrade & sell ---- */
const t0 = g.towers[0];
g.gold += 500;
const lvBefore = t0.level;
assert(Game.upgradeTower(t0) && t0.level === lvBefore + 1, 'upgrade works');
const goldBeforeSell = g.gold;
Game.sellTower(t0);
assert(g.gold > goldBeforeSell, 'sell refunds gold');
assert(!g.towers.includes(t0), 'tower removed after sell');

/* ---- abilities: tech tree + achievements ---- */
SaveSys.data.cores = 100;
const dmgNode = TECH.find(n => n.id === 'o_dmg');
assert(SaveSys.buyTech(dmgNode), 'tech purchase works');
assert(SaveSys.techRank('o_dmg') === 1, 'tech rank recorded');
const teslaNode = TECH.find(n => n.id === 'u_tesla');
assert(!SaveSys.canBuyTech(teslaNode).ok, 'tesla locked behind req');
SaveSys.data.tech['o_rate'] = 2;
assert(SaveSys.canBuyTech(teslaNode).ok, 'tesla buyable after req met');
const mods = MetaMods();
assert(Math.abs(mods.dmg - 1.08) < 0.001, `mods.dmg reflects tech (${mods.dmg})`);
assert(mods.unlocks.tesla === false, 'tesla still locked pre-purchase');

/* ---- tier-5 variants ---- */
SaveSys.reset();
SaveSys.data.cores = 200;
const arrowSpec = TECH.find(n => n.id === 's_arrow');
assert(!SaveSys.canBuyTech(arrowSpec).ok, 'arrow spec gated behind o_dmg2');
SaveSys.data.tech['o_dmg2'] = 1;
assert(SaveSys.buyTech(arrowSpec), 'arrow spec purchasable once req met');
assert(MetaMods().specs.arrow === true, 'specs.arrow reflected in mods');
assert(MetaMods().specs.frost === false, 'frost spec still locked');

Game.newRun('verdant', 'normal');
const g4 = Game.g;
g4.gold = 20000;
// one of each tower type, upgraded to 4
const specTech = { s_arrow: 1, s_cannon: 1, s_frost: 1, s_sniper: 1, s_tesla: 1, s_venom: 1, s_amp: 1 };
SaveSys.data.tech = Object.assign(SaveSys.data.tech, specTech);
Game.newRun('verdant', 'normal');
const g5 = Game.g;
g5.gold = 99999;
const variantPicks = {
  arrow: 'deadeye', cannon: 'mortar', frost: 'azero', sniper: 'railgun',
  tesla: 'stormlord', venom: 'plague', amp: 'focus',
};
let vx = 0;
for (const type of Object.keys(variantPicks)) {
  let ok = false;
  for (let ty = 0; ty < ROWS && !ok; ty++) for (let tx = 0; tx < COLS; tx++) {
    if (Game.canPlace(tx, ty)) { ok = Game.placeTower(type, tx, ty); if (ok) break; }
  }
  const tw = g5.towers[g5.towers.length - 1];
  while (tw.level < 4) Game.upgradeTower(tw);
  assert(Game.applyVariant(tw, variantPicks[type]), `${type} variant applied`);
  vx++;
}
assert(vx === 7, `all 7 towers specialized (${vx})`);
const rg = g5.towers.find(t => t.variant === 'railgun');
const rst = Game.towerStats(rg);
assert(rst.linePierce === true && rst.pierce === true && rst.dmg > 400, `railgun stats (dmg=${Math.round(rst.dmg)})`);
const az = Game.towerStats(g5.towers.find(t => t.variant === 'azero'));
assert(az.shatter === 0.5 && az.freeze > 0.2, 'absolute zero shatter/freeze stats');
const inv = Game.investedIn(rg);
assert(inv > TOWERS.sniper.cost + 130 + 270 + 550, `variant cost counted in investment (${inv})`);
// second variant is locked once specialized
assert(!Game.applyVariant(rg, 'headhunter'), 'cannot re-specialize');
// tech-locked tower cannot specialize (mods are snapshotted at newRun — toggle the run's mods)
g5.gold = 99999;
g5.mods.specs.frost = false;
let tf = null;
for (let ty = 0; ty < ROWS && !tf; ty++) for (let tx = 0; tx < COLS; tx++) {
  if (Game.canPlace(tx, ty) && Game.placeTower('frost', tx, ty)) { tf = g5.towers[g5.towers.length - 1]; break; }
}
while (tf.level < 4) Game.upgradeTower(tf);
assert(!Game.applyVariant(tf, 'glacier'), 'variant rejected without spec tech');
g5.mods.specs.frost = true;
assert(Game.applyVariant(tf, 'glacier'), 'glacier applied after unlock');
assert(Game.towerStats(tf).splash > 0, 'glacier has splash chill');
// run 3 waves with the specialized squad — exercises railgun/shatter/plague/stormlord code paths
for (let w = 1; w <= 3; w++) {
  Game.startWave(false);
  let ticks = 0;
  while (g5.state === 'wave' && ticks++ < 60 * 240) Game.update(1 / 60);
  assert(g5.clearedUpTo === w, `variant squad cleared wave ${w} (lives=${g5.lives})`);
}
assert(g5.kills > 20, `variant squad kills (${g5.kills})`);

/* ---- forced defeat path ---- */
Game.newRun('verdant', 'normal');
const g2 = Game.g;
g2.lives = 1;
Game.startWave(false);
let ticks = 0;
while (!g2.ended && ticks++ < 60 * 300) Game.update(1 / 60);
assert(g2.ended, 'run ends when lives hit 0');
assert(resultShown && resultShown.won === false, 'defeat summary shown');
assert(SaveSys.data.stats.runs >= 2, 'stats recorded');

/* ---- achievement check ---- */
SaveSys.data.ach = {}; // isolate from any achievements granted by earlier runs in this test
SaveSys.data.stats.kills = 6000;
const newAch = SaveSys.checkAchievements({ won: true, lives: 25, bestWave: 35, wavesCleared: 40, goldEarned: 9000 });
const ids = newAch.map(a => a.id);
assert(ids.includes('first_blood') && ids.includes('slayer'), `kill achievements granted (${ids})`);
assert(ids.includes('first_win') && ids.includes('flawless') && ids.includes('rich') && ids.includes('wave30'), 'run achievements granted');

/* ---- map/diff unlock logic ---- */
SaveSys.reset();
assert(SaveSys.isMapUnlocked(MAPS[0]) && !SaveSys.isMapUnlocked(MAPS[1]), 'map 2 locked initially');
SaveSys.recordRun('verdant', 'normal', true, 40, 18);
assert(SaveSys.isMapUnlocked(MAPS[1]), 'map 2 unlocks after map 1 win');
assert(SaveSys.isDiffUnlocked(MAPS[0], 'hard'), 'hard unlocks after normal win');
assert(!SaveSys.isDiffUnlocked(MAPS[0], 'nightmare'), 'nightmare still locked');

/* ---- wave generation sanity across 80 waves ---- */
for (let n = 1; n <= 80; n++) {
  const w = makeWave(n);
  assert2(n, w.groups.length > 0 && w.groups.every(gr => ENEMIES[gr.type] && gr.count > 0));
}
function assert2(n, cond) { if (!cond) { failures++; console.error('FAIL: bad wave', n); } }
console.log('ok: waves 1-80 generate valid compositions');

/* ---- xp / levels ---- */
SaveSys.reset();
const lv = SaveSys.addXp(1000);
assert(lv > 0 && SaveSys.data.level > 1, `xp levels up (${lv} levels)`);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
