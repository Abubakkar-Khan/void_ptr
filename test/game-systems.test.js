import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Director } from '../src/waves.js';
import { Player } from '../src/player.js';
import { upgrades } from '../src/upgrades.js';
import { BOSS_SCHEDULE_TICKS, COMBAT_CONFIG, ECOSYSTEM_TYPES, ENEMY_DEFS, PALETTE, PROGRESSION_CONFIG, WEAPON_DEFS } from '../src/config.js';
import { Enemy, enemies } from '../src/enemies.js';
import { EcosystemSystem } from '../src/ecosystem.js';
import { StatsTracker } from '../src/stats.js';
import { UIManager } from '../src/ui.js';
import { resolveAssistedAim, weapons } from '../src/weapons.js';
import { Genome, ORGANIC_FIELD_PROFILES, OrganState, renderCreatureBody, SpeciesFamily } from '../src/biology.js';
import { EvolutionDirector } from '../src/evolution.js';
import { ColonyMindSystem } from '../src/colonyMind.js';
import { MemoryPickup, PickupSystem } from '../src/pickups.js';
import { BACKGROUND_WORD_CONFIG, MatrixRain } from '../src/matrixRain.js';
import { FloatingStick } from '../src/input.js';

const makeUpgradePlayer = (weaponType) => ({
    weaponType,
    hp: 6,
    maxHp: 12,
    hasHelperDrones: 0,
    hasElectricDischarge: 0,
    shieldLevel: 0,
    freezeLevel: 0,
    bombLevel: 0,
    dashDmgLevel: 0,
    upgrades: {
        extraThreads: 0,
        speedBoost: 0,
        fireRateBoost: 0,
        cacheOverclock: 0,
        kernelOverclock: 0,
        swapPartition: 0,
        blasterDmg: 0,
        seekerDmg: 0,
        laserDmg: 0,
        garbageCollector: 0,
        stackCanary: 0,
        segfault: 0,
        pointerArithmetic: 0,
        undefinedBehavior: 0,
        forkBomb: 0
    }
});

test('Endless mode uses elapsed threat tiers and never declares victory', () => {
    const director = new Director();
    director.reset(999);
    director.startGame();
    director.timeElapsed = 60 * 60 * 5;
    assert.equal(director.threatTier, 6);
    assert.equal(director.isVictory(), false);
    assert.match(director.getTimeRemainingFormatted(), /^∞ 05:00$/);
});

test('finite runs enter overtime until the final boss is defeated', () => {
    const director = new Director();
    director.reset(10);
    director.startGame();
    director.timeElapsed = 10 * 60 * 60 - 1;
    assert.equal(director.isVictory(), false);
    director.timeElapsed++;
    director.bossIndex = 3;
    enemies.enemies = [{ type: 'boss_carrier', hp: 1 }];
    assert.equal(director.isVictory(), false);
    enemies.enemies = [];
    assert.equal(director.isVictory(), true);
});

test('upgrade selections never offer damage modules for another weapon', () => {
    for (const weapon of ['auto_blaster', 'seeker_rockets', 'null_laser']) {
        const player = makeUpgradePlayer(weapon);
        for (let i = 0; i < 40; i++) {
            const selection = upgrades.getRandomSelection(player, 4);
            const ids = selection.map(choice => choice.id);
            if (weapon !== 'auto_blaster') assert.equal(ids.includes('upg_blaster_dmg'), false);
            if (weapon !== 'seeker_rockets') assert.equal(ids.includes('upg_seeker_dmg'), false);
            if (weapon !== 'null_laser') {
                assert.equal(ids.includes('upg_laser_dmg'), false);
                assert.equal(ids.includes('pointer_arithmetic'), false);
            }
            if (weapon !== 'auto_blaster') assert.equal(ids.includes('fork_bomb'), false);
            assert.equal(ids.includes('stack_canary'), false);
        }
    }
});

test('large XP awards queue every earned level', () => {
    const player = new Player();
    player.gainXp(1000);
    assert.equal(player.pendingLevelUps, 5);
    for (let i = 0; i < 5; i++) assert.equal(player.consumeLevelUp(), true);
    assert.equal(player.pendingLevelUps, 0);
    assert.equal(player.consumeLevelUp(), false);
});

