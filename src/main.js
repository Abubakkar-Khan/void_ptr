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

const GAME_STATES = {
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
        this.state = GAME_STATES.MENU;
        this.lastTime = 0;
        this.tickRate = 1000 / 60; // 60 FPS update rate for smooth movement
        this.activeUpgradesSelection = [];
        this.selectedMinutes = 999;
    }

    init() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        
        input.init(canvas);
        renderer.init(canvas);
        
        window.addEventListener('resize', () => renderer.resize());

        canvas.addEventListener('mousedown', () => {
            audio.init();
            if (this.state !== GAME_STATES.PLAYING) {
                ui.handleClicks((action) => this.processMenuAction(action), this.activeUpgradesSelection);
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'p') {
                if (this.state === GAME_STATES.PLAYING) {
                    this.state = GAME_STATES.PAUSED;
                } else if (this.state === GAME_STATES.PAUSED) {
                    this.state = GAME_STATES.PLAYING;
                }
            }
        });

        this.state = GAME_STATES.MENU;
        requestAnimationFrame((t) => this.loop(t));
    }

    startGame(minutes) {
        const chosenWeapon = player.weaponType; // Preserve the weapon chosen in ship selection
        player.reset(renderer.cols, renderer.rows);
        player.weaponType = chosenWeapon;
        player.recalculateStats();

        weapons.reset();
        enemies.reset();
        effects.reset();
        waves.reset(minutes);
        waves.startGame();
        // Center camera on player immediately
        renderer.updateCamera(player.x, player.y);
        this.state = GAME_STATES.PLAYING;
    }

    processMenuAction(action) {
        if (!action) return;
        if (action === 'toggle_sound' || action === 'toggle_color') return;

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
            player.weaponType = 'auto_blaster';
            this.startGame(this.selectedMinutes);
        } else if (action === 'ship_seeker') {
            audio.playUpgradeSelect();
            player.weaponType = 'seeker_rockets';
            this.startGame(this.selectedMinutes);
        } else if (action === 'ship_laser') {
            audio.playUpgradeSelect();
            player.weaponType = 'null_laser';
            this.startGame(this.selectedMinutes);
        } else if (action === 'restart' || action === 'quit') {
            audio.playUpgradeSelect();
            this.state = GAME_STATES.MENU;
        } else if (action === 'resume') {
            this.state = GAME_STATES.PLAYING;
        } else if (action.startsWith('w_') || action === 'drone' || action === 'electric' || action === 'thread' || action === 'speed' || action === 'fire_rate' || action === 'heal') {
            player.applyUpgrade(action);
            this.state = GAME_STATES.PLAYING;
        }
    }

    loop(time) {
        if (this.lastTime === 0) this.lastTime = time;
        let dt = time - this.lastTime;
        this.lastTime = time;
        if (dt > 250) dt = 250;
        this.accumulator += dt;

        while (this.accumulator >= this.tickRate) {
            this.update();
            this.accumulator -= this.tickRate;
        }

        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update() {
        matrixRain.update();
        effects.update();
        renderer.update();

        if (this.state !== GAME_STATES.PLAYING) {
            input.tick();
            return;
        }

        const moveVec = input.getMovementVector();
        player.update(moveVec, renderer.cols, renderer.rows, weapons, enemies.enemies);

        // Update camera to follow player
        renderer.updateCamera(player.x + player.width / 2, player.y + player.height / 2);

        // Convert mouse screen position to world grid position using camera offset
        const targetX_grid = (input.mouse.x / renderer.cellWidth) + renderer.camX;
        const targetY_grid = (input.mouse.y / renderer.cellHeight) + renderer.camY;

        if (input.isFiring()) {
            const fired = weapons.fire(player, targetX_grid, targetY_grid);
            if (fired) audio.playShoot(player.weaponType);
        }

        weapons.update(enemies.enemies);
        enemies.update(player, renderer.cols, renderer.rows);
        waves.update(renderer, renderer.cols, renderer.rows);

        this.resolveCollisions();

        if (waves.isVictory()) {
            this.state = GAME_STATES.VICTORY;
        }

        input.tick();
    }

    resolveCollisions() {
        const pBullets = weapons.projectiles;
        const eEnemies = enemies.enemies;
        const eBullets = enemies.projectiles;
        
        // Player Bullets vs Enemies
        for (let b = pBullets.length - 1; b >= 0; b--) {
            const bullet = pBullets[b];
            const bBox = bullet.getHitbox();

            for (let e = eEnemies.length - 1; e >= 0; e--) {
                const enemy = eEnemies[e];
                const eBox = enemy.getHitbox();

                if (collision.checkOverlap(bBox, eBox)) {
                    enemy.applyKnockback(bullet.vx, bullet.vy);
                    
                    const isDead = enemy.takeDamage(bullet.damage);
                    effects.spawnImpactSparks(bullet.x, bullet.y);
                    renderer.triggerShake(5, 1.5);
                    audio.playHit();

                    if (!bullet.piercing) bullet.life = 0;

                    if (isDead) {
                        audio.playEnemyDeath();
                        enemy.onDeath(enemies);
                        player.score += enemy.xpValue;
                        
                        const leveledUp = player.gainXp(enemy.xpValue);
                        eEnemies.splice(e, 1);
                        
                        if (leveledUp) {
                            audio.playWaveClear();
                            this.state = GAME_STATES.LEVEL_UP;
                            this.activeUpgradesSelection = upgrades.getRandomSelection(3);
                        }
                    }

                    if (bullet.life <= 0) {
                        pBullets.splice(b, 1);
                        break;
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
                if (player.takeDamage(bullet.damage)) this.onPlayerHit();
            }
        }

        // Enemies vs Player
        for (let e = eEnemies.length - 1; e >= 0; e--) {
            const enemy = eEnemies[e];
            if (collision.checkOverlap(enemy.getHitbox(), pHitbox)) {
                if (player.takeDamage(1)) {
                    const dx = player.x - enemy.x;
                    const dy = player.y - enemy.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    player.vx += (dx/dist) * 2;
                    player.vy += (dy/dist) * 2;
                    this.onPlayerHit();
                }
            }
        }
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
        renderer.clearGrid();
        
        const mx = input.mouse.x;
        const my = input.mouse.y;

        // Dynamically toggle mouse cursor style
        const canvas = renderer.canvas;
        if (canvas) {
            if (this.state === GAME_STATES.PLAYING) {
                canvas.style.cursor = 'crosshair';
            } else {
                canvas.style.cursor = 'default';
            }
        }
        
        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.LEVEL_UP || this.state === GAME_STATES.PAUSED) {
            player.stampToGrid(renderer);
            weapons.stampToGrid(renderer);
            enemies.stampToGrid(renderer);
        }

        // Stamp UI screens to the ASCII grid
        if (this.state === GAME_STATES.MENU) {
            ui.stampTitleScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.SHIP_SELECT) {
            ui.stampShipSelectScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.PAUSED) {
            ui.stampPauseScreen(renderer, mx, my);
        } else if (this.state === GAME_STATES.LEVEL_UP) {
            ui.stampUpgradeScreen(renderer, mx, my, this.activeUpgradesSelection);
        } else if (this.state === GAME_STATES.GAME_OVER) {
            ui.stampGameOverScreen(renderer, mx, my, false, player.score);
        } else if (this.state === GAME_STATES.VICTORY) {
            ui.stampGameOverScreen(renderer, mx, my, true, player.score);
        }

        renderer.draw();

        const ctx = renderer.ctx;
        if (!ctx) return;
        
        effects.draw(ctx);

        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.LEVEL_UP || this.state === GAME_STATES.PAUSED) {
            this.drawHUD(ctx);
        }

        if (this.state === GAME_STATES.PLAYING) {
            ui.drawCrosshair(renderer, mx, my);
        }
    }

    drawHUD(ctx) {
        ctx.save();
        
        // Time remaining top right
        const timeStr = waves.getTimeRemainingFormatted();
        ui.drawText(ctx, timeStr, ctx.canvas.width - 20, 30, 24, '#00ff41', 'right');

        // HP top left
        let hpBar = '';
        for (let i = 0; i < player.maxHp; i++) hpBar += i < player.hp ? '█' : '░';
        ui.drawText(ctx, `HP [${hpBar}]`, 20, 30, 18, '#00ff41', 'left');

        // Level top center
        ui.drawText(ctx, `LVL ${player.level}`, ctx.canvas.width / 2, 30, 18, '#00ff41', 'center');

        // XP Bar bottom
        const xpRatio = player.xp / player.xpToNextLevel;
        const barW = ctx.canvas.width - 40;
        ctx.fillStyle = 'rgba(0, 50, 0, 0.5)';
        ctx.fillRect(20, ctx.canvas.height - 20, barW, 10);
        ctx.fillStyle = '#00ff41';
        ctx.shadowColor = 'rgba(0, 255, 65, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillRect(20, ctx.canvas.height - 20, barW * xpRatio, 10);
        ctx.shadowBlur = 0;
        
        ctx.restore();
    }
}

const game = new GameEngine();
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => game.init());
} else {
    game.init();
}
export default game;
