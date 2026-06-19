import { input } from './input.js';
import { renderer } from './renderer.js';
import { matrixRain } from './matrixRain.js';
import { player } from './player.js';
import { weapons } from './weapons.js';
import { enemies } from './enemies.js';
import { collision } from './collision.js';
import { effects } from './effects.js';
import { waves } from './waves.js';
import { upgrades } from './upgrades.js';
import { ui } from './ui.js';
import { audio } from './audio.js';
import { pickups } from './pickups.js';
import { ecosystem } from './ecosystem.js';
import { stats } from './stats.js';
import { BOSS_TYPES, HULL_DEFS, WEAPON_DEFS } from './config.js';

const GAME_STATES = {
    BOOT: 'boot',
    MENU: 'menu',
    SHIP_SELECT: 'ship_select',
    PLAYING: 'playing',
    LEVEL_UP: 'level_up',
    GAME_OVER: 'game_over',
    VICTORY: 'victory',
    RECORDS: 'records',
    PAUSED: 'paused'
};

class GameEngine {
    constructor() {
        this.state = GAME_STATES.BOOT;
        this.bootTicks = 0;
        this.lastTime = 0;
        this.accumulator = 0; // Fixed: Initialize accumulator to prevent NaN loop freeze
        this.tickRate = 1000 / 60; // 60 FPS update rate for smooth movement
        this.activeUpgradesSelection = [];
        this.selectedMinutes = 999;
        this.debugVisible = false;
        this.killCombo = 0;
        this.comboTimer = 0;
        this.totalKills = 0;
        this.upgradeRerolls = 1;
    }

    init() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        
        input.init(canvas);
        renderer.init(canvas);
        document.body.classList.toggle('reduced-motion', ui.reducedMotion);
        renderer.reducedMotion = ui.reducedMotion;
        renderer.monochrome = !ui.colorMode;
        