test('all successful damage is available to the central damage event handler', () => {
    const player = new Player();
    player.invincibilityTimer = 0;
    assert.equal(player.takeDamage(1, 'enemy_projectile'), true);
    assert.deepEqual(player.consumeDamageEvents(), [{ amount: 1, source: 'enemy_projectile' }]);
    assert.deepEqual(player.consumeDamageEvents(), []);
});

test('laser upgrade text derives from the authoritative runtime definition', () => {
    const player = makeUpgradePlayer('null_laser');
    const detail = upgrades.getUpgradeDetails(player, 'upg_laser_dmg');
    assert.match(detail.description, new RegExp(String(WEAPON_DEFS.null_laser.baseDamage + WEAPON_DEFS.null_laser.damagePerLevel)));
});

test('boss defeat creates a recovery window before the next encounter', () => {
    const director = new Director();
    director.reset(10);
    director.startGame();
    director.bossWasAlive = true;
    enemies.enemies = [];
    director.update({});
    assert.ok(director.recoveryTimer > 0);
    assert.equal(director.encounterName, 'MEMORY RECOVERY');
});

test('dash corruption can damage the same target only once per dash', () => {
    const player = new Player();
    player.x = 10;
    player.y = 10;
    player.dashTimer = 2;
    player.dashDuration = 2;
    player.dashDx = 1;
    player.dashDy = 0;
    player.dashDmgLevel = 1;
    player.dashHitEnemies = new Set();
    const target = {
        x: 12,
        y: 10,
        width: 1,
        height: 1,
        type: 'drone',
        hp: 100,
        takeDamage(amount) { this.hp -= amount?.amount ?? amount; }
    };
    const idle = { x: 0, y: 0 };
    player.update(idle, 100, 100, null, [target]);
    player.update(idle, 100, 100, null, [target]);
    assert.equal(target.hp, 94);
});

test('manual aim assistance never initiates an idle shot', () => {
    const target = { x: 10, y: 1, width: 3, height: 1, hp: 8, introTimer: 0 };
    const assisted = resolveAssistedAim(0, 0, { x: 1, y: 0 }, [target], 'auto_blaster');
    assert.ok(assisted.x > 0.95);
    const player = { x: 0, y: 0, width: 3, height: 3, weaponType: 'auto_blaster' };
    assert.equal(weapons.resolveTarget(player, null, [target]), null);
    assert.equal(weapons.resolveTarget(player, { x: 1, y: 0 }, [target]).target, target);
    const outsideCone = resolveAssistedAim(0, 0, { x: 0, y: 1 }, [target], 'auto_blaster');
    assert.deepEqual(outsideCone, { x: 0, y: 1, target: null });
});

test('progression and combat baselines match the faster ten-minute cadence', () => {
    assert.equal(PROGRESSION_CONFIG.startingXp, 90);
    assert.equal(PROGRESSION_CONFIG.pickupMagnetRadius, 28);
    assert.deepEqual(BOSS_SCHEDULE_TICKS, [9000, 19800, 32400]);
    assert.equal(WEAPON_DEFS.auto_blaster.baseDamage, 10);
    assert.ok(ENEMY_DEFS.drone.hp <= WEAPON_DEFS.auto_blaster.baseDamage * 2);
    assert.equal('blackhole' in ENEMY_DEFS, false);
});

test('menus begin with no highlighted card', () => {
    const ui = new UIManager();
    assert.equal(ui.focusIndex, -1);
    ui.updateTransition('ship_select');
    assert.equal(ui.focusIndex, -1);
});

test('bosses transition into an explicit second phase below half health', () => {
    const boss = new Enemy(20, 20, 'boss_eye');
    boss.introTimer = 0;
    boss.hp = boss.maxHp * 0.49;
    boss.update(0, 0, 100, 100, [], { enemies: [boss], spawn() {} });
    assert.equal(boss.phase, 2);
    assert.ok(boss.phaseTransitionTimer > 0);
});

test('every enemy and boss stamps an authored silhouette without passive circles', () => {
    const cols = 120;
    const rows = 80;
    const renderer = {
        cols,
        rows,
        animationTime: 30,
        types: Array.from({ length: cols }, () => Array(rows).fill(0)),
        chars: Array.from({ length: cols }, () => Array(rows).fill(' ')),
        brightness: Array.from({ length: cols }, () => Array(rows).fill(0)),
        customColors: Array.from({ length: cols }, () => Array(rows).fill(null))
    };
    for (const type of Object.keys(ENEMY_DEFS)) {
        const enemy = new Enemy(40, 30, type);
        enemy.introTimer = 0;
        enemy.fireCooldown = 100;
        assert.doesNotThrow(() => enemy.stampToGrid(renderer), type);
    }
    const visibleGlyphs = renderer.chars.flat().filter(char => char !== ' ').length;
    assert.ok(visibleGlyphs > 30);
});

