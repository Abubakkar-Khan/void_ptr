# VOID\* PTR

> A ten-minute, manual-aim ASCII survival shooter set inside a living, corrupted mainframe.

VOID\* PTR combines twin-stick combat, roguelite upgrades, procedural synthetic organisms, cellular automata, functional enemy wounds, coordinated pack behavior, and multi-phase organic bosses. Everything visible—including menus, cards, HUD elements, controls, telegraphs, enemies, effects, and environmental life—is rendered with monospaced terminal glyphs.

This document describes the game as currently implemented, including its rules, systems, controls, presentation, persistence, mobile behavior, architecture, and development workflow.

## Contents

- [Game concept](#game-concept)
- [Run structure](#run-structure)
- [Controls](#controls)
- [Player hulls](#player-hulls)
- [Weapons and aiming](#weapons-and-aiming)
- [Dash system](#dash-system)
- [Progression and upgrades](#progression-and-upgrades)
- [Enemies and organic species](#enemies-and-organic-species)
- [Functional wounds](#functional-wounds)
- [Collective intelligence and fusion](#collective-intelligence-and-fusion)
- [Run evolution](#run-evolution)
- [Living ecosystem](#living-ecosystem)
- [Boss encounters](#boss-encounters)
- [Difficulty director](#difficulty-director)
- [Experience pickups](#experience-pickups)
- [Statistics and records](#statistics-and-records)
- [ASCII presentation and interface](#ascii-presentation-and-interface)
- [Mobile and PWA behavior](#mobile-and-pwa-behavior)
- [Audio](#audio)
- [Technical architecture](#technical-architecture)
- [Local storage](#local-storage)
- [Development](#development)
- [Testing](#testing)

## Game concept

The player pilots an executable hull through a hostile memory space. Enemies are not fixed sprites: they are seeded organic glitch fields that continuously contract, divide, shed cells, and change glyphs. Their family remains readable through its character alphabet, density, rhythm, movement, and attacks rather than a rigid face or outline.

The core loop is:

1. Move through the arena and manually aim at threats.
2. Kill organisms and collect blue memory/XP fragments.
3. Pause combat at level-up and install one applicable module.
4. Adapt to coordinated species, infections, environmental growth, and mutations.
5. Defeat three staged bosses before completing the standard run.

Combat is intended to feel powerful without becoming automatic. Basic enemies die quickly, while challenge comes from population pressure, positioning, projectile lanes, symbiosis, pack tactics, wounded behavior, evolved generations, and boss organs.

## Run structure

### Ten-minute mode

The primary mode lasts ten minutes, with bosses scheduled at approximately:

| Time | Boss |
| --- | --- |
| `02:30` | NULL SERPENT |
| `05:30` | THE WATCHER |
| `09:00` | HEAP CARRIER |

Defeating a boss creates a short recovery window and vacuums all remaining XP. The clock reaching ten minutes does not automatically end the run: if the final boss is alive, the game enters overtime. Victory is awarded only after HEAP CARRIER is destroyed.

### Endless mode

Endless mode removes the victory condition. Encounter pressure and threat tiers continue rising while the director cycles through increasingly dangerous populations.

### Game states

The engine uses explicit states for boot, title menu, hull selection, active play, upgrade selection, pause, settings, mobile guide, records, victory, and game over. Combat simulation stops during upgrades, pause screens, mobile instructions, and portrait-orientation blocking.

## Controls

### Keyboard and mouse

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Arrow keys | Aim and fire |
| Hold mouse button | Aim and fire toward pointer |
| `Space` | Dash |
| `Escape` or `P` | Pause/resume or go back |
| Arrows/WASD + `Enter` | Navigate and confirm menu choices |
| `F1` | Toggle diagnostic counters |

### Gamepad

| Input | Action |
| --- | --- |
| Left stick | Move |
| Right stick | Aim and fire |
| South/A button | Dash or confirm |
| Directional input | Navigate menus |

### Touch

- The first touch in the left gameplay zone creates a floating `MOVE` stick under that finger.
- The first touch in the right gameplay zone creates an `AIM + FIRE` stick.
- Releasing a stick immediately clears its input.
- The ASCII dash button sits beside and slightly above the attack zone for right-thumb access.
- Move, aim/fire, and dash support simultaneous touches.
- Dash input takes priority over creating the firing stick.

Weapons never fire without active keyboard, mouse, gamepad, or touch firing input.

## Player hulls

Each hull has a distinct health, movement profile, starting weapon, and dash distance.

| Hull | HP | Speed | Dash | Weapon | Play style |
| --- | ---: | ---: | ---: | --- | --- |
| `THREAD.RUNNER` | 12 | 1.10 | 20 cells | Auto-Blaster | Balanced movement, reliable recovery, direct fire |
| `DAEMON.POD` | 15 | 0.94 | 17 cells | Seeker Pods | Durable target control and splash damage |
| `PTR.CUTTER` | 9 | 1.22 | 23 cells | Null Laser | Fragile, fast, line-based piercing damage |

Hull acceleration is also distinct, so the three ships differ in responsiveness rather than only maximum speed.

## Weapons and aiming

Firing is completely manual. A restrained correction system helps a deliberate shot connect without selecting targets or firing for the player:

- Assist radius: 32 cells.
- Assist cone: 32 degrees around the current aim direction.
- Steering strength: 22%.
- Only the nearest valid target inside that cone is considered.
- Projectile hitboxes are 125% of their base projectile bounds.
- Enemy contact-damage bounds remain separate and smaller than visual anatomy.

### Auto-Blaster

- 10 base damage.
- 16-tick base cooldown.
- Fast linear projectile speed.
- Damage grows by 3 per weapon level.
- Final damage milestone evolves into piercing rounds.

Despite its internal identifier, “Auto-Blaster” does not auto-fire; the name refers to its rapid repeating mechanism while fire input is held.

### Seeker Pods

- 16 direct base damage.
- Six-cell blast radius.
- Splash damage uses 80% of direct damage.
- Damage grows by 5 per weapon level.
- Projectiles retain homing after the player launches them.
- Final damage milestone evolves into a larger nova payload.

### Null Laser

- 11 base piercing damage.
- Instant ray with a 90-cell range.
- Heat-based firing: 15 heat per shot and 100 maximum heat.
- Damage grows by 3.5 per weapon level.
- Can gain a barrier reflection through Pointer Arithmetic.
- Final damage milestone evolves into Cold Overdrive.

## Dash system

Dash movement is distance-driven rather than dependent on ordinary walking speed. Each dash:

- Lasts eight frames.
- Uses full velocity for six frames and a two-frame falloff.
- Travels the hull’s advertised distance.
- Ignores terrain slowdown.
- Uses swept substeps to reduce tunnelling through targets and boundaries.
- Breaks destructible glyph barriers and dense organic terrain.
- Extends invulnerability for six frames after dash movement ends.
- Applies dash damage no more than once to each target per dash.

Dash direction falls back in this order: current movement input, active aim direction, then last facing direction.

## Progression and upgrades

XP begins at a requirement of 90 and scales by `1.36×` per level. When the threshold is crossed, combat pauses and the player receives three upgrade choices plus one reroll. L1 Cache Overclock increases future selections to four choices.

Upgrade rules:

- No card begins highlighted.
- Pointer hover activates only the card under the pointer.
- Keyboard/gamepad focus appears only after navigation input.
- Maxed modules are removed from the pool.
- Weapon-specific modules are offered only to compatible weapons.
- Repair appears only when the player is damaged.
- Dependent modules, such as Stack Canary, require their prerequisite.
- Multiple level-ups earned from one large XP award are queued rather than lost.

### Module families

| Category | Examples | Effect |
| --- | --- | --- |
| Weapon | Multi-Thread, Turbo Boost, weapon amplifiers | More streams, faster firing, higher damage, evolutions |
| Mobility | Overclock, Dash Corruption, Segfault Trail | Speed and offensive dashing |
| Defense | Shield Matrix, Stack Canary, Stack Flush | Hit blocking and projectile control |
| Autonomous | Helper Daemon, Tesla Overload | Supporting homing fire and nearby chain damage |
| Control | System Freeze | Periodically freezes standard threats |
| Utility | Garbage Collector, L1 Cache Overclock | Pickup range and extra card choice |
| Core/Panic | Kernel Overclock, Swap Partition | Base mobility or emergency repair/clear |
| Chaos | Undefined Behavior, Memory Leak | Strong unstable mutations and risk/reward XP |

Cards show their category, level, current value, next value, concise description, evolution information, and controls. Layout height is measured from wrapped content before cards are placed.

## Enemies and organic species

Normal enemies are assembled from seeded cellular fields rather than static ASCII drawings. A genome determines family, organs, symmetry, density, glyph alphabet, movement traits, social behavior, mutations, and animation rhythm. A creature keeps its seed for its entire lifetime, making its change deterministic rather than visual noise.

| Family | Glyph language | Identity and behavior |
| --- | --- | --- |
| Skitter/Drone | `' ~ -` | Sparse, asymmetric crawlers that mark, flank, and lunge |
| Bloomcaster/Shooter | `* : %` | Swells projectile sacs before firing from behind protection |
| Ribbon/Worm | `~ = .` | Flowing articulated chains that bend, reform, and herd the player |
| Prism/Virus | `+ : x` | Crystalline automata with controlled division behavior |
| Carapace/Brute | `# % ;` | Dense armored mass that exposes soft tissue when cracked |
| Burst Sac/Kamikaze | `! * :` | Contracts through a readable countdown and ruptures outward |
| Rootweaver/Projector | `| : Y` | Slow support organism that anchors formations and pulses protection |

Every family uses a bounded precomputed animation cycle. Transparent gaps, changing edges, protrusions, contraction, division, and decay make bodies feel alive while preserving family readability. There are no long connector lines between cooperating enemies.

## Functional wounds

Damage events include source, impact position, direction, damage type, and force. Hits are assigned to a nearby eligible organ, allowing anatomy to affect behavior without requiring per-glyph precision aiming.

Organs can be healthy, wounded, ruptured, or severed. Consequences include:

- Damaged locomotion produces limping, turning bias, or retreat.
- Ruptured attack sacs interrupt firing and may leak hazardous spores.
- Broken sensory organs reduce accuracy and coordination range.
- Cracked shells expose vulnerable cores.
- Severed social organs disconnect an organism from pack behavior.
- Core wounds trigger panic, aggression, mutation, retreat, or fusion attempts.

Wounds appear as missing cells, corrupted glyph regions, changing pulse rates, leaks, contraction, and displaced anatomy. Damage does not add hidden durability; breaking useful organs is intended to reward sustained accurate fire.

Death is family-dependent and may collapse, dissolve, rupture, divide, desiccate, or break into temporary organisms.

## Collective intelligence and fusion

The Colony Mind system uses staggered spatial queries rather than scanning every enemy for every creature. Nearby compatible organisms exchange short visible signals and take roles such as scout, flanker, anchor, feeder, protector, or retreating carrier.

Examples of coordinated behavior:

- Skitters circle before synchronized lunges.
- Bloomcasters shelter behind Carapaces and alternate firing cycles.
- Rootweavers reinforce allies and replace broken formation roles.
- Ribbons steer the player toward dangerous terrain.
- Parasites seek wounded or strategically valuable hosts.
- Injured organisms seek nutrients, protection, cover, or fusion partners.

Some groups form temporary symbiotic formations while remaining separate targets. Rare permanent fusion consumes compatible, energized, or severely wounded participants exactly once and creates an elite organism inheriting surviving traits. Consumed participants do not duplicate kills, XP, or statistics. Destroying a linking/social organ can interrupt a formation before fusion completes.

## Run evolution

The Evolution Director records how each family is being killed: bullets, laser, splash, dash, electricity, contact, or environmental damage. It evaluates a family after sufficient deaths and elapsed time, then applies no more than three adaptations to that family during a run.

Adaptations are visible, modest, and always include a tradeoff:

- Bullet pressure may add angled shell plates but reduce turning speed.
- Laser pressure may create reflective membrane gaps while exposing a larger open core.
- Splash pressure may spread organisms apart while weakening pack links.
- Dash pressure may grow anchoring roots while reducing pursuit speed.
- Electrical pressure may add insulation sacs that rupture into conductive residue.

Adaptations never grant immunity and are capped at approximately 20% effective durability. New generations visibly inherit the altered anatomy.

## Living ecosystem

The combat arena also hosts a persistent sparse cellular simulation. It uses a two-cell lattice, spatial hashing, staggered ten-frame updates, and separate population budgets to prevent unbounded growth.

### Life cycle

- **Spore:** a one-cell wanderer that seeks nutrient residue, colonies, or eligible hosts.
- **Colony Cell:** connected terrain life using B3/S23-inspired birth and survival behavior.
- **Parasite:** merges with a normal enemy, increasing host speed by 20% and health by 25%; host death releases spores.
- **Amalgam:** emerges after a dense colony consumes connected cells, hunts the player, feeds, and can divide after reaching an energy threshold.

Enemy deaths leave short-lived nutrient residue. Nutrients are subdued green and use a separate glyph/color language from blue XP, preventing them from looking like stuck pickups.

### Terrain interaction

Colonies are part of the environment rather than a decorative overlay. They:

- Grow around solid terrain and across destroyed barriers.
- Consume nutrients to reproduce.
- Form visible local connections without drawing enemy-to-enemy lines.
- Mildly slow movement when visibly dense.
- Can obstruct projectiles when sufficiently dense.
- Are destroyed by a dash passing through them.
- Reseed from map edges every 45 seconds if the ecology collapses.

Sector anatomy changes the visual grammar:

- `STACK`: vertical roots and bracket-like cells.
- `HEAP`: dense tangled tissue.
- `NULL`: sparse drifting spores.
- `KERNEL`: symmetrical armored colonies.

Authored ecological events include blooms, parasitic migrations, colony collisions, dormant patches awakening, predator emergence, and localized die-offs. Global population and terrain caps keep ecology subordinate to combat readability.

## Boss encounters

Bosses use large authored concepts combined with procedural organic fields, functional organs, wounds, transformations, entrance sequences, boss bars, and multi-stage deaths.

### NULL SERPENT

A connected living chain of deforming vertebral clusters. Locomotion and attack signals contract down the body. The Serpent coils, herds, performs body-blocking passes, fires aimed fans, charges through directional telegraphs, and consumes nearby growth. Damaged segments scar, rupture, or detach as short-lived organisms. Later phases shed damaged length in exchange for speed and expose additional sensory weak points.

### THE WATCHER

A floating sensory colony built from a tracking core, pupil lobes, nerve roots, cilia, and immature orbiting eyes. It uses scanning lanes, locking gaze attacks, and iris bursts with readable gaps—there are no black-hole mechanics. Damaging sensory organs creates blind sectors and less accurate attacks. Later phases fracture the eye into asymmetric cooperating lobes that alternate shared and independent vision.

### HEAP CARRIER

A synthetic brood fortress made from carapace, gestation bays, feeding tendrils, propulsion cilia, attack glands, and a protected heart. Bays visibly grow offspring and can be damaged to alter or cancel births. The Carrier deploys coordinated broods, consumes damaged allies for repair, sheds armor, ruptures bays, exposes its heart, and fuses nearby organisms into emergency replacement organs.

Boss transitions are expressed through organ failure, molting, fragmentation, division, and regrowth—not a generic speed multiplier. Death proceeds organ by organ before the body collapses into nutrients and the reward vacuum begins.

## Difficulty director

Difficulty is driven by encounter composition and spatial pressure instead of universal health inflation.

- Normal enemy population cap: 60.
- Cellular combatant cap: 28.
- Cellular terrain cap: 240.
- Threat budget rises throughout the run.
- Enemy mixes combine pursuit, ranged fire, shielding, formations, infection, and ecosystem pressure.
- Enemy projectile pace increases later in the run while preserving directional warnings.
- Boss phase two increases attack pressure modestly rather than multiplying health.
- Ordinary targets are generally intended to die in one to three solid hits; Brutes, elites, evolved organisms, and bosses provide durability.

The director pauses major spawning during recovery windows and recognizes overtime/final-boss state explicitly.

## Experience pickups

XP fragments use the blue pickup palette and are distinct from green nutrients.

- Base magnet radius: 28 cells.
- Garbage Collector adds seven cells per level.
- Pickup attraction accelerates as fragments approach the player.
- Collection distance is recalculated after magnetic movement.
- A pickup enters an explicit collected state and is removed immediately.
- Overlapping fragments award their values exactly once.
- Uncollected XP remains in the arena.
- Boss vacuum directly awards all remaining fragments, then clears the pickup collection.
- Large awards can queue several level-up screens.

The XP bar is always placed at the bottom of the gameplay HUD.

## Statistics and records

The central statistics tracker receives combat, movement, pickup, progression, dash, and ecosystem events once at their source. Internally it tracks:

- Total and per-species kills.
- Boss kills.
- Damage dealt and taken.
- XP collected and levels gained.
- Selected upgrades.
- Shots fired and hit events.
- Dashes and distance travelled.
- Maximum combo and score.
- Survival time.
- Colonies destroyed, parasites removed, and Amalgams killed.

The game-over/victory interface intentionally presents a smaller, readable summary rather than dumping every diagnostic statistic. The Records screen stores lifetime runs, wins, kills, damage, playtime, bosses defeated, high score, highest level, longest survival, largest combo, and per-hull best scores.

Records are local-only. There is no account, server, telemetry service, or online leaderboard.

## ASCII presentation and interface

The renderer is a glyph-cell compositor over a single canvas. It separates world scale from UI layout so the arena remains readable while menus can reserve enough grid rows for content.

### Visual language

| Element | Primary palette |
| --- | --- |
| Player | Cyan/white |
| Player attacks | Lime/cyan |
| Enemies | Red/magenta |
| Hostile projectiles | Amber |
| XP | Blue |
| Environmental life | Subdued green |
| Bosses/warnings | Bright red with restrained emphasis |

The game permits ASCII, terminal box-drawing, and block glyphs. It does not use bitmap sprites, conventional card rectangles, circular auras, or proportional UI text. Telegraphs are rendered as glyph lanes, arrows, blinking organs, countdown symbols, and directional markers.

### Menus and cards

- The full `VOID* PTR` ASCII banner is used on desktop and mobile landscape.
- Ship, upgrade, pause, settings, records, guide, victory, and game-over screens are grid-stamped.
- No item is selected when a screen opens (`focusIndex = -1`).
- Cards calculate wrapped title, values, description, evolution text, padding, and footer space before choosing their height.
- Wide screens can use multi-column layouts.
- Short or narrow landscape screens show one complete paged card instead of clipping content.
- Selection is shown through brighter terminal borders and restrained markers, never a permanent circle or filled graphical card.
- The HUD focuses on health, timer, level/XP, weapon state, dash state, threat, and boss phase.
- Damage numbers are intentionally hidden to reduce clutter.

JetBrains Mono Medium is the intended typeface for world glyphs, headings, UI, and numeric values. Font ligatures are disabled so character-cell anatomy remains stable.

## Mobile and PWA behavior

Mobile play is designed around landscape orientation.

### Orientation gate

Touch devices in portrait show a dedicated ASCII `ROTATE DEVICE` screen. Gameplay and menu/card input are blocked behind the gate. Rotating to portrait during a run automatically pauses simulation; returning to landscape restores the previous playable state.

The game does not force browser orientation through JavaScript. Installed PWA mode retains the landscape orientation declaration in `manifest.webmanifest`.

### Fullscreen behavior

On the first touch in landscape, the game requests browser fullscreen and then continues processing the tapped action. Rejection or lack of API support does not block play.

Browser chrome behavior is platform-dependent. Installed PWA mode is the reliable URL-bar-free experience, especially on iOS, where ordinary Safari pages cannot guarantee true automatic fullscreen.

### Viewport handling

- Uses `100dvh` where supported.
- Reads `visualViewport` dimensions.
- Responds to resize, orientation, and fullscreen changes.
- Accounts for safe-area insets and notches.
- Prevents overscroll and accidental page movement.
- Scales world glyphs and UI layout independently.
- Includes regression coverage for `568×320`, `667×375`, and `740×360` landscape viewports.

### First-run guide

The first mobile run opens a paused ASCII guide explaining movement, aim/fire, dash, XP, and upgrades. Dismissal is remembered locally. The guide can be reopened through `CONTROLS` in the pause menu.

## Background matrix and hidden words

The background contains dim Matrix-style rain plus deliberately placed vocabulary. Word placement tracks occupied cells to reduce overlap and character piles.

- Roughly 90–120 ordinary words are placed per generated world.
- Vocabulary includes system, memory, corruption, and biological terms such as `memory`, `signal`, `kernel`, `spawn`, `cell`, `grow`, `sleep`, `wake`, `ghost`, `error`, and `void`.
- 24–32 kinship words are placed from `father`, `papa`, `abu`, `dad`, `baba`, `abba`, `padre`, `pater`, `apa`, and `tata`.
- Words can be horizontal or vertical.
- They remain lowercase, stationary, and behind gameplay/UI.
- Kinship words are slightly brighter than ordinary rain but remain dimmer than threats, attacks, and XP.

## Audio

Audio is synthesized and managed locally. Music and sound effects have independent persistent toggles. Music intensity responds to threat tier and active boss state rather than remaining static. Browser audio begins only after interaction, following normal autoplay restrictions.

## Technical architecture

The project uses modern browser JavaScript modules and Vite. Gameplay updates run at a fixed 60 Hz using an accumulator, while rendering adapts to the browser viewport.

| Module | Responsibility |
| --- | --- |
| `main.js` | Game state machine, fixed-step loop, system orchestration |
| `config.js` | Central hull, weapon, enemy, combat, progression, and boss values |
| `renderer.js` | Glyph grids, viewport scaling, camera, cell composition |
| `ui.js` | Entire ASCII HUD/menu/card/results presentation and hit regions |
| `input.js` | Keyboard, mouse, gamepad, mobile state, fullscreen, floating sticks |
| `player.js` | Hull movement, health, dash state, installed modules |
| `weapons.js` | Blaster, Seeker, Laser, helper attacks, projectile behavior |
| `enemies.js` | Enemy entities, combat behavior, boss state and attacks |
| `biology.js` | Genomes, body plans, organic fields, organs, wounds |
| `colonyMind.js` | Bounded neighbor queries, packs, signals, formations, fusion |
| `evolution.js` | Damage-pressure tracking and per-run species adaptations |
| `ecosystem.js` | Cellular lattice, nutrients, terrain growth, parasites, events |
| `waves.js` | Threat budget, populations, boss schedule, recovery, victory logic |
| `collision.js` | Projectile, contact, pickup, terrain, and dash collision routing |
| `pickups.js` | XP attraction, collection state, cleanup, boss vacuum |
| `stats.js` | Run metrics, summaries, lifetime record persistence |
| `matrixRain.js` | Background rain and occupied-cell word placement |
| `effects.js` | Glyph-based impacts, warnings, trails, and transient effects |
| `audio.js` | Synthesized music/SFX and persistent audio settings |
| `upgrades.js` | Upgrade catalog, applicability, weights, values, display metadata |

### Performance boundaries

The living systems are explicitly bounded:

- Organic animation cycles are generated per stable seed and cached.
- Ecosystem updates are staggered.
- Neighbor and pack searches use spatial hashing.
- Cellular combatants and terrain have separate hard caps.
- Fusion reserves/removes participants safely.
- Render fields have bounded local dimensions.
- The game avoids quadratic full-population scans in per-creature behavior.

## Local storage

| Key | Purpose |
| --- | --- |
| `voidptr_stats_v1` | Versioned lifetime records and per-hull bests |
| `voidptr_mobile_guide_v1` | First-run mobile control-guide dismissal |
| `voidptr_music` | Music enabled/disabled |
| `voidptr_sfx` | Sound effects enabled/disabled |

Missing or malformed statistics data falls back to a valid default record. No gameplay data leaves the device.

## Development

### Requirements

- A current Node.js release.
- npm.
- A modern browser with Canvas and ES module support.

### Install and run

```powershell
npm install
npm run dev
```

Vite prints the local development URL. Open it in a desktop browser or through a device on the same development network when the server is exposed to that network.

### Production build

```powershell
npm run build
```

The optimized site is written to `dist/`.

### Preview the production build

```powershell
npm run preview
```

## Testing

Run the automated gameplay and renderer regression suite:

```powershell
npm test
```

Run the production build and complete test suite together:

```powershell
npm run check
```

Coverage includes:

- Finite-run overtime and Endless behavior.
- Boss scheduling, phases, recovery windows, organs, and deaths.
- Manual-only firing and aim-assist constraints.
- Weapon compatibility and upgrade selection.
- Multi-level XP queues and pickup cleanup.
- Dash distance and once-per-target damage.
- Ecosystem growth, parasites, terrain interaction, and population caps.
- Seeded organic field reproducibility.
- Functional organ wounds and behavior changes.
- Colony intelligence, signal breaking, and fusion accounting.
- Evolution pressure, adaptation limits, and tradeoffs.
- ASCII-only UI rendering and no default focus.
- Lifetime-record recovery from malformed storage.
- Floating touch-stick clamping, deadzones, and reset behavior.
- Full mobile title, card pagination, orientation gate, and compact viewport bounds.
- Background word counts, brightness, and bounded placement.

## Design principles

1. **Manual intent matters.** Aim assistance can refine a shot but never creates one.
2. **Read behavior, not health bars.** Difficulty comes from coordination, anatomy, and pressure.
3. **ASCII is the medium.** Interface and world obey the same glyph-based visual language.
4. **Organisms remain identifiable without becoming static icons.** Glyph language and movement define a family.
5. **Every wound should mean something.** Visual damage changes combat capability.
6. **Living systems must stay bounded.** Ecology and procedural animation cannot overwhelm readability or performance.
7. **Mobile is a first-class layout.** It uses the complete terminal identity rather than a reduced graphical replacement.
