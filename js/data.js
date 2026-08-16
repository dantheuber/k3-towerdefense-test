/* COREFALL TD — data definitions: towers, enemies, maps, tech tree, achievements */
'use strict';

const TILE = 48, COLS = 16, ROWS = 11, W = COLS * TILE, H = ROWS * TILE;
const FINAL_WAVE = 40;

/* ============================== TOWERS ============================== */
/* Stat arrays are indexed [level-1]; upcosts[i] = cost to go from level i+1 to i+2. */
const TOWERS = {
  arrow: {
    name: 'Arrow Tower', icon: '➶', color: '#7ec850', key: '1',
    desc: 'Rapid single-target shots. Cheap and reliable.',
    cost: 50,
    dmg:    [12, 20, 34, 58],
    rate:   [1.5, 1.7, 1.95, 2.3],
    range:  [2.6, 2.7, 2.85, 3.05],
    upcosts: [45, 95, 200],
    projSpeed: 9,
    special: [null, null, null, 'Twin Shot — fires 2 arrows'],
    multi: [1, 1, 1, 2],
    variants: [
      { id: 'deadeye', name: 'Deadeye', icon: '🎯', cost: 420,
        desc: 'Single devastating bolt. Loses Twin Shot, but gains huge damage, range, armor-piercing and +15% crit.',
        special: 'Deadeye — armor-piercing bolt, +15% crit',
        stats: { dmg: 185, rate: 1.55, range: 3.7, multi: 1, pierce: true },
        flags: { critBonus: 0.15 } },
      { id: 'arrowstorm', name: 'Arrow Storm', icon: '🏹', cost: 420,
        desc: 'Volley of 4 arrows, each seeking a different target. Shreds hordes.',
        special: 'Arrow Storm — 4 arrows, each seeks its own target',
        stats: { dmg: 34, rate: 3.1, range: 2.95, multi: 4 },
        flags: { spread: true } },
    ],
  },
  cannon: {
    name: 'Cannon', icon: '💣', color: '#fb923c', key: '2',
    desc: 'Explosive shells deal splash damage in an area.',
    cost: 100,
    dmg:    [24, 40, 68, 118],
    rate:   [0.7, 0.75, 0.82, 0.92],
    range:  [2.4, 2.45, 2.55, 2.7],
    splash: [1.0, 1.1, 1.25, 1.5],
    upcosts: [90, 190, 400],
    projSpeed: 6,
    stun: [0, 0, 0, 0.35],
    special: [null, null, null, 'Concussion — explosions stun 0.35s'],
    variants: [
      { id: 'mortar', name: 'Siege Mortar', icon: '☄', cost: 760,
        desc: 'Lobbed heavy shells: massive splash and long stuns, extra range, slow to reload.',
        special: 'Siege — huge blast, stuns 0.6s',
        stats: { dmg: 250, rate: 0.55, range: 3.3, splash: 2.2, stun: 0.6 } },
      { id: 'shrapnel', name: 'Shrapnel Battery', icon: '✸', cost: 760,
        desc: 'Rapid twin barrels firing lighter shells. Sustained area damage against packs.',
        special: 'Shrapnel — fires 2 shells at high speed',
        stats: { dmg: 72, rate: 1.5, range: 2.6, splash: 1.15, stun: 0.2, multi: 2 } },
    ],
  },
  frost: {
    name: 'Frost Spire', icon: '❄', color: '#67e8f9', key: '3',
    desc: 'Chilling bolts slow enemies. Control the flow.',
    cost: 75,
    dmg:    [5, 8, 13, 22],
    rate:   [1.2, 1.3, 1.45, 1.65],
    range:  [2.3, 2.4, 2.5, 2.65],
    slow:   [0.35, 0.42, 0.5, 0.62],
    slowDur: [1.6, 1.7, 1.9, 2.2],
    upcosts: [70, 150, 320],
    projSpeed: 7,
    freeze: [0, 0, 0, 0.15],
    special: [null, null, null, 'Deep Freeze — 15% chance to freeze solid 1s'],
    variants: [
      { id: 'glacier', name: 'Glacier Spire', icon: '🧊', cost: 620,
        desc: 'Bolts burst on impact, chilling every enemy within the blast area.',
        special: 'Glacier — chills splash in a wide area',
        stats: { dmg: 30, rate: 1.5, range: 2.7, slow: 0.68, slowDur: 2.6, freeze: 0.08, splash: 1.4 } },
      { id: 'azero', name: 'Absolute Zero', icon: '❆', cost: 620,
        desc: 'Focused cryo beam: freezes 30% of hits, and frozen enemies take +50% damage from all sources.',
        special: 'Shatter — frozen enemies take +50% damage',
        stats: { dmg: 48, rate: 1.5, range: 2.75, slow: 0.5, slowDur: 2.0, freeze: 0.3 },
        flags: { shatter: 0.5 } },
    ],
  },
  sniper: {
    name: 'Sniper Nest', icon: '◎', color: '#f472b6', key: '4',
    desc: 'Extreme range, massive damage, slow fire rate.',
    cost: 150,
    dmg:    [75, 130, 225, 400],
    rate:   [0.45, 0.5, 0.56, 0.68],
    range:  [4.5, 4.7, 5.0, 5.5],
    upcosts: [130, 270, 550],
    projSpeed: 16,
    pierce: [false, false, false, true],
    special: [null, null, null, 'AP Rounds — ignores armor'],
    variants: [
      { id: 'railgun', name: 'Railgun', icon: '⟿', cost: 1150,
        desc: 'Penetrating slug hits every enemy in a straight line out to maximum range.',
        special: 'Railgun — pierces all enemies in a line',
        stats: { dmg: 520, rate: 0.5, range: 6.2, pierce: true },
        flags: { linePierce: true } },
      { id: 'headhunter', name: 'Headhunter', icon: '☠', cost: 1150,
        desc: 'Optimized for high-value targets: +80% damage to enemies above 60% HP.',
        special: 'Opening Salvo — +80% damage to healthy targets',
        stats: { dmg: 430, rate: 0.78, range: 5.8, pierce: true },
        flags: { openingBonus: 0.8 } },
    ],
  },
  tesla: {
    name: 'Tesla Coil', icon: '⚡', color: '#a78bfa', key: '5', locked: true,
    desc: 'Chain lightning arcs between enemies.',
    cost: 200,
    dmg:    [28, 47, 80, 140],
    rate:   [0.9, 1.0, 1.12, 1.3],
    range:  [2.8, 2.9, 3.05, 3.25],
    chain:  [3, 4, 5, 7],
    falloff: [0.72, 0.74, 0.78, 0.9],
    upcosts: [170, 350, 700],
    special: [null, null, null, 'Superconductor — chains lose only 10% damage'],
    variants: [
      { id: 'stormlord', name: 'Stormlord', icon: '🌩', cost: 1350,
        desc: 'Chains up to 14 targets with zero damage falloff and longer arcs. Slower cycling.',
        special: 'Stormlord — 14 chains, no falloff',
        stats: { dmg: 130, rate: 0.9, range: 3.3, chain: 14, falloff: 1.0, chainR: 2.9 } },
      { id: 'overload', name: 'Overload', icon: '⚡', cost: 1350,
        desc: 'Rapid discharge: fewer chains but each arc grows stronger (+5% per jump) and fires fast.',
        special: 'Overload — arcs intensify +5% per jump',
        stats: { dmg: 105, rate: 2.1, range: 3.1, chain: 4, falloff: 1.05, chainR: 2.6 } },
    ],
  },
  venom: {
    name: 'Venom Sprayer', icon: '☠', color: '#a3e635', key: '6', locked: true,
    desc: 'Toxic spray deals poison damage over time. Ignores armor.',
    cost: 175,
    dmg:    [6, 10, 17, 28],
    rate:   [1.1, 1.2, 1.35, 1.55],
    range:  [2.5, 2.6, 2.7, 2.85],
    poisonDps: [11, 19, 33, 58],
    poisonDur: [3, 3, 3.5, 4],
    upcosts: [150, 310, 620],
    projSpeed: 7,
    toxicSlow: [0, 0, 0, 0.18],
    special: [null, null, null, 'Neurotoxin — poison also slows 18%'],
    variants: [
      { id: 'plague', name: 'Plaguebearer', icon: '☣', cost: 1150,
        desc: 'Enemies that die while poisoned infect nearby enemies with their poison.',
        special: 'Plague — poison spreads on death',
        stats: { dmg: 24, rate: 1.5, range: 2.9, poisonDps: 50, poisonDur: 5, toxicSlow: 0.18 },
        flags: { plague: 2.0 } },
      { id: 'corrosive', name: 'Corrosive Agent', icon: '🧪', cost: 1150,
        desc: 'Each hit permanently strips 4% armor and deals double damage to shields.',
        special: 'Corrosion — strips armor, 2× shield damage',
        stats: { dmg: 30, rate: 1.5, range: 2.9, poisonDps: 45, poisonDur: 4, toxicSlow: 0.1 },
        flags: { meltArmor: 0.04, shieldShred: 2 } },
    ],
  },
  amp: {
    name: 'Amplifier', icon: '◈', color: '#fbbf24', key: '7', locked: true, support: true,
    desc: 'Support tower. Boosts damage of nearby towers.',
    cost: 125,
    dmg:    [0, 0, 0, 0],
    rate:   [0, 0, 0, 0],
    range:  [2.3, 2.5, 2.7, 2.9],
    aura:   [0.15, 0.22, 0.30, 0.40],
    rateAura: [0, 0, 0, 0.12],
    upcosts: [110, 230, 460],
    special: [null, null, null, 'Overdrive — aura also grants +12% attack speed'],
    variants: [
      { id: 'resonance', name: 'Resonance Array', icon: '◎', cost: 900,
        desc: 'Wide-field amplifier: much larger radius, slightly weaker boost.',
        special: 'Resonance — huge 4.2-tile aura',
        stats: { range: 4.2, aura: 0.32, rateAura: 0.10 } },
      { id: 'focus', name: 'Focus Lens', icon: '◉', cost: 900,
        desc: 'Concentrated field: smaller radius but a massive +65% damage and +20% speed boost.',
        special: 'Focus — +65% damage, +20% speed in a tight field',
        stats: { range: 2.4, aura: 0.65, rateAura: 0.20 } },
    ],
  },
};
const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'sniper', 'tesla', 'venom', 'amp'];

