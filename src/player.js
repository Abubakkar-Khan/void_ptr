import { RENDER_CELL_TYPES } from './renderer.js';
import { input } from './input.js';
import { matrixRain } from './matrixRain.js';
import { audio } from './audio.js';
import { ProjectileBase } from './weapons.js';
import { effects } from './effects.js';

const SHIP_WIDTH = 3;
const SHIP_HEIGHT = 3;

const PLAYER_PATTERNS = {
    UP: [
        [' ', '▲', ' '],
        ['/', '║', '\\'],
        ['/', ' ', '\\']
    ],
    UP_RIGHT: [
        [' ', '/', '▲'],
        ['/', '▲', '/'],
        ['/', ' ', ' ']
    ],
    RIGHT: [
        ['╚', '═', '╗'],
        [' ', ' ', '▶'],
        ['┌', '═', '╝']
    ],
    DOWN_RIGHT: [
        [' ', ' ', '\\'],
        ['\\', '▼', '\\'],
        [' ', '\\', '▼']
    ],
    DOWN: [
        ['/', ' ', '\\'],
        ['\\', '║', '/'],
        [' ', '▼', ' ']
    ],
    DOWN_LEFT: [
        ['/', ' ', ' '],
        ['\\', '▼', '\\'],
        ['▼', ' ', ' ']
    ],
    LEFT: [
        ['╔', '═', '╝'],
        ['◀', ' ', ' '],
        ['╚', '═', '┐']
    ],
    UP_LEFT: [
        ['▲', '\\', ' '],
        ['\\', '▲', '\\'],
        [' ', ' ', '\\']
    ]
};

export class Player {
    constructor() {
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.width = SHIP_WIDTH;
        this.height = SHIP_HEIGHT;
        
        this.maxHp = 5; this.hp = 5;
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = 100;
        
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 90;
        
        this.fireCooldown = 0;
        this.baseFireRate = 12;
        this.fireRate = 12;
        
        // Dash settings
        this.dashTimer = 0;
        this.dashDuration = 10;
        this.dashCooldown = 0;
        this.dashSpeed = 3.6;
        this.dashGhosts = []; // ghost smear frames

        // Upgrades
        this.hasHelperDrones = 0;
        this.hasElectricDischarge = 0;
        this.electricCooldown = 0;
        this.droneCooldown = 0;

        // Floating physics
        this.speed = 1.2;
        this.friction = 0.92;
        this.acceleration = 0.08;

        this.upgrades = { extraThreads: 0, speedBoost: 0, fireRateBoost: 0 };
        this.weaponType = 'auto_blaster';
        this.currentPattern = PLAYER_PATTERNS.UP;
    }

    reset(gridCols, gridRows) {
        this.x = gridCols / 2;
        this.y = gridRows / 2;
        this.vx = 0; this.vy = 0;
        this.hp = this.maxHp;
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = 100;
        this.fireCooldown = 0;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashGhosts = [];
        this.hasHelperDrones = 0;
        this.hasElectricDischarge = 0;
        this.electricCooldown = 0;
        this.droneCooldown = 0;
        this.upgrades = { extraThreads: 0, speedBoost: 0, fireRateBoost: 0 };
        this.recalculateStats();
    }

    recalculateStats() {
        this.speed = 1.2 + this.upgrades.speedBoost * 0.2;
        this.fireRate = Math.max(3, this.baseFireRate - this.upgrades.fireRateBoost * 2.0);
    }

