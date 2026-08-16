/* Balance sim: auto-player builds a sensible defense, see how far it gets. */
const fs = require('fs');
const noopCtx = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
const stubEl = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, textContent: '', innerHTML: '', width: 768, height: 528, getContext: () => noopCtx, addEventListener() {}, appendChild() {}, querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 528 }) });
global.document = { getElementById: () => stubEl(), createElement: () => stubEl(), querySelectorAll: () => [], addEventListener() {} };
global.window = global;
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
for (const f of ['data.js', 'save.js', 'audio.js', 'game.js']) {
  eval(fs.readFileSync('js/' + f, 'utf8').replace(/^'use strict';/m, '').replace(/^(const|let) /gm, 'var '));
}
global.UI = { updateHUD() {}, updateWaveBar() {}, showSelection() {}, refreshPaletteSel() {}, toast() {}, showResults() {} };
SaveSys.load();

function distToPath(g, tx, ty) {
  let best = 99;
  for (const key of g.path.blocked) {
    const [bx, by] = key.split(',').map(Number);
    best = Math.min(best, Math.hypot(bx - tx, by - ty));
  }
  return best;
}

function autoPlay(mapId, diffKey, label, tech) {
  SaveSys.reset();
  if (tech) { SaveSys.data.tech = tech; SaveSys.data.cores = 0; }
  Game.newRun(mapId, diffKey);
  const g = Game.g;
  // candidate build tiles sorted by proximity to path
  const tiles = [];
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    if (Game.canPlace(tx, ty)) tiles.push({ tx, ty, d: distToPath(g, tx, ty) });
  }
  tiles.sort((a, b) => a.d - b.d);
  let tileIdx = 0;
  let towerCount = 0;

  while (!g.ended && g.wave <= FINAL_WAVE + 1) {
    // build phase: human-like play — cap tower count, then focus upgrades on path-adjacent towers
    const picks = ['arrow', 'cannon', 'arrow', 'frost', 'cannon', 'sniper', 'arrow', 'frost'];
    let guard = 0;
    while (guard++ < 40) {
      const nearPath = g.towers.filter(t => distToPath(g, t.tx, t.ty) <= 1.6 && t.level < 4)
        .sort((a, b) => a.level - b.level);
      // tier-5: specialize a maxed tower when affordable
      const specTarget = g.towers.find(t => t.level === 4 && !t.variant && t.def.variants && g.mods.specs[t.type]
        && g.gold >= Game.variantCost(t.def.variants[0]) + 80);
      if (specTarget && g.towers.length >= 8) { Game.applyVariant(specTarget, specTarget.def.variants[0].id); continue; }
      const want = picks[towerCount % picks.length];
      const cost = Game.towerCost(want);
      const upTarget = nearPath[0];
      // prefer upgrading once we have a base of towers
      if (upTarget && g.towers.length >= 8 && g.gold >= Game.upgradeCost(upTarget) + 80) {
        Game.upgradeTower(upTarget);
        continue;
      }
      if (g.towers.length >= 26 || g.gold < cost + 40) break;
      const tile = tiles[tileIdx % tiles.length];
      tileIdx++;
      if (Game.placeTower(want, tile.tx, tile.ty)) towerCount++;
      else if (tileIdx > tiles.length) break;
    }
    Game.startWave(false);
    let ticks = 0;
    while (g.state === 'wave' && !g.ended && ticks++ < 60 * 600) Game.update(1 / 60);
    if (g.won) break;
  }
  console.log(`${label}: wave reached=${g.wave}, cleared=${g.clearedUpTo}, lives=${g.lives}, towers=${g.towers.length}, won=${g.won}`);
}

autoPlay('verdant', 'normal', 'verdant/normal   ');
autoPlay('verdant', 'normal', 'verdant/normal #2');
autoPlay('ashen', 'normal', 'ashen/normal     ');
autoPlay('shattered', 'normal', 'shattered/normal ');
autoPlay('verdant', 'hard', 'verdant/hard+tech ', { o_dmg: 3, o_rate: 3, d_lives: 3, e_gold: 3, e_bounty: 3, o_crit: 2 });
autoPlay('verdant', 'nightmare', 'verdant/nm+tech   ', { o_dmg: 3, o_rate: 3, o_crit: 3, o_range: 2, o_exec: 1, d_lives: 3, d_repair: 2, e_gold: 3, e_bounty: 3, e_int: 2, u_tesla: 1 });
autoPlay('shattered', 'nightmare', 'shattered/nm+spec', { o_dmg: 3, o_dmg2: 2, o_rate: 3, o_crit: 3, o_critx: 2, o_range: 2, o_splash: 2, o_exec: 1, o_omega: 1, d_lives: 3, d_lives2: 2, d_repair: 2, d_frost: 2, e_gold: 3, e_bounty: 3, e_int: 2, u_tesla: 1, s_arrow: 1, s_cannon: 1, s_frost: 1, s_sniper: 1 });