/* ============================== ENEMIES ============================== */
/* spd in tiles/sec. cost = wave-budget points. armor = fraction of physical damage blocked.
   minWave = first wave it can appear. minDiff = 0 normal, 1 hard+, 2 nightmare only.
   heal/healR = regenerates nearby allies' HP per second / radius in tiles.
   blink/blinkCd = teleports forward N tiles every blinkCd seconds.
   brood/broodCount/broodCd = spawns children while walking. ccImmune = ignores slow/freeze. */
const ENEMIES = {
  grunt:    { name: 'Grunt',     hp: 42,  spd: 1.15, armor: 0,    reward: 6,  cost: 1,   group: 5,  gap: 0.85, r: 14, color: '#7ec850', lives: 1, minWave: 1 },
  runner:   { name: 'Runner',    hp: 30,  spd: 2.15, armor: 0,    reward: 7,  cost: 1.4, group: 6,  gap: 0.42, r: 11, color: '#ffd23f', lives: 1, minWave: 2 },
  swarm:    { name: 'Swarmling', hp: 14,  spd: 1.7,  armor: 0,    reward: 2,  cost: 0.5, group: 10, gap: 0.2,  r: 8,  color: '#c084fc', lives: 1, minWave: 4 },
  tank:     { name: 'Bulwark',   hp: 270, spd: 0.62, armor: 0.45, reward: 20, cost: 5,   group: 2,  gap: 2.1,  r: 17, color: '#94a3b8', lives: 2, minWave: 6 },
  shielded: { name: 'Aegis',     hp: 75,  spd: 1.0,  armor: 0.1,  reward: 16, cost: 3.2, group: 3,  gap: 1.05, r: 13, color: '#38bdf8', lives: 1, shield: 95, minWave: 9 },
  splitter: { name: 'Splitter',  hp: 105, spd: 0.9,  armor: 0,    reward: 14, cost: 3,   group: 3,  gap: 1.25, r: 14, color: '#fb923c', lives: 1, spawns: 'swarm', spawnCount: 3, minWave: 13 },
  // --- late-game (all difficulties) ---
  juggernaut: { name: 'Juggernaut', hp: 950, spd: 0.45, armor: 0.6, reward: 48, cost: 9, group: 1, gap: 3.4, r: 19, color: '#92400e', lives: 3, minWave: 16 },
  wraith:   { name: 'Wraith',    hp: 95,  spd: 1.85, armor: 0,    reward: 15, cost: 3.2, group: 4,  gap: 0.55, r: 12, color: '#e2e8f0', lives: 1, minWave: 18, ccImmune: true },
  // --- hard+ only ---
  mender:   { name: 'Mender',    hp: 170, spd: 0.85, armor: 0.1,  reward: 24, cost: 4.5, group: 2,  gap: 1.5,  r: 13, color: '#34d399', lives: 1, minWave: 14, minDiff: 1, heal: 22, healR: 2.3 },
  stalker:  { name: 'Phase Stalker', hp: 230, spd: 1.0, armor: 0.15, reward: 28, cost: 5.5, group: 2, gap: 1.7, r: 13, color: '#c026d3', lives: 2, minWave: 21, minDiff: 1, blink: 1.3, blinkCd: 4 },
  // --- nightmare only ---
  broodmother: { name: 'Broodmother', hp: 420, spd: 0.58, armor: 0.2, reward: 34, cost: 7, group: 1, gap: 2.6, r: 17, color: '#be185d', lives: 2, minWave: 24, minDiff: 2, brood: 'swarm', broodCount: 6, broodCd: 3 },
  boss:     { name: 'Warlord',   hp: 2200, spd: 0.5, armor: 0.3,  reward: 260, cost: 0,  group: 1,  gap: 1,    r: 22, color: '#ef4444', lives: 5, boss: true, minWave: 999 },
};

