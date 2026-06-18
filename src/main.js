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
import { BOSS_TYPES, HULL_DEFS, PALETTE, WEAPON_DEFS } from './config.js';

const GAME_STATES = {
    BOOT: 'boot',
    MENU: 'menu',
    SHIP_SELECT: 'ship_select',
    PLAYING: 'playing',
    LEVEL_UP: 'level_up',
    GAME_OVER: 'game_over',
    VICTORY: 'victory',
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
        this.manualAimIdleTicks = 0;
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
        input.resetTransient();
        this.killCombo = 0;
        this.comboTimer = 0;
        this.totalKills = 0;
        this.manualAimIdleTicks = 0;
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
        } else if (action === 'restart') {
            audio.playUpgradeSelect();
            this.startGame(this.selectedMinutes);
        } else if (action === 'quit') {
            audio.playUpgradeSelect();
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
            if (menuKey) ui.handleKeyPress(menuKey, (action) => this.processMenuAction(action), this.activeUpgradesSelection);
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

        const shootVec = input.getShootingVector();
        this.manualAimIdleTicks = shootVec ? 0 : this.manualAimIdleTicks + 1;
        const aimTarget = weapons.resolveTarget(player, shootVec, enemies.enemies, this.manualAimIdleTicks);
        if (aimTarget) {
            player.aimAngle = Math.atan2(aimTarget.y - (player.y + player.height / 2), aimTarget.x - (player.x + player.width / 2));
            const fired = weapons.fire(player, aimTarget.x, aimTarget.y);
            if (fired) audio.playShoot(player.weaponType);
        }

        weapons.update(enemies.enemies);
        enemies.update(player, renderer.cols, renderer.rows);
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
        this.comboTimer = 90;
        const comboMultiplier = 1 + Math.floor(this.killCombo / 10) * 0.1;
        player.score += Math.round(enemy.xpValue * comboMultiplier);
        pickups.spawnMemory(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.xpValue);
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
            player.stampToGrid(renderer);
            weapons.stampToGrid(renderer);
            enemies.stampToGrid(renderer);
            pickups.stampToGrid(renderer);
        }

        // Stamp UI screens to the ASCII grid
        if (this.state === GAME_STATES.BOOT) {
            ui.stampBootScreen(renderer, this.bootTicks);
        } else if (this.state === GAME_STATES.MENU) {
            ui.stampTitleScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.SHIP_SELECT) {
            ui.stampShipSelectScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.PAUSED) {
            ui.stampPauseScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.LEVEL_UP) {
            ui.stampUpgradeScreen(renderer, mx, my, this.activeUpgradesSelection, this.upgradeRerolls);
        } else if (this.state === GAME_STATES.GAME_OVER) {
            ui.stampGameOverScreen(renderer, mx, my, false, player.score, this.getRunSummary());
        } else if (this.state === GAME_STATES.VICTORY) {
            ui.stampGameOverScreen(renderer, mx, my, true, player.score, this.getRunSummary());
        }

        renderer.draw();

        const ctx = renderer.ctx;
        if (!ctx) return;
        
        effects.draw(ctx);

        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.LEVEL_UP || this.state === GAME_STATES.PAUSED) {
            this.drawHUD(ctx);
        }

        // Keyboard aiming does not require a mouse crosshair during gameplay
    }

    drawHUD(ctx) {
        {
            ctx.save();
            const screenW = renderer.width;
            const screenH = renderer.height;
            const hpRatio = Math.max(0, player.hp / player.maxHp);
            const hpWidth = Math.min(260, screenW * 0.28);
            ctx.fillStyle = 'rgba(2, 12, 16, 0.82)';
            ctx.fillRect(16, 15, hpWidth, 24);
            ctx.fillStyle = hpRatio > 0.3 ? PALETTE.player : PALETTE.enemyShot;
            ctx.fillRect(18, 17, (hpWidth - 4) * hpRatio, 20);
            ui.drawText(ctx, `HULL ${Math.ceil(player.hp)}/${player.maxHp}`, 24, 33, 14, PALETTE.ui, 'left');

            const overtime = !waves.endless && waves.timeElapsed >= waves.modeTimeLimit && !waves.isVictory();
            ui.drawText(ctx, overtime ? `OVERTIME +${Math.floor((waves.timeElapsed - waves.modeTimeLimit) / 60)}s` : waves.getTimeRemainingFormatted(), screenW / 2, 34, 24, overtime ? PALETTE.enemyShot : PALETTE.ui, 'center');
            ui.drawText(ctx, `LV ${player.level}  //  ${waves.getThreatLabel()}`, screenW - 18, 31, 13, PALETTE.enemyShot, 'right');

            if (waves.elapsedSeconds < 12) ui.drawText(ctx, 'WASD MOVE  //  ARROWS AIM  //  IDLE AUTO-TARGET  //  SPACE DASH', screenW / 2, screenH * 0.72, 15, PALETTE.ui, 'center');

            const weapon = WEAPON_DEFS[player.weaponType];
            const dashState = player.dashCooldown <= 0 ? 'DASH READY' : `DASH ${Math.ceil(player.dashCooldown / 60)}s`;
            let weaponState = weapon.name;
            if (player.weaponType === 'null_laser') weaponState += `  HEAT ${Math.round(player.heat)}%${player.overheated ? ' LOCKED' : ''}`;
            ui.drawText(ctx, `${weaponState}  //  ${dashState}`, 18, screenH - 29, 13, PALETTE.player, 'left');

            const boss = enemies.enemies.find(enemy => enemy && enemy.hp > 0 && BOSS_TYPES.has(enemy.type));
            if (boss) {
                const names = { boss_snake: 'NULL SERPENT', boss_eye: 'THE WATCHER', boss_carrier: 'HEAP CARRIER' };
                const ratio = Math.max(0, boss.hp / boss.maxHp);
                const barW = Math.min(720, screenW * 0.62);
                const barX = (screenW - barW) / 2;
                ctx.fillStyle = 'rgba(24, 0, 8, 0.88)';
                ctx.fillRect(barX, 51, barW, 20);
                ctx.fillStyle = PALETTE.boss;
                ctx.fillRect(barX + 2, 53, (barW - 4) * ratio, 16);
                ui.drawText(ctx, `${names[boss.type]}  //  PHASE ${boss.phase}  //  ${Math.ceil(ratio * 100)}%`, screenW / 2, 67, 13, PALETTE.ui, 'center');
            }

            const xpRatio = player.xp / player.xpToNextLevel;
            ctx.fillStyle = 'rgba(0, 18, 28, 0.85)';
            ctx.fillRect(0, screenH - 9, screenW, 9);
            ctx.fillStyle = PALETTE.pickup;
            ctx.fillRect(0, screenH - 9, screenW * xpRatio, 9);
            if (this.debugVisible) ui.drawText(ctx, `F1 DEBUG  E:${enemies.enemies.length} EB:${enemies.projectiles.length} PB:${weapons.projectiles.length}`, 18, 91, 12, PALETTE.ui, 'left');
            ctx.restore();
        }
        return;
        ctx.save();
        
        // Time remaining top right
        const screenW = renderer.width;
        const screenH = renderer.height;
        const timeStr = waves.getTimeRemainingFormatted();
        ui.drawText(ctx, timeStr, screenW - 20, 30, 24, PALETTE.environment, 'right');

        // HP top left
        let hpBar = '';
        for (let i = 0; i < player.maxHp; i++) hpBar += i < player.hp ? '█' : '░';
        ui.drawText(ctx, `HP [${hpBar}]`, 20, 30, 18, PALETTE.player, 'left');

        // Level top center
        ui.drawText(ctx, `LVL ${player.level}  SCORE ${player.score}`, screenW / 2, 30, 18, PALETTE.ui, 'center');
        if (this.killCombo >= 3) ui.drawText(ctx, `GC CHAIN x${this.killCombo}`, screenW - 20, 54, 13, PALETTE.pickup, 'right');
        ui.drawText(ctx, waves.getThreatLabel(), screenW / 2, 50, 12, PALETTE.enemyShot, 'center');
        if (waves.elapsedSeconds < 15) {
            ui.drawText(ctx, 'WASD MOVE  //  ARROWS FIRE  //  SPACE DASH', screenW / 2, screenH * 0.72, 16, PALETTE.ui, 'center');
        }

        const hull = HULL_DEFS[player.hullType] || HULL_DEFS.runner;
        const sector = matrixRain.getSectorName(player.x, player.y);
        const dashState = player.dashCooldown <= 0 ? 'DASH READY' : `DASH ${Math.ceil(player.dashCooldown / 60)}s`;
        const shieldState = player.shieldLevel ? (player.shieldActive ? 'SHIELD READY' : `SHIELD ${Math.ceil(player.shieldCooldown / 60)}s`) : '';
        ui.drawText(ctx, `${hull.name} // ${sector} // ${dashState}${shieldState ? ` // ${shieldState}` : ''}`, 20, screenH - 38, 12, PALETTE.player, 'left');

        if (player.weaponType === 'null_laser') {
            const heatRatio = player.heat / WEAPON_DEFS.null_laser.maxHeat;
            ui.drawText(ctx, `HEAT [${'='.repeat(Math.round(heatRatio * 10)).padEnd(10, '.')}]${player.overheated ? ' LOCKED' : ''}`, screenW - 20, screenH - 38, 12, player.overheated ? PALETTE.enemyShot : PALETTE.playerShot, 'right');
        }

        // Boss health bar
        const activeBosses = enemies.enemies.filter(e => e && e.hp > 0 && BOSS_TYPES.has(e.type));
        const boss = activeBosses[0];
        if (boss) {
            const ratio = Math.max(0, boss.hp / boss.maxHp);
            const screenW = renderer.width;

            // Blinking red alert warning ticker
            const warningTicks = Math.floor(Date.now() / 150) % 2;
            const warningColor = warningTicks === 0 ? '#ff0033' : '#aa0011';

            // Pulse warning banner at the top
            ctx.fillStyle = 'rgba(255, 0, 51, 0.08)';
            ctx.fillRect(0, 50, screenW, 40);

            // Warning text with random character glitches
            const warningTexts = [
                "⚠️ CRITICAL SYSTEM INSTABILITY DETECTED ⚠️",
                "⚠️ FATAL PROCESS EXCEPTION AT ADDR_0x4F8E ⚠️",
                "⚠️ UNAUTHORIZED OVERLORD THREAT DETECTED ⚠️",
                "⚠️ EXECUTING SYSTEM PURGE COMMAND: DESTRUCT ⚠️"
            ];
            const warningIndex = Math.floor(Date.now() / 2000) % warningTexts.length;
            let warningText = warningTexts[warningIndex];
            if (Math.random() < 0.15) {
                const idx = Math.floor(Math.random() * warningText.length);
                warningText = warningText.substring(0, idx) + String.fromCharCode(33 + Math.floor(Math.random() * 93)) + warningText.substring(idx + 1);
            }

            ui.drawText(ctx, warningText, screenW / 2, 60, 14, warningColor, 'center');

            // Bar dimensions
            const barW = Math.floor(screenW * 0.65);
            const barH = 14;
            const barX = Math.floor((screenW - barW) / 2);
            const barY = 74;

            // Background
            ctx.fillStyle = 'rgba(40, 0, 0, 0.7)';
            ctx.fillRect(barX, barY, barW, barH);

            // Shake effect if boss is low or random twitch
            let glitchOffsetX = 0;
            if ((ratio < 0.35 || Math.random() < 0.08)) {
                glitchOffsetX = (Math.random() - 0.5) * 6;
            }

            // Fill
            ctx.fillStyle = '#ff0033';
            ctx.shadowColor = 'rgba(255, 0, 51, 0.8)';
            ctx.shadowBlur = 8;
            ctx.fillRect(barX + glitchOffsetX, barY, barW * ratio, barH);
            ctx.shadowBlur = 0;

            // Border
            ctx.strokeStyle = '#ff0033';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX + glitchOffsetX, barY, barW, barH);

            // Determine boss executable system name
            let bossName = "SYSTEM_CORRUPTION.EXE";
            if (boss.type === 'boss_snake') {
                bossName = "SEGMENTED_VOID_DEVOURER [FATAL_SNAKE.EXE]";
            } else if (boss.type === 'boss_eye') {
                bossName = "INTRUSION_DETECTION_CORE [SYS_OBSERVER.BAT]";
            } else if (boss.type === 'boss_carrier') {
                bossName = "MAINFRAME_REPLICATOR_MOTHER [SPAM_INJECTOR.SYS]";
            }

            // Draw title below bar
            const percentText = `${Math.ceil(ratio * 100)}%`;
            const additional = activeBosses.length > 1 ? ` +${activeBosses.length - 1} ACTIVE` : '';
            ui.drawText(ctx, `${bossName}${additional} - CORRUPTION LEVEL: ${percentText}`, screenW / 2, barY + barH + 12, 12, '#ff0033', 'center');

            const bossScreenX = (boss.x + boss.width / 2 - renderer.camX) * renderer.cellWidth;
            const bossScreenY = (boss.y + boss.height / 2 - renderer.camY) * renderer.cellHeight;
            if (bossScreenX < 20 || bossScreenX > screenW - 20 || bossScreenY < 110 || bossScreenY > screenH - 40) {
                const markerX = Math.max(28, Math.min(screenW - 28, bossScreenX));
                const markerY = Math.max(115, Math.min(screenH - 45, bossScreenY));
                ui.drawText(ctx, '[!]', markerX, markerY, 18, PALETTE.boss, 'center');
            }
        }

        // XP Bar bottom
        const xpRatio = player.xp / player.xpToNextLevel;
        const barW = screenW - 40;
        ctx.fillStyle = 'rgba(0, 50, 0, 0.5)';
        ctx.fillRect(20, screenH - 20, barW, 10);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = 'rgba(0, 255, 65, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillRect(20, screenH - 20, barW * xpRatio, 10);
        ctx.shadowBlur = 0;

        if (this.debugVisible) {
            ui.drawText(ctx, `F1 DEBUG | WORLD:${matrixRain.seed} E:${enemies.enemies.length} EB:${enemies.projectiles.length} PB:${weapons.projectiles.length} XP:${pickups.items.length} CELL:${renderer.viewCols}x${renderer.viewRows}`, 20, 70, 12, PALETTE.ui, 'left');
        }
        
        ctx.restore();
    }

    getRunSummary() {
        const hull = HULL_DEFS[player.hullType] || HULL_DEFS.runner;
        return `${hull.name} | LVL ${player.level} | ${this.totalKills} KILLS | ${Math.floor(waves.elapsedSeconds / 60)}:${Math.floor(waves.elapsedSeconds % 60).toString().padStart(2, '0')}`;
    }
}

const game = new GameEngine();
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => game.init());
} else {
    game.init();
}
export default game;
