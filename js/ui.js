/* COREFALL TD — UI: screens, tech tree, HUD, panels, modals */
'use strict';

const UI = {
  $: id => document.getElementById(id),

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.$('screen-' + name).classList.add('active');
    if (name === 'menu') this.refreshMenu();
    if (name === 'maps') this.buildMapSelect();
    if (name === 'tech') this.buildTech();
    if (name === 'ach') this.buildAch();
  },

  toast(msg, cls) {
    const wrap = this.$('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.innerHTML = msg;
    wrap.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3500);
  },

  /* ============================ MENU ============================ */
  refreshMenu() {
    const d = SaveSys.data;
    const need = SaveSys.xpFor(d.level);
    const achCount = Object.keys(d.ach).length;
    this.$('profile-summary').innerHTML =
      `<span>RANK <b>${d.level}</b></span>` +
      `<span>XP <b>${fmt(d.xp)}/${fmt(need)}</b></span>` +
      `<span>⬢ <b>${fmt(d.cores)}</b></span>` +
      `<span>WINS <b>${d.stats.wins}/${d.stats.runs}</b></span>` +
      `<span>KILLS <b>${fmt(d.stats.kills)}</b></span>` +
      `<span>★ <b>${achCount}/${ACHIEVEMENTS.length}</b></span>`;
    this.$('btn-mute').textContent = d.settings.mute ? '🔇 Muted' : '🔊 Sound';
    // starfield
    const stars = this.$('menu-stars');
    if (!stars.childElementCount) {
      for (let i = 0; i < 70; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 100 + '%';
        s.style.animationDelay = (Math.random() * 3) + 's';
        s.style.width = s.style.height = (1 + Math.random() * 2) + 'px';
        stars.appendChild(s);
      }
    }
  },

  /* ============================ MAP SELECT ============================ */
  buildMapSelect() {
    this.$('maps-cores').textContent = fmt(SaveSys.data.cores);
    const list = this.$('map-list');
    list.innerHTML = '';
    MAPS.forEach(map => {
      const unlocked = SaveSys.isMapUnlocked(map);
      const card = document.createElement('div');
      card.className = 'map-card ' + (unlocked ? 'unlocked' : 'locked');

      const thumb = document.createElement('canvas');
      thumb.className = 'map-thumb';
      thumb.width = 220; thumb.height = 120;
      this.drawMapThumb(thumb, map);

      const info = document.createElement('div');
      info.className = 'map-info';
      let bestTxt = '';
      if (unlocked) {
        const recs = SaveSys.data.maps[map.id];
        if (recs) {
          const best = Math.max(...DIFF_ORDER.map(d => (recs[d] && recs[d].bestWave) || 0));
          if (best > 0) bestTxt = `Best: wave ${best} · Core bonus ×${map.mult}`;
          else bestTxt = `Core bonus ×${map.mult}`;
        } else bestTxt = `Core bonus ×${map.mult}`;
      }
      info.innerHTML = `<h3>${unlocked ? map.name : '???'}</h3><p>${unlocked ? map.desc : 'Classified. Win the previous operation to reveal.'}</p><div class="map-best">${bestTxt}</div>`;

      const diffs = document.createElement('div');
      diffs.className = 'map-diffs';
      DIFF_ORDER.forEach(dk => {
        const d = DIFFS[dk];
        const btn = document.createElement('button');
        const dUnlocked = unlocked && SaveSys.isDiffUnlocked(map, dk);
        const rec = SaveSys.mapRec(map.id, dk);
        btn.className = 'btn diff-btn' + (dk === 'nightmare' ? ' nightmare' : '');
        btn.disabled = !dUnlocked;
        btn.innerHTML = dUnlocked
          ? `${rec && rec.won ? '<span class="won-star">★</span>' : ''}${d.name}<span class="diff-mult">×${d.mult} ⬢</span>`
          : `🔒 ${d.name}<span class="diff-lock">${dk === 'hard' ? 'win Normal' : 'win Hard'}</span>`;
        if (dUnlocked) btn.onclick = () => { Sfx.init(); Sfx.ui(); this.startRun(map.id, dk); };
        diffs.appendChild(btn);
      });

      card.appendChild(thumb); card.appendChild(info); card.appendChild(diffs);
      list.appendChild(card);
    });
  },

  drawMapThumb(canvas, map) {
    const x = canvas.getContext('2d');
    const sx = canvas.width / W, sy = canvas.height / H;
    x.fillStyle = map.theme.ground;
    x.fillRect(0, 0, canvas.width, canvas.height);
    const path = Game.buildPath(map);
    x.strokeStyle = map.theme.path;
    x.lineWidth = 34 * sx;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    path.pts.forEach((p, i) => {
      const px = p.x * sx, py = p.y * sy;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    });
    x.stroke();
    // core
    const end = path.pts[path.pts.length - 1];
    x.fillStyle = '#6ee7ff';
    x.fillRect(end.x * sx - 4, end.y * sy - 4, 8, 8);
  },

  startRun(mapId, diffKey) {
    Game.newRun(mapId, diffKey);
    this.showScreen('game');
    this.buildPalette();
    this.showSelection(null);
    this.updateHUD();
    this.updateWaveBar();
  },

  /* ============================ TECH TREE ============================ */
  buildTech() {
    this.$('tech-cores').textContent = fmt(SaveSys.data.cores);
    const cv = this.$('tech-canvas');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = '600 13px Rajdhani, sans-serif';

    // edges
    for (const n of TECH) {
      if (!n.req) continue;
      const from = TECH.find(t => t.id === n.req.id);
      const unlocked = SaveSys.techRank(n.req.id) >= n.req.rank;
      ctx.strokeStyle = unlocked ? 'rgba(124,108,255,.8)' : 'rgba(80,90,140,.35)';
      ctx.lineWidth = unlocked ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
    }
    // nodes
    for (const n of TECH) {
      const rank = SaveSys.techRank(n.id);
      const maxed = rank >= n.max;
      const canBuy = SaveSys.canBuyTech(n).ok;
      const col = TECH_BRANCH_COLORS[n.b];
      ctx.beginPath();
      ctx.arc(n.x, n.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = maxed ? col : canBuy ? 'rgba(30,40,80,.95)' : 'rgba(15,20,40,.9)';
      if (maxed) { ctx.shadowColor = col; ctx.shadowBlur = 16; }
      else if (canBuy) { ctx.shadowColor = col; ctx.shadowBlur = 8; }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = col;
      ctx.lineWidth = rank > 0 ? 3 : 1.5;
      ctx.globalAlpha = maxed || canBuy || rank > 0 ? 1 : 0.45;
      ctx.stroke();
      // label
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '700 15px Rajdhani, sans-serif';
      const label = n.unlock ? TOWERS[n.unlock].icon : n.name.split(' ').map(w => w[0]).join('').slice(0, 2);
      ctx.fillText(label, n.x, n.y + 5);
      // rank pips
      for (let i = 0; i < n.max; i++) {
        ctx.fillStyle = i < rank ? '#ffd23f' : 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.arc(n.x - (n.max - 1) * 5 + i * 10, n.y + 34, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // name
      ctx.fillStyle = 'rgba(219,228,255,.85)';
      ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.fillText(n.name, n.x, n.y + 52);
      ctx.globalAlpha = 1;
    }
  },

  techNodeAt(mx, my) {
    for (const n of TECH) {
      if (Math.hypot(n.x - mx, n.y - my) <= 28) return n;
    }
    return null;
  },

  showTechTooltip(n, mx, my) {
    const tt = this.$('tech-tooltip');
    if (!n) { tt.classList.add('hidden'); return; }
    const rank = SaveSys.techRank(n.id);
    const chk = SaveSys.canBuyTech(n);
    let status;
    if (rank >= n.max) status = `<span class="tt-rank">MAXED (${rank}/${n.max})</span>`;
    else if (chk.ok) status = `<span class="tt-cost">Cost: ${chk.cost} ⬢</span> <span class="tt-rank">(${rank}/${n.max})</span>`;
    else if (chk.why === 'req') {
      const req = TECH.find(t => t.id === n.req.id);
      status = `<span class="tt-req">Requires: ${req.name} rank ${n.req.rank}</span>`;
    }
    else status = `<span class="tt-cost">Cost: ${n.costs[rank]} ⬢</span> <span class="tt-req">— not enough cores</span>`;
    tt.innerHTML = `<h4>${n.name}</h4><div class="tt-desc">${n.desc}</div><div>${status}</div>`;
    tt.classList.remove('hidden');
    const r = this.$('tech-canvas').parentElement.getBoundingClientRect();
    tt.style.left = Math.min(mx + 18, r.width - 270) + 'px';
    tt.style.top = Math.max(my - 20, 4) + 'px';
  },

  /* ============================ ACHIEVEMENTS ============================ */
  buildAch() {
    const d = SaveSys.data;
    const got = Object.keys(d.ach).length;
    this.$('ach-count').textContent = `${got} / ${ACHIEVEMENTS.length}`;
    const list = this.$('ach-list');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const has = !!d.ach[a.id];
      const card = document.createElement('div');
      card.className = 'ach-card ' + (has ? 'unlocked' : 'locked');
      let progHtml = '';
      if (!has && a.prog) {
        const [cur, max] = a.prog(d);
        progHtml = `<div class="ach-progress"><i style="width:${Math.min(100, cur / max * 100)}%"></i></div>`;
      }
      card.innerHTML =
        `<div class="ach-icon">${has ? a.icon : '🔒'}</div>` +
        `<div class="ach-info"><h4>${a.name}</h4><p>${a.desc}</p>${progHtml}</div>` +
        `<div class="ach-reward">+${a.reward} ⬢${a.buff ? `<span class="ach-buff">${a.buff}</span>` : ''}</div>`;
      list.appendChild(card);
    });
  },

  /* ============================ GAME HUD ============================ */
  buildPalette() {
    const g = Game.g;
    const pal = this.$('tower-palette');
    pal.innerHTML = '';
    TOWER_ORDER.forEach(type => {
      const def = TOWERS[type];
      const locked = def.locked && !g.mods.unlocks[type];
      const btn = document.createElement('button');
      btn.className = 'pal-btn' + (locked ? ' locked-tower' : '');
      btn.dataset.type = type;
      btn.innerHTML =
        `<div class="pal-head"><span class="pal-icon" style="background:${def.color}22;color:${def.color}">${def.icon}</span>${def.name}</div>` +
        `<div class="pal-cost">${locked ? '🔒 unlock in Tech Tree' : '🪙 ' + Game.towerCost(type)}</div>` +
        `<div class="pal-desc">${def.desc}</div>` +
        `<span class="pal-key">${def.key}</span>`;
      if (!locked) {
        btn.onclick = () => { Game.g.placing = Game.g.placing === type ? null : type; Game.g.selected = null; this.showSelection(null); this.refreshPaletteSel(); Sfx.ui(); };
      }
      pal.appendChild(btn);
    });
  },

  refreshPaletteSel() {
    const g = Game.g;
    document.querySelectorAll('.pal-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.type === g.placing);
    });
  },

  updateHUD() {
    const g = Game.g;
    if (!g) return;
    this.$('hud-gold').textContent = fmt(g.gold);
    this.$('hud-lives').textContent = g.lives;
    this.$('hud-wave').textContent = Math.max(g.wave, 0) + (g.endless ? ' ∞' : '/' + FINAL_WAVE);
    this.$('hud-cores').textContent = fmt(Math.round(g.corePts * g.mods.coreGain) - (g.bankedCores || 0));
    this.$('hud-speed').textContent = g.speed + '×';
    this.$('hud-mute').textContent = SaveSys.data.settings.mute ? '🔇' : '🔊';
    // affordability
    document.querySelectorAll('.pal-btn').forEach(b => {
      const type = b.dataset.type;
      if (b.classList.contains('locked-tower')) return;
      b.disabled = g.gold < Game.towerCost(type);
    });
    // selection panel buttons
    const upBtn = this.$('sel-upgrade');
    if (upBtn && g.selected) {
      const t = g.selected;
      if (t.level >= 4) { upBtn.disabled = true; upBtn.textContent = 'MAX LEVEL'; }
      else { upBtn.disabled = g.gold < Game.upgradeCost(t); upBtn.innerHTML = `⬆ Upgrade 🪙${Game.upgradeCost(t)}`; }
    }
  },

  updateWaveBar() {
    const g = Game.g;
    const btn = this.$('btn-wave');
    const prev = this.$('wave-preview');
    const autoBtn = this.$('btn-autostart');
    if (!g || g.ended) { btn.style.display = 'none'; autoBtn.style.display = 'none'; prev.innerHTML = ''; return; }
    btn.style.display = '';
    // endless-only auto-start toggle
    if (g.endless) {
      autoBtn.style.display = '';
      autoBtn.classList.toggle('on', g.autoStart);
      autoBtn.textContent = `🔁 AUTO: ${g.autoStart ? 'ON' : 'OFF'}`;
    } else {
      autoBtn.style.display = 'none';
    }
    if (g.state === 'wave') {
      const n = g.wave + 1;
      const bonus = Math.round((15 + n * 2) * g.mods.earlyBonus);
      btn.className = 'btn btn-wave early';
      btn.innerHTML = `⏩ CALL WAVE ${n} EARLY (+${bonus}g)`;
    } else {
      btn.className = 'btn btn-wave';
      btn.innerHTML = g.autoTimer > 0
        ? `▶ WAVE ${g.wave + 1} IN ${Math.ceil(g.autoTimer)}…`
        : `▶ START WAVE ${g.wave + 1}${g.wave + 1 === FINAL_WAVE ? ' (FINAL)' : ''}`;
    }
    // preview of next wave
    const w = g.nextWave;
    const counts = {};
    w.groups.forEach(gr => { counts[gr.type] = (counts[gr.type] || 0) + gr.count; });
    prev.innerHTML = '<span style="color:var(--dim)">Next:</span> ' + Object.entries(counts).map(([type, c]) => {
      const def = ENEMIES[type];
      return `<span class="wp-enemy"><i class="wp-dot" style="background:${def.color}"></i>${def.name} ×${c}</span>`;
    }).join('');
  },

  showSelection(t) {
    const panel = this.$('selection-panel');
    if (!t) {
      panel.innerHTML = `<div class="sel-hint">Select a tower from the palette, then click a build pad on the map.<br><br>Click a placed tower to inspect, upgrade, or sell it.</div>`;
      return;
    }
    const g = Game.g;
    const def = t.def;
    const st = Game.towerStats(t);
    const i = t.level - 1;
    const stat = (label, val, next) =>
      `<div>${label}<span class="stat-v">${val}${next ? ` <span class="stat-up">→${next}</span>` : ''}</span></div>`;
    let statsHtml = '';
    if (def.support) {
      statsHtml += stat('Damage aura', '+' + Math.round(st.aura * 100) + '%', t.level < 4 ? '+' + Math.round(def.aura[i + 1] * 100) + '%' : null);
      statsHtml += stat('Aura radius', (st.range / TILE).toFixed(1), t.level < 4 ? def.range[i + 1].toFixed(1) : null);
      if (t.level < 4 && def.rateAura[i + 1]) statsHtml += stat('Next: rate aura', '+0%', '+' + Math.round(def.rateAura[i + 1] * 100) + '%');
    } else {
      const dps = Math.round(st.dmg * st.rate * (st.multi || 1));
      statsHtml += stat('Damage', Math.round(st.dmg), t.level < 4 ? Math.round(def.dmg[i + 1] * g.mods.dmg) : null);
      statsHtml += stat('Fire rate', st.rate.toFixed(2) + '/s');
      statsHtml += stat('Range', (st.range / TILE).toFixed(1));
      statsHtml += stat('DPS', dps);
      if (st.splash) statsHtml += stat('Splash', (st.splash / TILE).toFixed(1) + ' tiles');
      if (st.slow) statsHtml += stat('Slow', Math.round(st.slow * 100) + '%');
      if (st.chain) statsHtml += stat('Chains', st.chain);
      if (st.poisonDps) statsHtml += stat('Poison', Math.round(st.poisonDps) + '/s');
    }
    const special = def.special[i];
    const nextSpecial = t.level < 4 ? def.special[i + 1] : null;
    panel.innerHTML =
      `<div class="sel-title"><span class="pal-icon" style="background:${def.color}22;color:${def.color}">${def.icon}</span>${def.name}</div>` +
      `<div class="sel-level">${'★'.repeat(t.level)}${'☆'.repeat(4 - t.level)} &nbsp;·&nbsp; ${t.kills} kills</div>` +
      `<div class="sel-stats">${statsHtml}</div>` +
      (special ? `<div class="sel-special">✦ ${special}</div>` : '') +
      (nextSpecial ? `<div class="sel-special" style="color:var(--dim)">Next: ${nextSpecial}</div>` : '') +
      `<div class="sel-buttons">` +
      `<button class="btn btn-upgrade" id="sel-upgrade"></button>` +
      `<button class="btn btn-sell" id="sel-sell">Sell 🪙${Math.round(Game.investedIn(t) * g.mods.salvage)}</button>` +
      `</div>` +
      (def.support ? '' : `<div class="target-modes" id="target-modes">` +
        ['first', 'last', 'strong', 'weak'].map(m =>
          `<button data-mode="${m}" class="${t.mode === m ? 'active' : ''}">${m.toUpperCase()}</button>`).join('') +
        `</div>`);
    this.$('sel-upgrade').onclick = () => Game.upgradeTower(t);
    this.$('sel-sell').onclick = () => Game.sellTower(t);
    const tm = this.$('target-modes');
    if (tm) tm.querySelectorAll('button').forEach(b => {
      b.onclick = () => { t.mode = b.dataset.mode; tm.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); Sfx.ui(); };
    });
    this.updateHUD();
  },

  /* ============================ RESULTS ============================ */
  showResults(summary, newAch, levels, unlocks) {
    const m = this.$('modal');
    const title = this.$('modal-title');
    const body = this.$('modal-body');
    const btns = this.$('modal-buttons');
    title.textContent = summary.won ? '★ VICTORY ★' : 'CORE OFFLINE';
    title.className = summary.won ? 'win' : 'lose';
    let html =
      `<div style="color:var(--dim);margin-bottom:8px">${summary.mapName} — ${summary.diffName}${summary.endless ? ' (Endless)' : ''}</div>` +
      `<div class="reward-row"><span>Waves cleared</span><b>${summary.wavesCleared}</b></div>` +
      `<div class="reward-row"><span>Enemies destroyed</span><b>${fmt(summary.kills)}</b></div>` +
      `<div class="reward-row"><span>Gold earned</span><b>🪙 ${fmt(summary.goldEarned)}</b></div>` +
      `<div class="reward-row"><span>Lives remaining</span><b>❤ ${summary.lives}</b></div>` +
      `<hr style="border-color:var(--line);margin:8px 0">` +
      `<div class="reward-row"><span>Cores earned</span><b>⬢ +${summary.cores}</b></div>` +
      `<div class="reward-row"><span>Experience</span><b class="xp">+${summary.xp} XP</b></div>`;
    if (levels > 0) html += `<div class="unlock-note">⬆ RANK UP! Now level ${SaveSys.data.level} (+1% cores per level)</div>`;
    if (unlocks && unlocks.length) html += unlocks.map(u => `<div class="unlock-note">🔓 Unlocked: ${u}</div>`).join('');
    if (newAch && newAch.length) html += newAch.map(a => `<div class="unlock-note">${a.icon} Achievement: ${a.name} (+${a.reward} ⬢)</div>`).join('');
    body.innerHTML = html;

    btns.innerHTML = '';
    const g = Game.g;
    if (summary.won && !summary.endless) {
      const bEndless = document.createElement('button');
      bEndless.className = 'btn btn-big';
      bEndless.textContent = '♾ ENDLESS MODE';
      bEndless.onclick = () => {
        m.classList.add('hidden');
        Game.continueEndless();
        this.toast('Endless mode — waves keep coming. Cores at half rate.', 'info');
      };
      btns.appendChild(bEndless);
    }
    const bRetry = document.createElement('button');
    bRetry.className = 'btn';
    bRetry.textContent = '↻ RETRY';
    bRetry.onclick = () => { m.classList.add('hidden'); this.startRun(summary.mapId, summary.diffKey); };
    const bLeave = document.createElement('button');
    bLeave.className = 'btn';
    bLeave.textContent = '▶ CONTINUE';
    bLeave.onclick = () => { m.classList.add('hidden'); this.showScreen('maps'); };
    btns.appendChild(bRetry); btns.appendChild(bLeave);
    m.classList.remove('hidden');
    this.updateWaveBar();
    // achievement toasts
    (newAch || []).forEach((a, i) => {
      setTimeout(() => { this.toast(`${a.icon} <b>${a.name}</b> — +${a.reward} ⬢`, 'ach-toast'); Sfx.achUnlock(); }, 600 + i * 900);
    });
    if (levels > 0) setTimeout(() => Sfx.levelUp(), 400);
  },

  confirmQuit() {
    const m = this.$('modal');
    this.$('modal-title').textContent = 'ABANDON RUN?';
    this.$('modal-title').className = 'lose';
    this.$('modal-body').innerHTML = 'The Core will fall, but you keep all cores and XP earned so far.';
    const btns = this.$('modal-buttons');
    btns.innerHTML = '';
    const bYes = document.createElement('button');
    bYes.className = 'btn btn-danger';
    bYes.textContent = 'ABANDON';
    bYes.onclick = () => { m.classList.add('hidden'); Game.endRun(false); };
    const bNo = document.createElement('button');
    bNo.className = 'btn';
    bNo.textContent = 'KEEP FIGHTING';
    bNo.onclick = () => { m.classList.add('hidden'); Game.g.paused = false; };
    btns.appendChild(bYes); btns.appendChild(bNo);
    m.classList.remove('hidden');
  },
};