/* ============================== DIFFICULTIES ============================== */
const DIFFS = {
  normal:    { name: 'Normal',    hp: 1,    spd: 1,    mult: 1,   desc: 'The standard engagement.' },
  hard:      { name: 'Hard',      hp: 1.6,  spd: 1.06, mult: 2.2, desc: '+60% enemy HP, slightly faster. 2.2× cores.' },
  nightmare: { name: 'Nightmare', hp: 2.7,  spd: 1.14, mult: 4,   desc: '+170% enemy HP, much faster. 4× cores.' },
};
const DIFF_ORDER = ['normal', 'hard', 'nightmare'];

/* ============================== MAPS ============================== */
/* waypoints in tile coords (x,y), orthogonal segments only. First point = spawn edge. */
const MAPS = [
  {
    id: 'verdant', name: 'Verdant Crossing', mult: 1,
    desc: 'A wide S-curve through the valley. Generous build space — perfect for learning the ropes.',
    waypoints: [[-1, 2], [12, 2], [12, 8], [2, 8], [2, 10]],
    theme: { ground: '#0e1a12', ground2: '#101f16', path: '#2a3b2a', pathEdge: '#3f5a3c', deco: ['#1d3322', '#24402a', '#182b1e'] },
    unlock: null,
  },
  {
    id: 'ashen', name: 'Ashen Spiral', mult: 1.35,
    desc: 'The path coils inward toward the Core. Long exposure time rewards towers at the center.',
    waypoints: [[-1, 1], [14, 1], [14, 9], [1, 9], [1, 3], [11, 3], [11, 7], [4, 7], [4, 5]],
    theme: { ground: '#1a1214', ground2: '#1f1518', path: '#3b2a28', pathEdge: '#5a3f38', deco: ['#33221f', '#402824', '#2b1c1a'] },
    unlock: { map: 'verdant', diff: 'normal' },
  },
  {
    id: 'shattered', name: 'Shattered Isles', mult: 1.75,
    desc: 'A brutal zig-zag across broken terrain. Tight corners and short sightlines. Veterans only.',
    waypoints: [[-1, 5], [5, 5], [5, 1], [9, 1], [9, 9], [13, 9], [13, 4], [16, 4]],
    theme: { ground: '#0e1420', ground2: '#111a2a', path: '#27324a', pathEdge: '#3a4a6e', deco: ['#1a2438', '#212d47', '#151d30'] },
    unlock: { map: 'ashen', diff: 'normal' },
  },
];