        window.addEventListener('resize', () => renderer.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === GAME_STATES.PLAYING) {
                this.state = GAME_STATES.PAUSED;
                ui.currentScreen = null;
            }
        });

        canvas.addEventListener('pointerdown', (event) => {
            input.updateMousePos(event);
            audio.init();
            if (this.state !== GAME_STATES.PLAYING) {
                ui.handlePointer(input.mouse.x, input.mouse.y, renderer, (action) => this.processMenuAction(action), this.activeUpgradesSelection);
            }
        });

        this.cheatBuffer = '';
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'p') {
                if (this.state === GAME_STATES.PLAYING) {
                    this.state = GAME_STATES.PAUSED;
                } else if (this.state === GAME_STATES.PAUSED) {
                    this.state = GAME_STATES.PLAYING;
                    ui.currentScreen = null;
                }
            }

            if (e.key === 'F1') {
                e.preventDefault();
                this.debugVisible = !this.debugVisible;
            }

            if (this.state !== GAME_STATES.PLAYING) {
                audio.init();
                ui.handleKeyPress(e.key, (action) => this.processMenuAction(action), this.activeUpgradesSelection);
            }

            // Cheat codes
            if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
                this.cheatBuffer = (this.cheatBuffer + e.key.toLowerCase()).slice(-20);
                if (this.cheatBuffer.endsWith('sudo')) {
                    player.invincibilityTimer = 360000; // 100 minutes of invincibility
                    player.score += 1337;
                    audio.playUpgradeSelect();
                    effects.triggerFlash();
                    this.cheatBuffer = '';
                } else if (this.cheatBuffer.endsWith('deadcode')) {
                    player.xp = player.xpToNextLevel;
                    const leveledUp = player.gainXp(0);
                    if (leveledUp) {
                        player.consumeLevelUp();
                        audio.playWaveClear();
                        this.state = GAME_STATES.LEVEL_UP;
                        ui.currentScreen = null;
                        const choices = player.upgrades.cacheOverclock ? 4 : 3;
                        this.activeUpgradesSelection = upgrades.getRandomSelection(player, choices);
                    }
                    this.cheatBuffer = '';
                }
            }
        });

        this.state = GAME_STATES.BOOT;
        this.bootTicks = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    startGame(minutes) {
        const chosenHull = player.hullType;
        matrixRain.reset();
        player.reset(renderer.cols, renderer.rows);
        player.hullType = chosenHull;
        player.weaponType = HULL_DEFS[chosenHull]?.weapon || HULL_DEFS.runner.weapon;
        player.recalculateStats();

        weapons.reset();
        enemies.reset();
        effects.reset();
        pickups.reset();
        waves.reset(minutes);
        waves.startGame();
        ecosystem.reset(renderer.cols, renderer.rows, enemies);
        stats.reset(chosenHull);
        input.resetTransient();
        this.killCombo = 0;
        this.comboTimer = 0;
        this.totalKills = 0;
        renderer.snapCamera(player.x + player.width / 2, player.y + player.height / 2);
        this.state = GAME_STATES.PLAYING;
        ui.currentScreen = null;
    }

    processMenuAction(action) {
        if (!action) return;
        if (action === 'toggle_sound') return;

        if (action === 'select_ship_endless') {
            audio.playUpgradeSelect();
            this.selectedMinutes = 999;
            this.state = GAME_STATES.SHIP_SELECT;
        } else if (action === 'select_ship_10') {
            audio.playUpgradeSelect();
            this.selectedMinutes = 10;
            this.state = GAME_STATES.SHIP_SELECT;
        } else if (action === 'ship_normal') {
            audio.playUpgradeSelect();
            player.hullType = 'runner';
            this.startGame(this.selectedMinutes);
        } else if (action === 'ship_seeker') {
            audio.playUpgradeSelect();
            player.hullType = 'daemon';
            this.startGame(this.selectedMinutes);
        } else if (action === 'ship_laser') {
            audio.playUpgradeSelect();
            player.hullType = 'cutter';
            this.startGame(this.selectedMinutes);
        } else if (action === 'back') {
            audio.playUpgradeSelect();
            this.state = GAME_STATES.MENU;
            ui.currentScreen = null;
        } else if (action === 'records') {
            audio.playUpgradeSelect();
            this.state = GAME_STATES.RECORDS;
            ui.currentScreen = null;
        } else if (action === 'restart') {
            audio.playUpgradeSelect();
            this.startGame(this.selectedMinutes);
        } else if (action === 'quit') {
            audio.playUpgradeSelect();
            stats.finalize({ victory: false, score: player.score, level: player.level, survivalSeconds: waves.elapsedSeconds });
            this.state = GAME_STATES.MENU;
            ui.currentScreen = null;
        } else if (action === 'resume') {
            this.state = GAME_STATES.PLAYING;
            ui.currentScreen = null;
        } else if (action === 'toggle_music') {
            audio.toggleMusic();
        } else if (action === 'toggle_sfx') {
            audio.toggleSfx();
        } else if (action === 'toggle_fx') {
            ui.toggleReducedMotion();
            renderer.reducedMotion = ui.reducedMotion;
        } else if (action === 'toggle_color') {
            ui.toggleColorMode();
            renderer.monochrome = !ui.colorMode;
        } else if (action === 'reroll_upgrades' && this.upgradeRerolls > 0) {
            this.upgradeRerolls--;
            const choices = player.upgrades.cacheOverclock ? 4 : 3;
            this.activeUpgradesSelection = upgrades.getRandomSelection(player, choices);
            ui.currentScreen = null;
        } else if (['thread', 'speed', 'fire_rate', 'heal', 'drone', 'electric', 'shield', 'freeze', 'bomb', 'dash_dmg', 'bios_cache', 'bios_kernel', 'bios_swap', 'upg_blaster_dmg', 'upg_seeker_dmg', 'upg_laser_dmg', 'garbage_collector', 'stack_canary', 'segfault', 'pointer_arithmetic', 'undefined_behavior', 'fork_bomb', 'memory_leak'].includes(action)) {
            player.applyUpgrade(action);
            if (player.pendingLevelUps > 0) {
                player.consumeLevelUp();
                const choices = player.upgrades.cacheOverclock ? 4 : 3;
                this.activeUpgradesSelection = upgrades.getRandomSelection(player, choices);
                this.state = GAME_STATES.LEVEL_UP;
                ui.currentScreen = null;
            } else {
                this.state = GAME_STATES.PLAYING;
                ui.currentScreen = null;
            }
        }
    }

    loop(time) {
        if (this.lastTime === 0) this.lastTime = time;
        let dt = time - this.lastTime;
        this.lastTime = time;
        if (dt > 100) dt = 100;
        this.accumulator += dt;

        let ticks = 0;
        while (this.accumulator >= this.tickRate) {
            this.update();
            this.accumulator -= this.tickRate;
            ticks++;
            if (ticks >= 5) {
                this.accumulator = Math.min(this.accumulator, this.tickRate); // retain interpolation time without a death spiral
                break;
            }
        }

        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update() {
        if (this.state !== GAME_STATES.PAUSED) {
            matrixRain.update();
            effects.update();
            renderer.update();
        }

        if (this.state === GAME_STATES.BOOT) {
            this.bootTicks++;
            if (this.bootTicks >= 240) {
                this.state = GAME_STATES.MENU;
            }
            input.tick();
            return;
        }

        if (this.state !== GAME_STATES.PLAYING) {
            const menuKey = input.getMenuKey();
            if (menuKey) {
                ui.handleKeyPress(menuKey, (action) => this.processMenuAction(action), this.activeUpgradesSelection);
            }
            input.tick();
            return;
        }

        if (input.justPressedPause()) {
            this.state = GAME_STATES.PAUSED;
            ui.currentScreen = null;
            input.tick();
            return;
        }

        const moveVec = input.getMovementVector();
        if (this.comboTimer > 0) this.comboTimer--;
        else this.killCombo = 0;
        player.update(moveVec, renderer.cols, renderer.rows, weapons, enemies.enemies);

        // Update camera to follow player
        renderer.updateCamera(player.x + player.width / 2, player.y + player.height / 2);

        let shootVec = input.getShootingVector();
        if (!shootVec && input.mouse.isDown) {
            const mouseGridX = renderer.camX + input.mouse.x / renderer.cellWidth;
            const mouseGridY = renderer.camY + input.mouse.y / renderer.cellHeight;
            const dx = mouseGridX - (player.x + player.width / 2);
            const dy = mouseGridY - (player.y + player.height / 2);
            const distance = Math.hypot(dx, dy) || 1;
            shootVec = { x: dx / distance, y: dy / distance };
        }
        const aimTarget = weapons.resolveTarget(player, shootVec, enemies.enemies);
        if (aimTarget) {
            player.aimAngle = Math.atan2(aimTarget.y - (player.y + player.height / 2), aimTarget.x - (player.x + player.width / 2));
            const fired = weapons.fire(player, aimTarget.x, aimTarget.y);
            if (fired) audio.playShoot(player.weaponType);
        }

        weapons.update(enemies.enemies);
        enemies.update(player, renderer.cols, renderer.rows);
        enemies.elapsedSeconds = waves.elapsedSeconds;
        ecosystem.update(enemies, player);
        pickups.update(player, enemies.enemies);
        waves.update(renderer);
        if (waves.timeElapsed % 120 === 0) audio.setIntensity(waves.threatTier, enemies.enemies.some(e => e && BOSS_TYPES.has(e.type) && e.hp > 0));

        this.resolveCollisions();
        this.processDamageEvents();

        if (player.pendingLevelUps > 0) {
            player.consumeLevelUp();
            audio.playWaveClear();
            this.state = GAME_STATES.LEVEL_UP;
            ui.currentScreen = null;
            this.upgradeRerolls = 1;
            const choices = player.upgrades.cacheOverclock ? 4 : 3;
            this.activeUpgradesSelection = upgrades.getRandomSelection(player, choices);
        }

        if (waves.isVictory()) {
            stats.finalize({ victory: true, score: player.score, level: player.level, survivalSeconds: waves.elapsedSeconds });
            this.state = GAME_STATES.VICTORY;
        }

        input.tick();
    }

    resolveCollisions() {
        const pBullets = weapons.projectiles;
        const eEnemies = enemies.enemies;
        const eBullets = enemies.projectiles;

        // General cleanup loop for dead enemies (killed by zaps, dashes, bomb blasts, etc.)
        for (let e = eEnemies.length - 1; e >= 0; e--) {
            const enemy = eEnemies[e];
            if (enemy.hp <= 0) {
                this.handleEnemyDeath(enemy, eBullets);
                eEnemies.splice(e, 1);
            }
        }
        
        // Player Bullets vs Enemies
        for (let b = pBullets.length - 1; b >= 0; b--) {
            const bullet = pBullets[b];
            if (bullet.type === 'visual_laser') continue;
            const bBox = bullet.getHitbox();

            for (let e = eEnemies.length - 1; e >= 0; e--) {
                const enemy = eEnemies[e];
                if (bullet.hitEnemies?.has(enemy)) continue;
                const eBox = enemy.getHitbox();

                if (collision.checkOverlap(bBox, eBox)) {
                    bullet.hitEnemies?.add(enemy);
                    enemy.applyKnockback(bullet.vx, bullet.vy);
                    
                    const isDead = enemy.takeDamage(bullet.damage, bullet.x, bullet.y);
                    if (bullet.type !== 'laser' || Math.random() < 0.15) {
                        effects.spawnImpactSparks(bullet.x, bullet.y);
                    }
                    if (bullet.type === 'rocket') renderer.triggerShake(3, 0.8);
                    audio.playHit();

                    if (!bullet.piercing) {
                        bullet.life = 0;
                        bullet.onDeath();
                    }

                    if (isDead) {
                        weapons.spawnFork(bullet, player.upgrades.forkBomb || 0);
                        this.handleEnemyDeath(enemy, eBullets);
                        eEnemies.splice(e, 1);
                    }

                    if (bullet.life <= 0) {
                        bullet.onDeath();
                        pBullets.splice(b, 1);
                        break;
                    }
                }
            }
        }

        // Check Shield Projector laser fences
        for (const enemy of eEnemies) {
            if (enemy && enemy.type === 'shield_projector' && enemy.hp > 0) {
                const px = enemy.x + 1.5;
                const py = enemy.y + 1.5;
                for (const other of enemy.linkedTargets || []) {
                    if (other && other.hp > 0) {
                        const ow = other.width !== undefined ? other.width : 1;
                        const oh = other.height !== undefined ? other.height : 1;
                        const tx = other.x + ow/2;
                        const ty = other.y + oh/2;
                        
                        const dist = collision.distToSegment(player.x + 1.5, player.y + 1.5, px, py, tx, ty);
                        if (dist < 1.2) {
                            player.takeDamage(1, 'shield_fence');
                        }
                    }
                }
            }
        }

        // Enemy Bullets vs Player
        const pHitbox = player.getHitbox();
        for (let b = eBullets.length - 1; b >= 0; b--) {
            const bullet = eBullets[b];
            if (collision.checkOverlap(bullet.getHitbox(), pHitbox)) {
                eBullets.splice(b, 1);
                player.takeDamage(bullet.damage, 'enemy_projectile');
            }
        }

        // Enemies vs Player
        for (let e = eEnemies.length - 1; e >= 0; e--) {
            const enemy = eEnemies[e];
            if (collision.checkOverlap(enemy.getContactHitbox(), pHitbox)) {
                if (player.takeDamage(1, enemy.type)) {
                    const dx = player.x - enemy.x;
                    const dy = player.y - enemy.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    player.vx += (dx/dist) * 2;
                    player.vy += (dy/dist) * 2;
                }
            }
        }
    }

    handleEnemyDeath(enemy, spawnedProjectiles) {
        audio.playEnemyDeath();
        if (BOSS_TYPES.has(enemy.type)) audio.playWaveClear();
        enemy.onDeath(enemies, spawnedProjectiles);
        this.killCombo++;
        this.totalKills++;
        stats.recordKill(enemy.type, BOSS_TYPES.has(enemy.type));
        stats.recordCombo(this.killCombo);
        this.comboTimer = 90;
        const comboMultiplier = 1 + Math.floor(this.killCombo / 10) * 0.1;
        player.score += Math.round(enemy.xpValue * comboMultiplier);
        pickups.spawnMemory(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.xpValue);
        ecosystem.onEntityDeath(enemy, enemies);
        if (BOSS_TYPES.has(enemy.type)) pickups.vacuumAll(player);
        if (enemy.type === 'kamikaze' && enemy.detonated) {
            const dist = Math.hypot(player.x + 1.5 - (enemy.x + 0.5), player.y + 1.5 - (enemy.y + 0.5));
            if (dist < 8) player.takeDamage(2, 'kamikaze_blast');
        }
    }

    processDamageEvents() {
        const events = player.consumeDamageEvents();
        if (!events.length) return;
        this.onPlayerHit(events[events.length - 1]);
    }

    onPlayerHit() {
        audio.playPlayerDamage();
        renderer.triggerShake(15, 6);
        effects.triggerFlash();
        effects.spawnGlitchExplosion(player.x + 1.5, player.y + 1.5, '#00ff41', 20);

        if (player.hp <= 0) {
            effects.spawnGlitchExplosion(player.x + 1.5, player.y + 1.5, '#00ff41', 50);
            stats.finalize({ victory: false, score: player.score, level: player.level, survivalSeconds: waves.elapsedSeconds });
            this.state = GAME_STATES.GAME_OVER;
        }
    }

    draw() {
        let brightnessFactor = 1.0;
        if (this.state === GAME_STATES.BOOT) {
            if (this.bootTicks < 180) {
                brightnessFactor = 0.0;
            } else {
                brightnessFactor = (this.bootTicks - 180) / 60;
            }
        }

        renderer.clearGrid(brightnessFactor, player);
        
        const mx = input.mouse.x;
        const my = input.mouse.y;

        // Dynamically toggle mouse cursor style
        const canvas = renderer.canvas;
        if (canvas) {
            if (this.state === GAME_STATES.PLAYING) {
                canvas.style.cursor = 'none';
            } else {
                canvas.style.cursor = 'default';
            }
        }
        
        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.LEVEL_UP || this.state === GAME_STATES.PAUSED) {
            ecosystem.stampToGrid(renderer, player);
            player.stampToGrid(renderer);
            weapons.stampToGrid(renderer);
            enemies.stampToGrid(renderer);
            pickups.stampToGrid(renderer);
        }

        if (this.state === GAME_STATES.BOOT) ui.stampBootScreen(renderer, this.bootTicks);
        else if (this.state === GAME_STATES.MENU) ui.stampTitleScreen(renderer, mx, my);
        else if (this.state === GAME_STATES.SHIP_SELECT) ui.stampShipSelectScreen(renderer, mx, my);
        else if (this.state === GAME_STATES.LEVEL_UP) ui.stampUpgradeScreen(renderer, mx, my, this.activeUpgradesSelection, this.upgradeRerolls);
        else if (this.state === GAME_STATES.PAUSED) ui.stampPauseScreen(renderer, mx, my);
        else if (this.state === GAME_STATES.RECORDS) ui.stampRecordsScreen(renderer, mx, my, stats.lifetime);
        else if (this.state === GAME_STATES.GAME_OVER || this.state === GAME_STATES.VICTORY) ui.stampResultsScreen(renderer, mx, my, this.state === GAME_STATES.VICTORY, stats.snapshot());
        else if (this.state === GAME_STATES.PLAYING) this.stampHUD();

        renderer.draw();

        const ctx = renderer.ctx;
        if (!ctx) return;
        
        effects.draw(ctx);

        // All visible interface geometry is already part of the glyph grid.
    }

    stampHUD() {
        const boss = enemies.enemies.find(enemy => enemy && enemy.hp > 0 && BOSS_TYPES.has(enemy.type));
        const overtime = !waves.endless && waves.timeElapsed >= waves.modeTimeLimit && !waves.isVictory();
        ui.stampHUD(renderer, {
            hp: player.hp, maxHp: player.maxHp, xp: player.xp, xpMax: player.xpToNextLevel,
            level: player.level, timer: overtime ? `OVERTIME+${Math.floor((waves.timeElapsed - waves.modeTimeLimit) / 60)}s` : waves.getTimeRemainingFormatted(),
            threat: waves.getThreatLabel(), weapon: WEAPON_DEFS[player.weaponType]?.name || player.weaponType,
            heat: player.weaponType === 'null_laser' ? Math.round(player.heat) : null,
            overheated: player.overheated, dash: player.dashCooldown <= 0 ? 'READY' : `${Math.ceil(player.dashCooldown / 60)}s`,
            boss, debug: this.debugVisible ? `E:${enemies.enemies.length} EB:${enemies.projectiles.length} PB:${weapons.projectiles.length}` : '',
            hint: waves.elapsedSeconds < 12 ? 'WASD MOVE | HOLD ARROWS/MOUSE FIRE | SPACE DASH' : ''
        });
    }

}

const game = new GameEngine();
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => game.init());
} else {
    game.init();
}
export default game;
