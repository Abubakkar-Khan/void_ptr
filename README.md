# VOID\* PTR

VOID\* PTR is a ten-minute, twin-stick ASCII survival shooter. You pilot a living process through a hostile mainframe, build an evolving weapon, fight a bounded cellular ecosystem, and destroy three staged bosses before the clock runs out.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Arrow keys | Aim and fire manually |
| Mouse hold | Aim and fire toward the pointer |
| Space | Dash |
| Escape / P | Pause |
| Keyboard arrows or WASD + Enter | Navigate menus |
| Gamepad left stick | Move |
| Gamepad right stick | Aim and fire |
| Gamepad A / south button | Dash or confirm |
| Touch controls | Twin-stick movement and aiming; dash control |
| F1 | Toggle diagnostics |

Weapons never fire by themselves. Manual aim gets restrained correction toward the nearest target inside a 32-degree cone; seekers retain their own stronger homing after launch.

## Run structure

- Standard mode lasts ten minutes. Bosses arrive around 2:30, 5:30, and 9:00.
- The final boss must be defeated to win. A living final boss pushes the run into overtime.
- Endless mode keeps raising the threat tier without declaring victory.
- Upgrade selection pauses combat and begins with no card selected.
- XP is preserved, pulled from a wide radius, and vacuumed after a boss defeat.

## Combat

The three starting weapons are the rapid Blaster, splash-damage Seeker pods, and a piercing heat-managed Laser. Ordinary enemies are designed to die quickly; pressure comes from formations, ranged lanes, parasites, elites, and boss phase changes rather than inflated health.

Each hull has a distance-driven dash:

- Runner: 20 cells
- Daemon: 17 cells
- Cutter: 23 cells

Dashes last eight frames, ignore terrain slowdown, break destructible glyph barriers, and retain invulnerability briefly after movement ends.

## Living ecosystem

The arena contains a persistent, population-capped cellular simulation alongside the normal enemy director:

- **Spores** seek nutrients, attach to colonies, or infect eligible enemies.
- **Colony cells** grow connected structures with cellular-automata survival rules.
- **Parasites** merge with a host, increasing its speed and health. Killing that host releases spores.
- **Amalgams** emerge from dense colonies, consume weak organisms, and divide after feeding.

Enemy deaths leave temporary nutrient residue. Colonies spread into a bounded terrain layer with sector-specific anatomy: STACK roots, HEAP tangles, NULL spores, and KERNEL nodes. Dense growth visibly slows movement, intercepts shots, and can be cut apart by dashing. Collapsed ecosystems are reseeded from map edges, while blooms, migrations, collisions, predator events, and die-offs keep the arena alive without burying combat.

## Synthetic species

Every organism receives a stable seeded genome and a bounded cellular field rather than a fixed outline. Its occupied cells continuously grow, collapse, split, and change glyphs while the family's alphabet and motion remain recognizable. Skitters flank, Bloomcasters swell before firing, Ribbons herd, Prisms divide, Burst Sacs contract toward rupture, and Rootweavers pulse protection without drawing connector lines.

Hits are assigned to nearby functional organs. Damaged legs limp, blinded senses spoil aim, ruptured attack glands stop firing, cracked shells expose cores, and severed signal organs disconnect packs. Badly wounded compatible organisms can fuse into a single inherited Amalgam without duplicating kills or XP.

Species learn during a run. Sustained bullet, laser, splash, dash, or electric pressure produces visible counter-organs with a matching weakness; adaptations are capped and never grant immunity. NULL SERPENT, THE WATCHER, and HEAP CARRIER use the same wound language for molting vertebrae, sensory lobes, gestation bays, carapace, and exposed hearts.

## Statistics and records

Every run tracks kills by species, boss kills, damage dealt and taken, XP, levels, upgrades, shots, hits, dashes, distance travelled, combo, score, survival time, and ecosystem outcomes.

The results screen groups these into combat, progression, movement, and ecosystem sections. The Records screen stores versioned local lifetime totals and per-hull high scores under `voidptr_stats_v1`. No account or network service is used, and malformed old data is recovered safely.

## ASCII presentation

- JetBrains Mono Medium is used for the world, headings, menus, HUD, cards, and numeric values with ligatures disabled.
- Gameplay uses a strict cyan/lime player, red/magenta enemy, amber hostile projectile, and blue XP palette.
- Menus, upgrade cards, pause, records, HUD, results, warning lanes, lightning, and impact effects are made entirely from terminal glyphs.
- ASCII panels adapt across desktop, tablet, and narrow-phone grids. Narrow upgrade screens page between full cards rather than clipping them.
- Cards do not highlight until pointer or navigation input occurs; selection uses terminal borders and `> markers <`.

## Development

```powershell
npm install
npm run dev
```

Verification:

```powershell
npm test
npm run build
npm run check
```