/* ============================== TECH TREE ============================== */
/* b: branch (o=offense, d=defense, e=economy). x,y = canvas coords. costs[i] = cores for rank i+1. */
const TECH = [
  // --- Offense ---
  { id: 'o_dmg',   b: 'o', name: 'Sharpened Munitions', desc: '+8% tower damage per rank.', max: 3, costs: [2, 4, 8],    x: 170, y: 110, req: null },
  { id: 'o_rate',  b: 'o', name: 'Overclock',           desc: '+6% attack speed per rank.', max: 3, costs: [3, 6, 12],   x: 170, y: 215, req: { id: 'o_dmg', rank: 1 } },
  { id: 'o_crit',  b: 'o', name: 'Critical Matrix',     desc: '+5% critical chance per rank. Crits deal double damage.', max: 3, costs: [4, 8, 14], x: 170, y: 320, req: { id: 'o_dmg', rank: 1 } },
  { id: 'o_range', b: 'o', name: 'Long Scopes',         desc: '+5% tower range per rank.', max: 2, costs: [3, 7],        x: 170, y: 425, req: { id: 'o_rate', rank: 1 } },
  { id: 'o_exec',  b: 'o', name: 'Executioner',         desc: 'Towers deal +25% damage to enemies below 35% HP.', max: 1, costs: [12], x: 170, y: 520, req: { id: 'o_crit', rank: 2 } },
  { id: 'u_tesla', b: 'o', name: '⚡ Tesla Research',   desc: 'Unlock the Tesla Coil tower: chain lightning that arcs between enemies.', max: 1, costs: [15], x: 330, y: 215, req: { id: 'o_rate', rank: 2 }, unlock: 'tesla' },
  { id: 'o_dmg2',  b: 'o', name: 'Heavy Ordnance',      desc: '+10% tower damage per rank.', max: 2, costs: [10, 18],   x: 300, y: 110, req: { id: 'o_dmg', rank: 3 } },
  { id: 'o_critx', b: 'o', name: 'Lethal Precision',    desc: '+30% critical damage per rank (base 200%).', max: 2, costs: [8, 14], x: 300, y: 320, req: { id: 'o_crit', rank: 2 } },
  { id: 'o_splash', b: 'o', name: 'Volatile Payload',   desc: '+15% splash damage radius per rank.', max: 2, costs: [6, 12], x: 300, y: 425, req: { id: 'o_range', rank: 2 } },
  { id: 'o_omega', b: 'o', name: 'Omega Rounds',        desc: '+15% tower damage.', max: 1, costs: [25], x: 300, y: 520, req: { id: 'o_exec', rank: 1 } },
  // --- Defense ---
  { id: 'd_lives', b: 'd', name: 'Reinforced Core',     desc: '+4 starting lives per rank.', max: 3, costs: [2, 4, 8],   x: 460, y: 110, req: null },
  { id: 'd_repair', b: 'd', name: 'Nanite Repair',      desc: 'Restore +1 life every 5 waves per rank.', max: 2, costs: [6, 12], x: 460, y: 215, req: { id: 'd_lives', rank: 1 } },
  { id: 'd_frost', b: 'd', name: 'Cryo Engineering',    desc: 'Slow effects are 15% stronger per rank.', max: 2, costs: [4, 8], x: 460, y: 320, req: { id: 'd_lives', rank: 1 } },
  { id: 'd_last',  b: 'd', name: 'Last Stand',          desc: 'Towers within 3 tiles of the Core deal +25% damage.', max: 1, costs: [10], x: 460, y: 425, req: { id: 'd_repair', rank: 1 } },
  { id: 'u_amp',   b: 'd', name: '◈ Amplifier Research', desc: 'Unlock the Amplifier: a support tower that boosts nearby tower damage.', max: 1, costs: [15], x: 620, y: 320, req: { id: 'd_frost', rank: 1 }, unlock: 'amp' },
  { id: 'd_lives2', b: 'd', name: 'Bulwark Plating',    desc: '+6 starting lives per rank.', max: 2, costs: [8, 14],   x: 620, y: 110, req: { id: 'd_lives', rank: 3 } },
  { id: 'd_guard', b: 'd', name: 'Core Shield',         desc: 'Each wave, an energy shield absorbs the first leak per rank — no lives lost.', max: 2, costs: [10, 18], x: 620, y: 215, req: { id: 'd_repair', rank: 2 } },
  { id: 'd_endure', b: 'd', name: 'Second Wind',        desc: 'Once per run, survive a fatal blow with 1 life remaining.', max: 1, costs: [20], x: 460, y: 520, req: { id: 'd_last', rank: 1 } },
  // --- Economy ---
  { id: 'e_gold',  b: 'e', name: 'War Bonds',           desc: '+50 starting gold per rank.', max: 3, costs: [2, 4, 8],   x: 750, y: 110, req: null },
  { id: 'e_int',   b: 'e', name: 'Compound Interest',   desc: '+2% end-of-wave interest per rank.', max: 3, costs: [4, 8, 14], x: 750, y: 215, req: { id: 'e_gold', rank: 1 } },
  { id: 'e_bounty', b: 'e', name: 'Bounty Hunter',      desc: '+8% gold from kills per rank.', max: 3, costs: [3, 6, 12], x: 750, y: 320, req: { id: 'e_gold', rank: 1 } },
  { id: 'e_disc',  b: 'e', name: 'Efficient Logistics', desc: '-6% tower build & upgrade costs per rank.', max: 2, costs: [5, 10], x: 750, y: 425, req: { id: 'e_bounty', rank: 1 } },
  { id: 'e_salv',  b: 'e', name: 'Salvage Protocol',    desc: '+10% sell refund per rank.', max: 2, costs: [3, 6],       x: 750, y: 520, req: { id: 'e_bounty', rank: 1 } },
  { id: 'e_core',  b: 'e', name: 'Data Mining',         desc: '+10% cores earned per rank.', max: 3, costs: [5, 10, 20], x: 540, y: 50, req: { id: 'e_gold', rank: 2 } },
  { id: 'u_venom', b: 'e', name: '☠ Venom Research',    desc: 'Unlock the Venom Sprayer: poison damage over time that ignores armor.', max: 1, costs: [15], x: 600, y: 425, req: { id: 'e_disc', rank: 1 }, unlock: 'venom' },
  { id: 'e_gold2', b: 'e', name: 'War Treasury',        desc: '+75 starting gold per rank.', max: 2, costs: [8, 14],   x: 860, y: 110, req: { id: 'e_gold', rank: 3 } },
  { id: 'e_int2',  b: 'e', name: 'Hedge Fund',          desc: 'Raises the interest cap by +3% per rank.', max: 2, costs: [8, 14], x: 860, y: 215, req: { id: 'e_int', rank: 3 } },
  { id: 'e_early', b: 'e', name: 'Risk Dividend',       desc: '+30% early wave-call bonus per rank. Greed has a price: waves overlap.', max: 2, costs: [6, 12], x: 860, y: 320, req: { id: 'e_bounty', rank: 2 } },
  // --- Tier-5 tower specializations (unlock 2 variants per tower) ---
  { id: 's_arrow',  b: 'o', name: '➶ Arrow Spec',  desc: 'Unlock tier-5 Arrow Tower variants: Deadeye (armor-piercing bolt, +crit) and Arrow Storm (4-arrow multi-target volley).', max: 1, costs: [16], x: 390, y: 110, req: { id: 'o_dmg2', rank: 1 }, spec: 'arrow' },
  { id: 's_tesla',  b: 'o', name: '⚡ Tesla Spec',  desc: 'Unlock tier-5 Tesla Coil variants: Stormlord (14 chains, no falloff) and Overload (rapid, intensifying arcs).', max: 1, costs: [22], x: 400, y: 215, req: { id: 'u_tesla', rank: 1 }, spec: 'tesla' },
  { id: 's_sniper', b: 'o', name: '◎ Sniper Spec', desc: 'Unlock tier-5 Sniper Nest variants: Railgun (pierces all enemies in a line) and Headhunter (+80% damage to healthy targets).', max: 1, costs: [20], x: 400, y: 320, req: { id: 'o_critx', rank: 2 }, spec: 'sniper' },
  { id: 's_cannon', b: 'o', name: '💣 Cannon Spec', desc: 'Unlock tier-5 Cannon variants: Siege Mortar (huge blast, long stun) and Shrapnel Battery (rapid twin shells).', max: 1, costs: [18], x: 400, y: 425, req: { id: 'o_splash', rank: 2 }, spec: 'cannon' },
  { id: 's_frost',  b: 'd', name: '❄ Frost Spec',  desc: 'Unlock tier-5 Frost Spire variants: Glacier (area chill) and Absolute Zero (freeze + shatter damage).', max: 1, costs: [16], x: 560, y: 320, req: { id: 'd_frost', rank: 2 }, spec: 'frost' },
  { id: 's_amp',    b: 'd', name: '◈ Amp Spec',    desc: 'Unlock tier-5 Amplifier variants: Resonance (wide field) and Focus Lens (concentrated boost).', max: 1, costs: [18], x: 680, y: 320, req: { id: 'u_amp', rank: 1 }, spec: 'amp' },
  { id: 's_venom',  b: 'e', name: '☠ Venom Spec',  desc: 'Unlock tier-5 Venom Sprayer variants: Plaguebearer (poison spreads on death) and Corrosive (strips armor, shreds shields).', max: 1, costs: [20], x: 600, y: 520, req: { id: 'u_venom', rank: 1 }, spec: 'venom' },
];
const TECH_BRANCH_COLORS = { o: '#ff5a5a', d: '#4da3ff', e: '#4ade80' };

