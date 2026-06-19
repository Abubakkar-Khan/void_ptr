import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Director } from '../src/waves.js';
import { Player } from '../src/player.js';
import { upgrades } from '../src/upgrades.js';
import { BOSS_SCHEDULE_TICKS, COMBAT_CONFIG, ECOSYSTEM_TYPES, ENEMY_DEFS, PROGRESSION_CONFIG, WEAPON_DEFS } from '../src/config.js';
import { Enemy, enemies } from '../src/enemies.js';
import { EcosystemSystem } from '../src/ecosystem.js';
import { StatsTracker } from '../src/stats.js';
import { UIManager } from '../src/ui.js';
import { resolveAssistedAim, weapons } from '../src/weapons.js';

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
    assert.equal(player.pendingLevelUps, 6);
    for (let i = 0; i < 6; i++) assert.equal(player.consumeLevelUp(), true);
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
        takeDamage(amount) { this.hp -= amount; }
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
    assert.equal(PROGRESSION_CONFIG.startingXp, 70);
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

test('stats persist versioned lifetime records and recover malformed storage', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const tracker = new StatsTracker(storage);
    tracker.reset('runner');
    tracker.recordShot(); tracker.recordHit(12); tracker.recordKill('drone'); tracker.recordDash(); tracker.recordDistance(20); tracker.recordCombo(7);
    tracker.finalize({ victory: true, score: 500, level: 6, survivalSeconds: 600 });
    const restored = new StatsTracker(storage);
    assert.equal(restored.lifetime.runs, 1);
    assert.equal(restored.lifetime.wins, 1);
    assert.equal(restored.lifetime.totalKills, 1);
    values.set('voidptr_stats_v1', '{broken');
    assert.equal(new StatsTracker(storage).lifetime.runs, 0);
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
        assert.ok(asciiUi.buttons.some(button => button.id === 'records'));
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