test('the Watcher uses gaze and iris attacks without spawning helper hazards', () => {
    const boss = new Enemy(20, 20, 'boss_eye');
    boss.introTimer = 0;
    boss.fireCooldown = 0;
    const projectiles = [];
    const manager = { enemies: [boss], spawns: [], spawn(...args) { this.spawns.push(args); } };
    boss.update(50, 50, 100, 100, projectiles, manager);
    assert.ok(projectiles.length > 0);
    assert.deepEqual(manager.spawns, []);
});

test('dash distance is derived from each hull configuration', () => {
    for (const [hull, expected] of [['runner', 20], ['daemon', 17], ['cutter', 23]]) {
        const player = new Player();
        player.hullType = hull;
        player.reset(200, 200);
        player.x = 50; player.y = 50;
        player.dashTimer = 8; player.dashDx = 1; player.dashDy = 0;
        const start = player.x;
        for (let frame = 0; frame < 8; frame++) player.update({ x: 0, y: 0 }, 200, 200, null, []);
        assert.ok(Math.abs((player.x - start) - expected) < 0.25, `${hull} travelled ${player.x - start}`);
        assert.ok(player.invincibilityTimer > 0);
    }
});

test('cellular ecosystem seeds, merges, and respects its population budget', () => {
    const manager = {
        enemies: [],
        spawn(x, y, type) {
            const enemy = new Enemy(x, y, type);
            this.enemies.push(enemy);
            return enemy;
        }
    };
    const system = new EcosystemSystem();
    system.reset(120, 80, manager);
    assert.ok(manager.enemies.some(enemy => enemy.type === 'cell_colony'));
    assert.ok(system.count(manager) <= COMBAT_CONFIG.ecosystemPopulationCap);
    system.tick = 120;
    system.mergeColonies(manager);
    assert.ok(manager.enemies.some(enemy => enemy.type === 'cell_amalgam'));
    assert.ok([...ECOSYSTEM_TYPES].every(type => ENEMY_DEFS[type]?.ecosystem));
});

test('parasites attach to normal hosts and release spores when the host dies', () => {
    const manager = {
        enemies: [],
        spawn(x, y, type) {
            const enemy = new Enemy(x, y, type);
            this.enemies.push(enemy);
            return enemy;
        }
    };
    const system = new EcosystemSystem();
    system.reset(100, 100);
    const host = manager.spawn(20, 20, 'drone');
    manager.spawn(20.5, 20, 'cell_parasite');
    const originalMax = host.maxHp;
    system.attachParasites(manager);
    assert.equal(host.parasiteCount, 1);
    assert.equal(host.maxHp, originalMax * 1.25);
    system.onEntityDeath(host, manager);
    assert.equal(manager.enemies.filter(enemy => enemy.type === 'cell_spore').length, 2);
});

test('cellular terrain is sector-aware, bounded, visible, and destructible', () => {
    const system = new EcosystemSystem();
    system.reset(120, 80);
    system.addTerrain(10, 10, 3);
    system.addTerrain(90, 10, 3);
    system.addTerrain(10, 60, 1);
    system.addTerrain(90, 60, 3);
    assert.equal(system.terrainAt(10, 10).mutation, 'STACK');
    assert.equal(system.terrainAt(90, 10).mutation, 'HEAP');
    assert.equal(system.terrainAt(10, 60).mutation, 'NULL');
    assert.equal(system.terrainAt(90, 60).mutation, 'KERNEL');
    assert.equal(system.blocksProjectile(10, 10), true);
    assert.ok(system.movementMultiplier(10, 10) < 1);
    assert.equal(system.damageTerrain(10, 10, 4), true);
    assert.equal(system.terrainAt(10, 10), null);
    system.seedTerrain(COMBAT_CONFIG.ecosystemTerrainCap * 2);
    assert.ok(system.terrain.size <= COMBAT_CONFIG.ecosystemTerrainCap);
});