/* ============================== ACHIEVEMENTS ============================== */
/* check(s, run): s = save data, run = last-run summary (may be null on load). */
const ACHIEVEMENTS = [
  { id: 'first_blood', icon: '🩸', name: 'First Blood',     desc: 'Destroy 100 enemies (lifetime).',          reward: 5,  prog: s => [Math.min(s.stats.kills, 100), 100],    check: s => s.stats.kills >= 100 },
  { id: 'slayer',      icon: '⚔️', name: 'Slayer',          desc: 'Destroy 5,000 enemies (lifetime).',        reward: 15, buff: '+2% tower damage', prog: s => [Math.min(s.stats.kills, 5000), 5000], check: s => s.stats.kills >= 5000 },
  { id: 'genocider',   icon: '💀', name: 'Exterminator',    desc: 'Destroy 25,000 enemies (lifetime).',       reward: 40, prog: s => [Math.min(s.stats.kills, 25000), 25000], check: s => s.stats.kills >= 25000 },
  { id: 'first_win',   icon: '🏆', name: 'First Victory',   desc: 'Win any operation.',                       reward: 10, check: (s, r) => s.stats.wins >= 1 || !!(r && r.won) },
  { id: 'hard_win',    icon: '🥈', name: 'Hardened',        desc: 'Win any operation on Hard.',               reward: 25, check: (s, r) => !!MAPS.find(m => s.maps[m.id] && s.maps[m.id].hard && s.maps[m.id].hard.won) },
  { id: 'nightmare_win', icon: '😈', name: 'Nightmare Conqueror', desc: 'Win any operation on Nightmare.',    reward: 60, buff: '+3% cores earned', check: s => !!MAPS.find(m => s.maps[m.id] && s.maps[m.id].nightmare && s.maps[m.id].nightmare.won) },
  { id: 'conqueror',   icon: '🌐', name: 'World Conqueror', desc: 'Win all three operations (any difficulty).', reward: 50, check: s => MAPS.every(m => s.maps[m.id] && DIFF_ORDER.some(d => s.maps[m.id][d] && s.maps[m.id][d].won)) },
  { id: 'flawless',    icon: '💎', name: 'Flawless Defense', desc: 'Win a run with 20 or more lives remaining.', reward: 30, check: (s, r) => !!r && r.won && r.lives >= 20 },
  { id: 'rich',        icon: '💰', name: 'War Profiteer',   desc: 'Earn 5,000 gold in a single run.',         reward: 15, check: (s, r) => !!r && r.goldEarned >= 5000 },
  { id: 'tycoon',      icon: '🏦', name: 'Tycoon',          desc: 'Earn 50,000 gold (lifetime).',             reward: 25, buff: '+3% gold from kills', prog: s => [Math.min(s.stats.goldEarned, 50000), 50000], check: s => s.stats.goldEarned >= 50000 },
  { id: 'builder',     icon: '🔨', name: 'Master Builder',  desc: 'Build 300 towers (lifetime).',             reward: 15, prog: s => [Math.min(s.stats.towersBuilt, 300), 300], check: s => s.stats.towersBuilt >= 300 },
  { id: 'wave30',      icon: '🌊', name: 'Deep Waters',     desc: 'Reach wave 30.',                           reward: 10, check: (s, r) => !!r && r.bestWave >= 30 },
  { id: 'endless60',   icon: '♾️', name: 'Beyond the End',  desc: 'Clear wave 60 in Endless mode.',           reward: 40, check: (s, r) => !!r && (r.wavesCleared >= 60 || r.bestWave > 60) },
];

