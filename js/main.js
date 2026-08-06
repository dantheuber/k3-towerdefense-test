/* COREFALL TD — boot, main loop, input */
'use strict';

(function main() {
  SaveSys.load();
  SaveSys.checkAchievements(null); // catch progress-based achievements on boot

  const canvas = document.getElementById('game-canvas');
  Game.canvas = canvas;
  Game.ctx = canvas.getContext('2d');

  /* ---------- screen navigation ---------- */
  document.getElementById('btn-play').onclick = () => { Sfx.init(); Sfx.ui(); UI.showScreen('maps'); };
  document.getElementById('btn-tech').onclick = () => { Sfx.init(); Sfx.ui(); UI.showScreen('tech'); };
  document.getElementById('btn-ach').onclick = () => { Sfx.init(); Sfx.ui(); UI.showScreen('ach'); };
  document.getElementById('btn-help').onclick = () => { Sfx.init(); Sfx.ui(); UI.showScreen('help'); };
  document.querySelectorAll('[data-back]').forEach(b => {
    b.onclick = () => { Sfx.ui(); UI.showScreen('menu'); };
  });
  document.getElementById('btn-mute').onclick = toggleMute;
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('Delete ALL progress? This cannot be undone.')) {
      SaveSys.reset();
      UI.refreshMenu();
      UI.toast('Save wiped. Fresh start, Commander.', 'info');
    }
  };

  function toggleMute() {
    Sfx.init();
    SaveSys.data.settings.mute = !SaveSys.data.settings.mute;
    SaveSys.save();
    UI.refreshMenu();
    if (Game.g) UI.updateHUD();
  }

  /* ---------- tech tree interaction ---------- */
  const techCv = document.getElementById('tech-canvas');
  techCv.addEventListener('mousemove', e => {
    const r = techCv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (techCv.width / r.width);
    const my = (e.clientY - r.top) * (techCv.height / r.height);
    const n = UI.techNodeAt(mx, my);
    UI.showTechTooltip(n, mx, my);
    techCv.style.cursor = n ? 'pointer' : 'default';
  });
  techCv.addEventListener('mouseleave', () => UI.showTechTooltip(null));
  techCv.addEventListener('click', e => {
    const r = techCv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (techCv.width / r.width);
    const my = (e.clientY - r.top) * (techCv.height / r.height);
    const n = UI.techNodeAt(mx, my);
    if (!n) return;
    if (SaveSys.buyTech(n)) {
      Sfx.techBuy();
      UI.buildTech();
      UI.toast(`⬡ <b>${n.name}</b> — rank ${SaveSys.techRank(n.id)}`, 'info');
    } else {
      Sfx.ui();
    }
  });

  /* ---------- game input ---------- */
  function canvasTile(e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top) * (canvas.height / r.height);
    return { tx: Math.floor(mx / TILE), ty: Math.floor(my / TILE) };
  }

  canvas.addEventListener('mousemove', e => {
    if (!Game.g) return;
    Game.g.hoverTile = canvasTile(e);
  });

  canvas.addEventListener('click', e => {
    Sfx.init(); Sfx.resume();
    const g = Game.g;
    if (!g || g.ended) return;
    const { tx, ty } = canvasTile(e);
    if (g.placing) {
      const type = g.placing;
      if (Game.placeTower(type, tx, ty)) {
        // keep placing while affordable; otherwise drop the ghost
        if (g.gold < Game.towerCost(type)) { g.placing = null; UI.refreshPaletteSel(); }
      }
      return;
    }
    const t = g.towers.find(t => t.tx === tx && t.ty === ty);
    g.selected = t || null;
    UI.showSelection(t || null);
    if (t) Sfx.ui();
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const g = Game.g;
    if (!g) return;
    g.placing = null;
    g.selected = null;
    UI.refreshPaletteSel();
    UI.showSelection(null);
  });

  /* ---------- top bar & wave controls ---------- */
  document.getElementById('btn-wave').onclick = () => {
    const g = Game.g;
    if (!g || g.ended) return;
    Game.startWave(g.state === 'wave');
    UI.updateWaveBar();
  };
  document.getElementById('btn-autostart').onclick = () => {
    const g = Game.g;
    if (!g || g.ended || !g.endless) return;
    g.autoStart = !g.autoStart;
    if (!g.autoStart) g.autoTimer = 0;
    else if (g.state === 'build') g.autoTimer = 5;
    UI.updateWaveBar();
    Sfx.ui();
  };
  document.getElementById('hud-speed').onclick = cycleSpeed;
  document.getElementById('hud-pause').onclick = togglePause;
  document.getElementById('hud-mute').onclick = toggleMute;
  document.getElementById('hud-quit').onclick = () => {
    const g = Game.g;
    if (!g || g.ended) return;
    g.paused = true;
    UI.confirmQuit();
  };

  function cycleSpeed() {
    const g = Game.g;
    if (!g) return;
    g.speed = g.speed >= 3 ? 1 : g.speed + 1;
    SaveSys.data.settings.speed = g.speed;
    SaveSys.save();
    UI.updateHUD();
    Sfx.ui();
  }
  function togglePause() {
    const g = Game.g;
    if (!g || g.ended) return;
    g.paused = !g.paused;
    Sfx.ui();
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    const g = Game.g;
    if (!g || !document.getElementById('screen-game').classList.contains('active')) return;
    if (e.key >= '1' && e.key <= '7') {
      const type = TOWER_ORDER[Number(e.key) - 1];
      const def = TOWERS[type];
      if (def && !(def.locked && !g.mods.unlocks[type])) {
        g.placing = g.placing === type ? null : type;
        g.selected = null;
        UI.refreshPaletteSel();
        UI.showSelection(null);
        Sfx.ui();
      }
    } else if (e.key === 'Escape') {
      g.placing = null; g.selected = null;
      UI.refreshPaletteSel(); UI.showSelection(null);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (!g.ended) { Game.startWave(g.state === 'wave'); UI.updateWaveBar(); }
    } else if (e.key === 'f' || e.key === 'F') cycleSpeed();
    else if (e.key === 'p' || e.key === 'P') togglePause();
    else if (e.key === 'm' || e.key === 'M') toggleMute();
  });

  // audio unlock on first gesture
  document.addEventListener('pointerdown', () => { Sfx.init(); Sfx.resume(); }, { once: true });

  /* ---------- main loop ---------- */
  let last = performance.now();
  let hudTimer = 0;
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (Game.g && document.getElementById('screen-game').classList.contains('active')) {
      Game.update(dt);
      Game.render();
      hudTimer += dt;
      if (hudTimer > 0.15) {
        hudTimer = 0;
        UI.updateHUD();
        if (Game.g.autoTimer > 0) UI.updateWaveBar(); // live countdown
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  UI.showScreen('menu');
})();