    applyUpgrade(upgradeId) {
        if (upgradeId === 'thread') this.upgrades.extraThreads++;
        else if (upgradeId === 'speed') this.upgrades.speedBoost++;
        else if (upgradeId === 'fire_rate') this.upgrades.fireRateBoost++;
        else if (upgradeId === 'heal') this.hp = Math.min(this.maxHp, this.hp + 2);
        else if (upgradeId === 'drone') this.hasHelperDrones++;
        else if (upgradeId === 'electric') this.hasElectricDischarge++;
        else if (upgradeId === 'w_laser') this.weaponType = 'null_laser';
        else if (upgradeId === 'w_rocket') this.weaponType = 'seeker_rockets';
        this.recalculateStats();
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.level++;
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
            return true;
        }
        return false;
    }

    getHitbox() {
        return { x: this.x + 1, y: this.y + 1, width: 1, height: 1 };
    }

    takeDamage(amount) {
        if (this.invincibilityTimer > 0) return false;
        this.hp -= amount;
        this.invincibilityTimer = this.invincibilityDuration;
        return true;
    }

    update(moveVec, gridCols, gridRows, weaponsInstance, enemiesList) {
        if (this.invincibilityTimer > 0) this.invincibilityTimer--;
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.dashCooldown > 0) this.dashCooldown--;

        // Trigger Dash
        if (input.justPressedDash() && this.dashCooldown === 0 && this.dashTimer === 0) {
            this.dashTimer = this.dashDuration;
            this.dashCooldown = 45;
            audio.playDash();

            let dx = moveVec.x;
            let dy = moveVec.y;
            if (dx === 0 && dy === 0) {
                // Dash towards cursor
                const targetX_grid = (input.mouse.x / 8) + Math.floor(this.x - 30); // estimated camera
                const targetY_grid = (input.mouse.y / 14) + Math.floor(this.y - 20);
                const angle = Math.atan2(targetY_grid - (this.y + 1.5), targetX_grid - (this.x + 1.5));
                dx = Math.cos(angle);
                dy = Math.sin(angle);
            }
            this.vx = dx * this.dashSpeed;
            this.vy = dy * this.dashSpeed;
        }

        // Check if inside a static glitch obstacle field (slowing penalty!)
        const cx_cell = Math.floor(this.x + this.width / 2);
        const cy_cell = Math.floor(this.y + this.height / 2);
        let insideGlitchField = false;
        if (cx_cell >= 0 && cx_cell < gridCols && cy_cell >= 0 && cy_cell < gridRows) {
            if (matrixRain.obstacles && matrixRain.obstacles[cx_cell][cy_cell]) {
                insideGlitchField = true;
            }
        }

        // Apply normal physics if not dashing
        if (this.dashTimer > 0) {
            this.dashTimer--;
            // Invincibility during dash
            this.invincibilityTimer = Math.max(this.invincibilityTimer, 2);
            // Spawn smear frames
            this.dashGhosts.push({ x: this.x, y: this.y, pattern: this.currentPattern, life: 8 });
        } else {
            let accel = this.acceleration;
            let maxSpd = this.speed;
            let fric = this.friction;

            if (insideGlitchField) {
                accel *= 0.4;
                maxSpd *= 0.5;
                fric *= 0.7; // stronger friction inside glitch field
            }

            this.vx += moveVec.x * accel;
            this.vy += moveVec.y * accel;

            this.vx *= fric;
            this.vy *= fric;

            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > maxSpd) {
                this.vx = (this.vx / currentSpeed) * maxSpd;
                this.vy = (this.vy / currentSpeed) * maxSpd;
            }
        }

        // Obstacle Collision Check
        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;
        let collides = false;
        
        for (let dx = 0; dx < this.width; dx++) {
            for (let dy = 0; dy < this.height; dy++) {
                const px_cell = Math.floor(nextX + dx);
                const py_cell = Math.floor(nextY + dy);
                if (px_cell >= 0 && px_cell < gridCols && py_cell >= 0 && py_cell < gridRows) {
                    if (matrixRain.obstacles && matrixRain.obstacles[px_cell][py_cell]) {
                        collides = true;
                        break;
                    }
                }
            }
            if (collides) break;
        }

        if (collides) {
            this.vx *= -0.4;
            this.vy *= -0.4;
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        // Keep inside bounds
        if (this.x < 1) { this.x = 1; this.vx *= -0.5; }
        if (this.x > gridCols - this.width - 1) { this.x = gridCols - this.width - 1; this.vx *= -0.5; }
        if (this.y < 1) { this.y = 1; this.vy *= -0.5; }
        if (this.y > gridRows - this.height - 1) { this.y = gridRows - this.height - 1; this.vy *= -0.5; }

        // Update dash ghosts
        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life--;
            if (this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
        }

        // Helper Drones Auto-shooting
        if (this.hasHelperDrones > 0 && weaponsInstance && enemiesList && enemiesList.length > 0) {
            if (this.droneCooldown > 0) this.droneCooldown--;
            else {
                // Find closest enemy
                let closest = null;
                let minDist = 40;
                for (const e of enemiesList) {
                    const dx = e.x - this.x;
                    const dy = e.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = e;
                    }
                }

                if (closest) {
                    // Fire a seeker rocket from each drone
                    const px = this.x + this.width/2;
                    const py = this.y + this.height/2;
                    for (let i = 0; i < this.hasHelperDrones; i++) {
                        const droneAngle = (Date.now() * 0.003) + i * (Math.PI * 2 / this.hasHelperDrones);
                        const dx = Math.cos(droneAngle) * 4;
                        const dy = Math.sin(droneAngle) * 4;
                        const droneX = px + dx;
                        const droneY = py + dy;

                        const aimAngle = Math.atan2(closest.y + closest.height/2 - droneY, closest.x + closest.width/2 - droneX);
                        weaponsInstance.projectiles.push(new ProjectileBase(
                            droneX, droneY, 
                            Math.cos(aimAngle) * 0.6, Math.sin(aimAngle) * 0.6, 
                            { damage: 1.5, type: 'rocket', life: 90 }
                        ));
                    }
                    audio.playShoot('bullet');
                    this.droneCooldown = 45;
                }
            }
        }

        // Electric discharge Tesla passive shocking
        if (this.hasElectricDischarge > 0 && enemiesList && enemiesList.length > 0) {
            if (this.electricCooldown > 0) this.electricCooldown--;
            else {
                // Shock up to 3 nearby enemies
                const px = this.x + this.width/2;
                const py = this.y + this.height/2;
                let zapped = 0;
                for (const e of enemiesList) {
                    const dx = e.x + e.width/2 - px;
                    const dy = e.y + e.height/2 - py;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 20) {
                        // Apply damage
                        e.takeDamage(1.5 * this.hasElectricDischarge);
                        // Trigger lightning effect in canvas
                        effects.spawnLightningArc(px, py, e.x + e.width/2, e.y + e.height/2);
                        zapped++;
                        if (zapped >= 3) break;
                    }
                }
                if (zapped > 0) {
                    audio.playHit();
                    this.electricCooldown = 60;
                }
            }
        }
    }

    stampToGrid(rendererInstance) {
        const px = this.x + this.width / 2;
        const py = this.y + this.height / 2;

        // Calculate aiming angle to mouse target in grid units
        const targetX_grid = (input.mouse.x / rendererInstance.cellWidth) + rendererInstance.camX;
        const targetY_grid = (input.mouse.y / rendererInstance.cellHeight) + rendererInstance.camY;
        
        let angle = Math.atan2(targetY_grid - py, targetX_grid - px);
        if (angle < 0) angle += Math.PI * 2;

        const step = Math.PI / 4;
        const index = Math.round(angle / step) % 8;
        const DIRECTIONS = ['RIGHT', 'DOWN_RIGHT', 'DOWN', 'DOWN_LEFT', 'LEFT', 'UP_LEFT', 'UP', 'UP_RIGHT'];
        this.currentPattern = PLAYER_PATTERNS[DIRECTIONS[index]];

        // 1. Stamp dash smear ghosts
        for (let i = 0; i < this.dashGhosts.length; i++) {
            const ghost = this.dashGhosts[i];
            const ix = Math.floor(ghost.x);
            const iy = Math.floor(ghost.y);
            const alpha = ghost.life / 8;

            for (let row = 0; row < this.height; row++) {
                for (let col = 0; col < this.width; col++) {
                    const char = ghost.pattern[row][col];
                    if (char === ' ') continue;

                    const gx = ix + col;
                    const gy = iy + row;

                    if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                        rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.GLITCH;
                        // Scramble smear frames slightly
                        rendererInstance.chars[gx][gy] = (Math.random() < 0.25) ? '.' : char;
                        rendererInstance.brightness[gx][gy] = 0.5 * alpha;
                    }
                }
            }
        }

        // 2. Stamp helper drones
        for (let i = 0; i < this.hasHelperDrones; i++) {
            const droneAngle = (Date.now() * 0.003) + i * (Math.PI * 2 / this.hasHelperDrones);
            const dx = Math.cos(droneAngle) * 4;
            const dy = Math.sin(droneAngle) * 4;
            const dGridX = Math.floor(px + dx);
            const dGridY = Math.floor(py + dy);

            if (dGridX >= 0 && dGridX < rendererInstance.cols && dGridY >= 0 && dGridY < rendererInstance.rows) {
                rendererInstance.types[dGridX][dGridY] = RENDER_CELL_TYPES.GLITCH;
                rendererInstance.chars[dGridX][dGridY] = '+';
                rendererInstance.brightness[dGridX][dGridY] = 0.8;
            }
        }

        // 3. Stamp ship
        if (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer / 4) % 2 === 0 && this.dashTimer === 0) return;

        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                const char = this.currentPattern[row][col];
                if (char === ' ') continue;

                const gx = ix + col;
                const gy = iy + row;

                if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                    rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.GLITCH;
                    rendererInstance.chars[gx][gy] = char;
                    rendererInstance.brightness[gx][gy] = 1.0;
                }
            }
        }
    }
}
export const player = new Player();
export { SHIP_WIDTH as PLAYER_SHIP_WIDTH };