/* ============================== META MODIFIERS ============================== */
function MetaMods() {
  const t = SaveSys.data.tech, A = SaveSys.data.ach;
  const r = id => t[id] || 0;
  const m = {
    dmg: 1 + 0.08 * r('o_dmg'),
    rate: 1 + 0.06 * r('o_rate'),
    range: 1 + 0.05 * r('o_range'),
    crit: 0.05 * r('o_crit'),
    critDmg: 2 + 0.3 * r('o_critx'),
    exec: r('o_exec') > 0,
    splash: 1 + 0.15 * r('o_splash'),
    lives: 4 * r('d_lives') + 6 * r('d_lives2'),
    repair: r('d_repair'),
    frost: 1 + 0.15 * r('d_frost'),
    lastStand: r('d_last') > 0,
    coreShield: r('d_guard'),
    secondWind: r('d_endure') > 0,
    startGold: 50 * r('e_gold') + 75 * r('e_gold2'),
    interest: 0.05 + 0.02 * r('e_int'),
    interestCap: 0.25 + 0.03 * r('e_int2'),
    bounty: 1 + 0.08 * r('e_bounty'),
    discount: Math.max(0.5, 1 - 0.06 * r('e_disc')),
    salvage: 0.7 + 0.1 * r('e_salv'),
    earlyBonus: 1 + 0.3 * r('e_early'),
    coreGain: (1 + 0.1 * r('e_core')) * (1 + 0.01 * (SaveSys.data.level - 1)),
    unlocks: { tesla: r('u_tesla') > 0, venom: r('u_venom') > 0, amp: r('u_amp') > 0 },
    specs: {
      arrow: r('s_arrow') > 0, cannon: r('s_cannon') > 0, frost: r('s_frost') > 0,
      sniper: r('s_sniper') > 0, tesla: r('s_tesla') > 0, venom: r('s_venom') > 0, amp: r('s_amp') > 0,
    },
  };
  m.dmg *= 1 + 0.1 * r('o_dmg2');
  if (r('o_omega') > 0) m.dmg *= 1.15;
  if (A.slayer) m.dmg *= 1.02;
  if (A.nightmare_win) m.coreGain *= 1.03;
  if (A.tycoon) m.bounty *= 1.03;
  return m;
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
