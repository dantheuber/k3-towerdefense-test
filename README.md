# COREFALL — Tower Defense Protocol

A complete browser tower defense game with deep meta progression. Zero dependencies, zero build step.

## Run it

Open `index.html` in any modern browser. That's it.

## The Game

Defend your **Core** against 40 waves of enemies across three operations. Kills earn gold; gold builds towers; towers buy you time. Lose all your lives and the Core falls — but you keep everything you earned.

### Towers (7)
| Tower | Role | Max-level perk |
|---|---|---|
| ➶ Arrow | Rapid single-target | Twin Shot |
| 💣 Cannon | Splash damage | Concussion stun |
| ❄ Frost Spire | Slows enemies | Deep Freeze chance |
| ◎ Sniper Nest | Long-range burst | AP rounds ignore armor |
| ⚡ Tesla Coil 🔒 | Chain lightning | Superconductor chains |
| ☠ Venom Sprayer 🔒 | Poison DoT (ignores armor) | Neurotoxin slow |
| ◈ Amplifier 🔒 | Buffs nearby towers | Overdrive rate aura |

All towers have 4 levels, targeting modes (first/last/strong/weak), and sell-back.

### Enemies (7)
Grunts, fast Runners, Swarmlings, armored Bulwarks, shielded Aegis units, Splitters that burst into swarmlings, and boss **Warlords** every 10 waves.

### Systems
- **Interest economy** — unspent gold earns interest each wave; greed is a valid strategy
- **Early wave calls** — summon the next wave early for bonus gold
- **3 maps** with distinct path geometry (S-curve, spiral, zig-zag), unlocked by victories
- **3 difficulties** per map (Normal / Hard / Nightmare) with core multipliers up to 4×
- **Endless mode** after victory for leaderboard-chasing

## Meta Progression (persists in localStorage)

- **⬢ Cores** — earned every run, win or lose; harder content pays more
- **Tech tree** — 17 nodes across Offense / Defense / Economy branches: damage, crit, attack speed, lives, nanite repair, interest rate, bounties, discounts, plus three unlockable towers
- **13 achievements** — several grant permanent account-wide buffs
- **Player ranks** — XP levels give +1% cores per level, forever
- **Lifetime stats** — kills, gold earned, towers built, per-map records

## Controls

`1–7` select tower · click to place/select · right-click/`Esc` cancel · `Space` next wave · `F` speed (1×/2×/3×) · `P` pause · `M` mute

## Development

- `test/sim.js` — headless logic test suite (`node test/sim.js`)
- `test/balance.js` — auto-player balance simulation across maps/difficulties (`node test/balance.js`)
# k3-towerdefense-test