test('only a basic per-run summary remains and legacy lifetime storage is removed', () => {
    const values = new Map();
    values.set('voidptr_stats_v1', '{"runs":99}');
    const storage = { removeItem: key => values.delete(key) };
    const tracker = new StatsTracker(storage);
    tracker.reset();
    tracker.recordShot(); tracker.recordHit(12); tracker.recordKill('drone'); tracker.recordDash(); tracker.recordDistance(20); tracker.recordCombo(7);
    tracker.finalize({ victory: true, score: 500, level: 6, survivalSeconds: 600 });
    assert.equal(values.has('voidptr_stats_v1'), false);
    assert.deepEqual(Object.keys(tracker.snapshot()).sort(), ['bossKills', 'finalized', 'kills', 'levelsGained', 'score', 'survivalSeconds', 'victory'].sort());
    assert.equal(tracker.snapshot().kills, 1);
});

test('all menus and results stamp into the ASCII grid with no default focus', () => {
    const makeRenderer = (viewCols, viewRows) => ({
        viewCols, viewRows, worldCols: 140, worldRows: 100, camX: 0, camY: 0, cellWidth: 9, cellHeight: 15,
        chars: Array.from({ length: 140 }, () => Array(100).fill(' ')),
        types: Array.from({ length: 140 }, () => Array(100).fill(0)),
        brightness: Array.from({ length: 140 }, () => Array(100).fill(0))
    });
    for (const [cols, rows] of [[120, 60], [72, 48], [46, 42]]) {
        const grid = makeRenderer(cols, rows);
        const asciiUi = new UIManager();
        for (let frame = 0; frame < 20; frame++) asciiUi.stampTitleScreen(grid, -1, -1);
        assert.equal(asciiUi.focusIndex, -1);
        assert.equal(asciiUi.buttons.some(button => button.id === 'records'), false);
        assert.ok(asciiUi.buttons.some(button => button.id === 'controls'));
        assert.ok(grid.chars.flat().some(char => '╔╗╚╝┌┐└┘'.includes(char)));
        asciiUi.stampResultsScreen(grid, -1, -1, true, new StatsTracker(null).snapshot());
        assert.ok(asciiUi.buttons.some(button => button.id === 'restart'));
    }
});

test('visible interface and effect modules use glyphs instead of vector primitives', () => {
    for (const file of ['src/main.js', 'src/ui.js', 'src/effects.js']) {
        const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /\.(?:fillRect|strokeRect|arc|lineTo|moveTo|roundRect)\s*\(/, file);
    }
    const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    assert.doesNotMatch(main, /ScreenUI|screenUi/);
});

test('seeded genomes are reproducible, individual, and family-readable', () => {
    const first = new Genome('drone', 4242);
    const same = new Genome('drone', 4242);
    const sibling = new Genome('drone', 4243);
    assert.deepEqual(first, same);
    assert.equal(first.family, SpeciesFamily.SKITTER);
    assert.notEqual(first.signature, sibling.signature);
    const a = new Enemy(10, 10, 'drone', { seed: 4242 });
    const b = new Enemy(10, 10, 'drone', { seed: 4242 });
    assert.deepEqual(renderCreatureBody(a, 20), renderCreatureBody(b, 20));
    const organism = renderCreatureBody(a, 20).join('');
    assert.match(organism, /[%H=~:;]/);
    assert.doesNotMatch(organism, /[<>()[\]]/);
    const breathingFrames = new Set([0, 7, 14, 21].map(frame => renderCreatureBody(a, frame).join('\n')));
    assert.ok(breathingFrames.size >= 3);
});

test('XP pickups disappear as soon as magnetic movement reaches the player', () => {
    const system = new PickupSystem();
    const player = { x: 0, y: 0, width: 3, height: 3, upgrades: {}, gained: 0, gainXp(value) { this.gained += value; } };
    system.spawnMemory(4, 1.5, 10);
    assert.equal(system.items.length, 1);
    system.update(player, []);
    assert.equal(system.items.length, 0);
    assert.equal(player.gained, 10);
});

test('overlapping pickups and boss vacuum collect each XP value exactly once', () => {
    const system = new PickupSystem();
    const player = { x: 0, y: 0, width: 3, height: 3, upgrades: {}, gained: 0, gainXp(value) { this.gained += value; } };
    system.items.push(new MemoryPickup(1.5, 1.5, 12), new MemoryPickup(1.5, 1.5, 18));
    system.update(player, []);
    assert.equal(player.gained, 30);
    assert.equal(system.items.length, 0);
    system.items.push(new MemoryPickup(50, 50, 40), new MemoryPickup(70, 70, 60));
    system.vacuumAll(player);
    system.vacuumAll(player);
    assert.equal(player.gained, 130);
    assert.equal(system.items.length, 0);
});

test('nutrient residue cannot masquerade as blue XP', () => {
    const system = new EcosystemSystem();
    system.reset(40, 30);
    system.addNutrient(10, 10, 3);
    const renderer = {
        cols: 40, rows: 30,
        types: Array.from({ length: 40 }, () => Array(30).fill(0)),
        chars: Array.from({ length: 40 }, () => Array(30).fill(' ')),
        brightness: Array.from({ length: 40 }, () => Array(30).fill(0)),
        customColors: Array.from({ length: 40 }, () => Array(30).fill(null))
    };
    system.stampToGrid(renderer);
    assert.notEqual(renderer.customColors[10][10], PALETTE.pickup);
    assert.match(renderer.chars[10][10], /[,;]/);
});

test('organic fields are seeded, bounded, amorphous, and family-specific', () => {
    for (const [type, family] of [['drone', 'skitter'], ['shooter', 'bloomcaster'], ['worm', 'ribbon'], ['virus', 'prism'], ['brute', 'carapace'], ['kamikaze', 'burst_sac'], ['shield_projector', 'rootweaver']]) {
        const first = new Enemy(0, 0, type, { seed: 100 });
        const same = new Enemy(0, 0, type, { seed: 100 });
        const other = new Enemy(0, 0, type, { seed: 101 });
        const profile = ORGANIC_FIELD_PROFILES[family];
        assert.deepEqual(first.bodyPlan.organicField.frames, same.bodyPlan.organicField.frames);
        assert.notDeepEqual(first.bodyPlan.organicField.frames, other.bodyPlan.organicField.frames);
        assert.ok(first.bodyPlan.organicField.frames.every(frame => frame.length <= profile.maxCells));
        assert.ok(first.bodyPlan.organicField.frames.flat().every(cell => profile.glyphs.includes(cell.glyph)));
        assert.ok(new Set(first.bodyPlan.organicField.frames.map((_, index) => renderCreatureBody(first, index * 6).join('\n'))).size >= 3);
    }
});

test('father names and ordinary background words are frequent, dim, and bounded', () => {
    const rain = new MatrixRain();
    rain.resize(120, 80);
    const allowed = new Set(['father', 'papa', 'abu', 'dad', 'baba', 'abba', 'padre', 'pater', 'apa', 'tata']);
    assert.ok(rain.easterEggs.length >= 24 && rain.easterEggs.length <= 32);
    assert.ok(rain.backgroundWords.length >= 90 && rain.backgroundWords.length <= 120);
    assert.ok(rain.easterEggs.every(entry => allowed.has(entry.word) && entry.brightness <= BACKGROUND_WORD_CONFIG.kinshipBrightness[1]));
    rain.resize(120, 80);
    assert.ok(rain.easterEggs.length >= 24 && rain.easterEggs.length <= 32);
});

test('floating touch sticks clamp, respect deadzones, and reset independently', () => {
    const move = new FloatingStick('move');
    const fire = new FloatingStick('shoot');
    move.begin(1, 100, 100, 50); fire.begin(2, 300, 100, 50);
    move.move(102, 102);
    assert.deepEqual(move.vector, { x: 0, y: 0 });
    move.move(200, 100); fire.move(300, 50);
    assert.ok(Math.abs(move.vector.x - 1) < 0.001);
    assert.ok(Math.abs(fire.vector.y + 1) < 0.001);
    move.end(1);
    assert.equal(move.active, false);
    assert.equal(fire.active, true);
});

test('damage numbers are disabled and results are reduced to basic run stats', () => {
    const enemySource = readFileSync(new URL('../src/enemies.js', import.meta.url), 'utf8');
    const playerSource = readFileSync(new URL('../src/player.js', import.meta.url), 'utf8');
    assert.doesNotMatch(enemySource, /spawnDamageText\(/);
    assert.doesNotMatch(playerSource, /spawnDamageText\(/);
    const uiSource = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
    assert.match(uiSource, /GAME OVER/);
    assert.doesNotMatch(uiSource.slice(uiSource.indexOf('stampResultsScreen'), uiSource.indexOf('stampHUD')), /Shots\/hits|Colonies|Damage/);
});

test('mobile presentation requests fullscreen landscape and keeps XP on the bottom row', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
    assert.equal(manifest.display, 'fullscreen');
    assert.equal(manifest.orientation, 'landscape');
    const uiSource = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
    assert.match(uiSource, /XP .*h - 3/);
    const enemySource = readFileSync(new URL('../src/enemies.js', import.meta.url), 'utf8');
    const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
    assert.doesNotMatch(enemySource, /for \(const pack of colonyMind\.packs\.values\(\)\)/);
    assert.doesNotMatch(mainSource, /shield_fence/);
});

test('mobile landscape keeps the full title and paginates cards within short viewports', () => {
    const makeMobileRenderer = (width, height) => {
        const viewCols = Math.floor(width / 7) + 2, viewRows = Math.floor(height / 11) + 2;
        return {
            width, height, viewCols, viewRows, isTouchLayout: true, worldCols: 180, worldRows: 110, camX: 0, camY: 0, cellWidth: 7, cellHeight: 11,
            chars: Array.from({ length: 180 }, () => Array(110).fill(' ')),
            types: Array.from({ length: 180 }, () => Array(110).fill(0)),
            brightness: Array.from({ length: 180 }, () => Array(110).fill(0))
        };
    };
    for (const [width, height] of [[568, 320], [667, 375], [740, 360]]) {
        const grid = makeMobileRenderer(width, height);
        const mobileUi = new UIManager();
        for (let frame = 0; frame < 20; frame++) mobileUi.stampTitleScreen(grid, -1, -1);
        assert.ok(grid.chars.flat().filter(char => char === '█').length > 10, `${width}x${height} should keep full title art`);
        mobileUi.stampShipSelectScreen(grid, -1, -1);
        assert.ok(mobileUi.buttons.some(button => button.id.startsWith('ship_')));
        const choices = upgrades.getRandomSelection(makeUpgradePlayer('auto_blaster'), 3);
        mobileUi.stampUpgradeScreen(grid, -1, -1, choices, 1);
        for (const button of mobileUi.buttons) {
            assert.ok(button.col >= 0 && button.row >= 0 && button.col + button.w <= grid.viewCols && button.row + button.h <= grid.viewRows, `${button.id} overflowed ${width}x${height}`);
        }
    }
    const portrait = makeMobileRenderer(320, 568);
    const rotateUi = new UIManager();
    rotateUi.stampRotateScreen(portrait);
    assert.equal(rotateUi.buttons.length, 0);
    const portraitRows = Array.from({ length: portrait.viewRows }, (_, row) =>
        Array.from({ length: portrait.viewCols }, (_, col) => portrait.chars[col]?.[row] ?? ' ').join('')
    ).join('\n');
    assert.match(portraitRows, /ROTATE DEVICE/);
});

test('organ wounds are stable and have functional combat consequences', () => {
    const shooter = new Enemy(10, 10, 'shooter', { seed: 9 });
    shooter.introTimer = 0;
    const attack = shooter.organs.find(organ => organ.type === 'attack');
    shooter.takeDamage({ amount: 30, damageType: 'bullet', hitX: shooter.x + attack.x, hitY: shooter.y + attack.y });
    assert.ok([OrganState.RUPTURED, OrganState.SEVERED].includes(attack.state));
    shooter.fireCooldown = 0;
    const shots = [];
    shooter.update(20, 20, 100, 100, shots, { enemies: [shooter], spawn() {} });
    assert.equal(shots.length, 0);
    assert.equal(shooter.attackState, 'ruptured');

    const skitter = new Enemy(10, 10, 'drone', { seed: 10 });
    const social = skitter.organs.find(organ => organ.type === 'social');
    skitter.packId = 2;
    skitter.takeDamage({ amount: 30, damageType: 'laser', hitX: skitter.x + social.x, hitY: skitter.y + social.y });
    assert.equal(skitter.packId, null);
});

test('run evolution answers dominant pressure with capped visible tradeoffs', () => {
    const director = new EvolutionDirector(77);
    const enemy = new Enemy(0, 0, 'drone', { seed: 1 });
    for (let i = 0; i < 36; i++) {
        director.recordDamage(enemy, { damageType: 'bullet' }, 10);
        director.recordDeath(enemy, 300);
    }
    const profile = director.profileFor('drone');
    assert.ok(profile.adaptations.length <= 3);
    assert.equal(profile.adaptations[0].id, 'angled_shell');
    assert.ok(profile.adaptations.every(adaptation => adaptation.glyph && adaptation.tradeoff));
    assert.ok(profile.adaptations.every(adaptation => Object.values(adaptation.modifiers).every(value => value >= 0.78)));
});

test('colony intelligence uses bounded local queries and breaks on severed signals', () => {
    const system = new ColonyMindSystem(4);
    const swarm = Array.from({ length: 30 }, (_, index) => new Enemy(index * 2, 20, 'drone', { seed: index + 1 }));
    const manager = { enemies: swarm, fuse() { return null; } };
    for (let i = 0; i < 12; i++) system.update(manager, { x: 30, y: 30 });
    assert.ok(system.queryCount > 0 && system.queryCount < swarm.length);
    assert.ok(swarm.some(enemy => enemy.packId));
    const disconnected = swarm.find(enemy => enemy.packId);
    disconnected.organs.find(organ => organ.type === 'social').state = OrganState.SEVERED;
    disconnected.packId = null;
    system.think(disconnected, manager, { x: 30, y: 30 });
    assert.equal(disconnected.packId, null);
});

test('fusion consumes participants once and creates an inherited elite', () => {
    enemies.reset(123);
    const a = enemies.spawn(10, 10, 'drone', { seed: 11 });
    const b = enemies.spawn(11, 10, 'shooter', { seed: 12 });
    a.hp = 2; b.hp = 2;
    const fused = enemies.fuse([a, b]);
    assert.ok(fused);
    assert.equal(fused.type, 'cell_amalgam');
    assert.equal(enemies.enemies.includes(a), false);
    assert.equal(enemies.enemies.includes(b), false);
    assert.equal(enemies.enemies.filter(enemy => enemy === fused).length, 1);
});

test('organic bosses expose authored organs and metamorphose through organ failure', () => {
    for (const type of ['boss_snake', 'boss_eye', 'boss_carrier']) {
        const boss = new Enemy(20, 20, type, { seed: 808 });
        assert.ok(boss.organs.length >= 5);
        assert.ok(boss.organs.some(organ => organ.type === 'core'));
        boss.introTimer = 0;
        boss.hp = boss.maxHp * 0.49;
        const manager = { enemies: [boss], spawn() {}, elapsedSeconds: 400 };
        boss.update(0, 0, 120, 90, [], manager);
        assert.equal(boss.phase, 2);
        assert.ok(boss.weakPoints.length > 0);
    }
});

test('organic morphology has stable preparation, release, and recovery states', () => {
    const creature = new Enemy(10, 10, 'shooter', { seed: 5150 });
    creature.attackState = 'idle';
    const idle = renderCreatureBody(creature, 24).join('\n');
    creature.attackState = 'prepare';
    const prepared = renderCreatureBody(creature, 24).join('\n');
    creature.attackState = 'release';
    const released = renderCreatureBody(creature, 24).join('\n');
    creature.attackState = 'recover';
    const recovered = renderCreatureBody(creature, 24).join('\n');
    assert.notEqual(prepared, idle);
    assert.notEqual(released, prepared);
    assert.notEqual(recovered, released);
    creature.attackState = 'prepare';
    assert.equal(renderCreatureBody(creature, 24).join('\n'), prepared);
});

test('combat rituals telegraph attacks and organ destruction increases the kill reward', () => {
    const skitter = new Enemy(10, 10, 'drone', { seed: 71 });
    skitter.introTimer = 0;
    skitter.fireCooldown = 10;
    skitter.update(20, 10, 100, 100, [], { enemies: [skitter], spawn() {} });
    assert.equal(skitter.attackState, 'prepare');
    assert.equal(skitter.getContactHitbox().width, 0);
    skitter.fireCooldown = 0;
    skitter.update(20, 10, 100, 100, [], { enemies: [skitter], spawn() {} });
    assert.equal(skitter.attackState, 'release');
    assert.ok(skitter.getContactHitbox().width > 0);

    const caster = new Enemy(10, 10, 'shooter', { seed: 72 });
    caster.introTimer = 0;
    const startingXp = caster.xpValue;
    const attack = caster.organs.find(organ => organ.type === 'attack');
    caster.takeDamage({ amount: 30, damageType: 'bullet', hitX: caster.x + attack.x, hitY: caster.y + attack.y, directionX: 1 });
    assert.ok(caster.xpValue > startingXp);
});
