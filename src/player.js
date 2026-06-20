import { renderer, RENDER_CELL_TYPES } from './renderer.js';
import { input } from './input.js';
import { matrixRain } from './matrixRain.js';
import { audio } from './audio.js';
import { ProjectileBase } from './weapons.js';
import { effects } from './effects.js';
import { enemies } from './enemies.js';
import { BOSS_TYPES, HULL_DEFS, PALETTE, PROGRESSION_CONFIG, WEAPON_DEFS } from './config.js';
import { stats } from './stats.js';
import { ecosystem } from './ecosystem.js';

const GLYPHS = '01.:;|/\\-_';

const SHIP_WIDTH = 3;
const SHIP_HEIGHT = 3;

const createDefaultUpgrades = () => ({
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
    forkBomb: 0,
    memoryLeak: 0,
    chaosSpeed: 0,
    chaosDamage: 0
});

const PLAYER_PATTERNS = {
    UP: [
        [' ', '▲', ' '],
        ['/', '█', '\\'],
        ['◄', '░', '►']
    ],
    UP_RIGHT: [
        [' ', '/', '▲'],
        ['/', '█', '/'],
        ['░', '/', ' ']
    ],
    RIGHT: [
        ['▲', '═', '╗'],
        ['░', '█', '▶'],
        ['▼', '═', '╝']
    ],
    DOWN_RIGHT: [
        ['░', '\\', ' '],
        ['\\', '█', '\\'],
        [' ', '\\', '▼']
    ],
    DOWN: [
        ['◄', '░', '►'],
        ['\\', '█', '/'],
        [' ', '▼', ' ']
    ],
    DOWN_LEFT: [
        [' ', '/', '░'],
        ['/', '█', '/'],
        ['▼', '/', ' ']
    ],
    LEFT: [
        ['╔', '═', '▲'],
        ['◀', '█', '░'],
        ['╚', '═', '▼']
    ],
    UP_LEFT: [
        ['▲', '\\', ' '],
        ['\\', '█', '\\'],
        [' ', '\\', '░']
    ]
};

export class Player {
    constructor() {
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.width = SHIP_WIDTH;
        this.height = SHIP_HEIGHT;
        
        this.maxHp = 12; this.hp = 12;
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = PROGRESSION_CONFIG.startingXp;
        this.pendingLevelUp = false;
        this.pendingLevelUps = 0;
        
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 60; // 60 FPS scaling (1 second invincibility)
        
        this.fireCooldown = 0;
        this.baseFireRate = WEAPON_DEFS.auto_blaster.baseCooldown;
        this.fireRate = this.baseFireRate;
        
        // Dash settings
        this.dashTimer = 0;
        this.dashDuration = 8;
        this.dashCooldown = 0;
        this.dashSpeed = HULL_DEFS.runner.dashDistance / 7.3;
        this.dashGhosts = []; // ghost smear frames
        this.dashHitEnemies = new Set();

        // Upgrades
        this.hasHelperDrones = 0;
        this.hasElectricDischarge = 0;
        this.electricCooldown = 0;
        this.droneCooldown = 0;

        // Smooth physics - speed slightly reduced for control
        this.speed = 1.1; // 60 FPS scaling
        this.friction = 0.94; // smooth gliding friction
        this.acceleration = 0.08; // instant pickup
        this.dashDx = 0;
        this.dashDy = 0;

        // Better Upgrades
        this.shieldLevel = 0;
        this.shieldActive = false;
        this.shieldCooldown = 0;
        this.freezeLevel = 0;
        this.freezeCooldown = 0;
        this.bombLevel = 0;
        this.bombCooldown = 0;

        this.upgrades = createDefaultUpgrades();
        this.hullType = 'runner';
        this.weaponType = 'auto_blaster';
        this.heat = 0;
        this.overheated = false;
        this.pendingDamageEvents = [];
        this.aimAngle = -Math.PI / 2; // Default facing UP
        this.dashDmgLevel = 0; // Initialize dash corruption damage level
        this.currentPattern = PLAYER_PATTERNS.UP;
        this.dashInputBuffer = 0;
        this.dashDx = 0;
        this.dashDy = 0;
    }

    reset(gridCols, gridRows) {
        this.x = gridCols / 2;
        this.y = gridRows / 2;
        this.vx = 0; this.vy = 0;
        this.aimAngle = -Math.PI / 2; // Default facing UP
        this.dashDmgLevel = 0; // Reset dash corruption damage level
        const hull = HULL_DEFS[this.hullType] || HULL_DEFS.runner;
        this.maxHp = hull.maxHp;
        this.hp = this.maxHp;
        this.score = 0;
        this.xp = 0;
        this.level = 1;
        this.xpToNextLevel = PROGRESSION_CONFIG.startingXp;
        this.pendingLevelUp = false;
        this.pendingLevelUps = 0;
        this.fireCooldown = 0;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashGhosts = [];
        this.hasHelperDrones = 0;
        this.hasElectricDischarge = 0;
        this.electricCooldown = 0;
        this.droneCooldown = 0;
        this.shieldLevel = 0;
        this.shieldActive = false;
        this.shieldCooldown = 0;
        this.freezeLevel = 0;
        this.freezeCooldown = 0;
        this.bombLevel = 0;
        this.bombCooldown = 0;
        this.upgrades = createDefaultUpgrades();
        this.weaponType = hull.weapon;
        this.heat = 0;
        this.overheated = false;
        this.pendingDamageEvents = [];
        this.dashHitEnemies = new Set();
        this.dashInputBuffer = 0;
        this.dashDx = 0;
        this.dashDy = 0;
        this.recalculateStats();
    }

    recalculateStats() {
        const hull = HULL_DEFS[this.hullType] || HULL_DEFS.runner;
        const kernelMult = 1.0 + (this.upgrades.kernelOverclock || 0) * 0.1;
        const chaosSpeed = 1 + (this.upgrades.chaosSpeed || 0);
        this.speed = (hull.baseSpeed + this.upgrades.speedBoost * hull.baseSpeed * 0.15) * kernelMult * chaosSpeed;
        this.acceleration = hull.acceleration * kernelMult;
        this.dashSpeed = hull.dashDistance / 7.3;
        this.fireRate = Math.max(5, this.baseFireRate - this.upgrades.fireRateBoost * 3.0);
    }

    applyUpgrade(upgradeId) {
        stats.recordUpgrade(upgradeId);
        if (upgradeId === 'thread') this.upgrades.extraThreads++;
        else if (upgradeId === 'speed') this.upgrades.speedBoost++;
        else if (upgradeId === 'fire_rate') this.upgrades.fireRateBoost++;
        else if (upgradeId === 'heal') this.hp = Math.min(this.maxHp, this.hp + Math.max(1, Math.ceil(this.maxHp * 0.4)));
        else if (upgradeId === 'drone') this.hasHelperDrones++;
        else if (upgradeId === 'electric') this.hasElectricDischarge++;
        else if (upgradeId === 'shield') {
            this.shieldLevel++;
            if (!this.shieldActive && this.shieldCooldown <= 0) {
                this.shieldActive = true;
            }
        }
        else if (upgradeId === 'freeze') {
            this.freezeLevel++;
            this.freezeCooldown = Math.max(60, 720 - (this.freezeLevel - 1) * 120);
        }
        else if (upgradeId === 'bomb') {
            this.bombLevel++;
            this.bombCooldown = Math.max(60, 600 - (this.bombLevel - 1) * 100);
        }
        else if (upgradeId === 'dash_dmg') {
            this.dashDmgLevel++;
        }
        else if (upgradeId === 'upg_blaster_dmg') {
            this.upgrades.blasterDmg = (this.upgrades.blasterDmg || 0) + 1;
        }
        else if (upgradeId === 'upg_seeker_dmg') {
            this.upgrades.seekerDmg = (this.upgrades.seekerDmg || 0) + 1;
        }
        else if (upgradeId === 'upg_laser_dmg') {
            this.upgrades.laserDmg = (this.upgrades.laserDmg || 0) + 1;
        }
        else if (upgradeId === 'bios_cache') {
            this.upgrades.cacheOverclock = 1;
        }
        else if (upgradeId === 'bios_kernel') {
            this.upgrades.kernelOverclock = (this.upgrades.kernelOverclock || 0) + 1;
        }
        else if (upgradeId === 'bios_swap') {
            this.upgrades.swapPartition = (this.upgrades.swapPartition || 0) + 1;
            this.hp = this.maxHp;
            effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#00ff41', 40);
            if (enemies && enemies.enemies) {
                for (const e of enemies.enemies) {
                    if (e && e.x !== undefined && (!e.isTargetable || e.isTargetable()) && e.type !== 'boss_snake' && e.type !== 'boss_eye' && e.type !== 'boss_carrier') {
                        e.hp = 0; // kill standard enemies nearby
                    }
                }
            }
        }
        else if (upgradeId === 'garbage_collector') this.upgrades.garbageCollector++;
        else if (upgradeId === 'stack_canary') this.upgrades.stackCanary = 1;
        else if (upgradeId === 'segfault') this.upgrades.segfault++;
        else if (upgradeId === 'pointer_arithmetic') this.upgrades.pointerArithmetic = 1;
        else if (upgradeId === 'undefined_behavior') {
            this.upgrades.undefinedBehavior++;
            const mutation = Math.floor(Math.random() * 3);
            if (mutation === 0) {
                this.upgrades.chaosSpeed += 0.12;
            } else if (mutation === 1) {
                this.upgrades.chaosDamage += 0.2;
            } else {
                this.maxHp += 2;
                this.hp += 2;
            }
        }
        else if (upgradeId === 'fork_bomb') this.upgrades.forkBomb++;
        else if (upgradeId === 'memory_leak') this.upgrades.memoryLeak++;
        this.recalculateStats();
    }

    gainXp(amount) {
        this.xp += amount;
        let gained = 0;
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.level++;
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * PROGRESSION_CONFIG.xpGrowth);
            this.pendingLevelUps++;
            stats.recordLevel();
            gained++;
        }
        this.pendingLevelUp = this.pendingLevelUps > 0;
        return gained > 0;
    }

    consumeLevelUp() {
        if (this.pendingLevelUps <= 0) return false;
        this.pendingLevelUps--;
        this.pendingLevelUp = this.pendingLevelUps > 0;
        return true;
    }

    getHitbox() {
        // Generous hitbox covering the 3x3 ship body so hits register properly
        return { x: this.x + 0.2, y: this.y + 0.2, width: 2.6, height: 2.6 };
    }

    takeDamage(amount, source = 'unknown') {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.shieldCooldown = Math.max(120, 600 - (this.shieldLevel - 1) * 120);
            this.invincibilityTimer = 40; // short invincibility frame
            audio.playUpgradeSelect();
            effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#00ff41', 15);
            if (this.upgrades.stackCanary && enemies?.projectiles) {
                const px = this.x + 1.5;
                const py = this.y + 1.5;
                for (let i = enemies.projectiles.length - 1; i >= 0; i--) {
                    const p = enemies.projectiles[i];
                    if (Math.hypot(p.x - px, p.y - py) <= 18) enemies.projectiles.splice(i, 1);
                }
                effects.spawnGlitchExplosion(px, py, '#55dfff', 24);
            }
            return false; // blocks damage
        }
        if (this.invincibilityTimer > 0) return false;
        this.hp -= amount;
        stats.recordDamageTaken(amount);
        this.invincibilityTimer = this.invincibilityDuration;
        this.pendingDamageEvents.push({ amount, source });
        return true;
    }

    consumeDamageEvents() {
        const events = this.pendingDamageEvents;
        this.pendingDamageEvents = [];
        return events;
    }

    update(moveVec, gridCols, gridRows, weaponsInstance, enemiesList) {
        const frameStartX = this.x;
        const frameStartY = this.y;
        const dashActiveAtFrameStart = this.dashTimer > 0;
        if (this.invincibilityTimer > 0) this.invincibilityTimer--;
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.dashCooldown > 0) this.dashCooldown--;
        this.heat = Math.max(0, this.heat - (this.overheated ? 1.8 : 1.05));
        if (this.overheated && this.heat <= 30) this.overheated = false;

        if (input.justPressedDash()) {
            this.dashInputBuffer = 6; // buffer for 6 frames (100ms)
        }

        // Trigger Dash
        if (this.dashInputBuffer > 0 && this.dashCooldown === 0 && this.dashTimer === 0) {
            this.dashInputBuffer = 0;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = 72;
            this.dashHitEnemies = new Set();
            audio.playDash();
            stats.recordDash();

            let dx = moveVec.x;
            let dy = moveVec.y;
            if (dx === 0 && dy === 0) {
                // Dash in shooting direction or facing direction
                const shootVec = input.getShootingVector();
                if (shootVec) {
                    dx = shootVec.x;
                    dy = shootVec.y;
                } else {
                    dx = Math.cos(this.aimAngle);
                    dy = Math.sin(this.aimAngle);
                }
            }
            this.vx = dx * this.dashSpeed;
            this.vy = dy * this.dashSpeed;
            this.dashDx = dx;
            this.dashDy = dy;
        }

        if (this.dashInputBuffer > 0) {
            this.dashInputBuffer--;
        }

        // Check if inside a static glitch obstacle field (slowing penalty!)
        const cx_cell = Math.floor(this.x + this.width / 2);
        const cy_cell = Math.floor(this.y + this.height / 2);
        let insideGlitchField = false;
        if (cx_cell >= 0 && cx_cell < gridCols && cy_cell >= 0 && cy_cell < gridRows) {
            if (matrixRain.obstacles?.[cx_cell]?.[cy_cell]) {
                insideGlitchField = true;
            }
        }

        // Apply normal physics if not dashing
        if (this.dashTimer > 0) {
            const remainingBeforeStep = this.dashTimer;
            this.dashTimer--;
            this.invincibilityTimer = Math.max(this.invincibilityTimer, this.dashTimer + 6);
            // Spawn smear frames
            this.dashGhosts.push({ x: this.x, y: this.y, pattern: this.currentPattern, life: 12 });
            // Flashy spark particle trail
            effects.spawnImpactSparks(this.x + 1.5, this.y + 1.5, '#00ff41');

            const currentDashSpd = this.dashSpeed * (remainingBeforeStep > 2 ? 1 : 0.65);
            this.vx = (this.dashDx || 0) * currentDashSpd;
            this.vy = (this.dashDy || 0) * currentDashSpd;

            // Dash corruption damage check
            const dashDamage = this.dashDmgLevel * 6.0 + (this.upgrades.segfault || 0) * 2.0;
            if (dashDamage > 0 && enemiesList) {
                const px = this.x + 1.5;
                const py = this.y + 1.5;
                const dashRadius = 2.8;
                for (const e of enemiesList) {
                    if (!e || e.x === undefined || e.y === undefined || e.type === undefined || (e.isTargetable && !e.isTargetable())) continue;
                    const ew = e.width !== undefined ? e.width : 1;
                    const ex = e.x + ew / 2;
                    const ey = e.y + (e.height !== undefined ? e.height : 1) / 2;
                    const dist = Math.sqrt((ex - px) * (ex - px) + (ey - py) * (ey - py));
                    if (dist <= dashRadius + (ew / 2) && !this.dashHitEnemies.has(e)) {
                        this.dashHitEnemies.add(e);
                        e.takeDamage({ amount: dashDamage, source: 'player_dash', damageType: 'dash', hitX: ex, hitY: ey, directionX: this.dashDx, directionY: this.dashDy, force: this.dashSpeed });
                        effects.spawnImpactSparks(ex, ey);
                    }
                }
            }
        } else {
            let accel = this.acceleration;
            let maxSpd = this.speed;
            let fric = this.friction;
 
            if (insideGlitchField) {
                accel *= 0.4;
                maxSpd *= 0.5;
                fric *= 0.7; // stronger friction inside glitch field
            }
            const growthMultiplier = ecosystem.movementMultiplier(cx_cell, cy_cell);
            accel *= growthMultiplier;
            maxSpd *= growthMultiplier;
 
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

        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;
        if (dashActiveAtFrameStart || this.dashTimer > 0) {
            const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy))));
            for (let step = 0; step < steps; step++) {
                this.x += this.vx / steps;
                this.y += this.vy / steps;
                for (let ox = 0; ox < this.width; ox++) for (let oy = 0; oy < this.height; oy++) {
                    const gx = Math.floor(this.x + ox);
                    const gy = Math.floor(this.y + oy);
                    if (matrixRain.obstacles?.[gx]?.[gy]) {
                        matrixRain.damageObstacle(gx, gy, 999);
                        effects.spawnImpactSparks(gx, gy, '#55dfff');
                    }
                    if (ecosystem.damageTerrain(gx, gy, 4)) effects.spawnImpactSparks(gx, gy, '#8cff7a');
                }
            }
        } else {
        let collides = false;
        
        for (let dx = 0; dx < this.width; dx++) {
            for (let dy = 0; dy < this.height; dy++) {
                const px_cell = Math.floor(nextX + dx);
                const py_cell = Math.floor(nextY + dy);
                if (px_cell >= 0 && px_cell < gridCols && py_cell >= 0 && py_cell < gridRows) {
                    if (matrixRain.obstacles?.[px_cell]?.[py_cell]) {
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
        }

        // Keep inside bounds
        if (this.x < 1) { this.x = 1; this.vx *= -0.5; }
        if (this.x > gridCols - this.width - 1) { this.x = gridCols - this.width - 1; this.vx *= -0.5; }
        if (this.y < 1) { this.y = 1; this.vy *= -0.5; }
        if (this.y > gridRows - this.height - 1) { this.y = gridRows - this.height - 1; this.vy *= -0.5; }
        stats.recordDistance(Math.hypot(this.x - frameStartX, this.y - frameStartY));

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
                    if (!e || e.x === undefined || e.y === undefined) continue;
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
                        const droneAngle = (renderer.animationTime * 0.05) + i * (Math.PI * 2 / this.hasHelperDrones);
                        const dx = Math.cos(droneAngle) * 4;
                        const dy = Math.sin(droneAngle) * 4;
                        const droneX = px + dx;
                        const droneY = py + dy;
 
                        const ew = closest.width !== undefined ? closest.width : 1;
                        const eh = closest.height !== undefined ? closest.height : 1;
                        const aimAngle = Math.atan2(closest.y + eh/2 - droneY, closest.x + ew/2 - droneX);
                        weaponsInstance.projectiles.push(new ProjectileBase(
                            droneX, droneY, 
                            Math.cos(aimAngle) * 0.5, Math.sin(aimAngle) * 0.5, // increased launch speed
                            { damage: 1.5, type: 'rocket', life: 180 }
                        ));
                    }
                    audio.playShoot('bullet');
                    this.droneCooldown = 90; // 60 FPS scaling
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
                const nearby = enemiesList
                    .filter(e => e && e.x !== undefined && e.y !== undefined && (!e.isTargetable || e.isTargetable()))
                    .map(e => ({ e, d: Math.hypot(e.x + e.width / 2 - px, e.y + e.height / 2 - py) }))
                    .filter(entry => entry.d < 20)
                    .sort((a, b) => a.d - b.d);
                for (const { e } of nearby) {
                    if (!e || e.x === undefined || e.y === undefined || (e.isTargetable && !e.isTargetable())) continue;
                    const ew = e.width !== undefined ? e.width : 1;
                    const eh = e.height !== undefined ? e.height : 1;
                    const dx = e.x + ew/2 - px;
                    const dy = e.y + eh/2 - py;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 20) {
                        // Apply damage
                        e.takeDamage({ amount: 1.5 * this.hasElectricDischarge, source: 'tesla', damageType: 'electric', hitX: e.x + e.width / 2, hitY: e.y + e.height / 2 });
                        // Trigger lightning effect in canvas
                        effects.spawnLightningArc(px, py, e.x + ew/2, e.y + eh/2);
                        zapped++;
                        if (zapped >= 2 + this.hasElectricDischarge) break;
                    }
                }
                if (zapped > 0) {
                    audio.playHit();
                    this.electricCooldown = 120; // 60 FPS scaling
                }
            }
        }
 
        // 1. Shield Matrix Recharge
        if (this.shieldLevel > 0 && !this.shieldActive) {
            this.shieldCooldown--;
            if (this.shieldCooldown <= 0) {
                this.shieldActive = true;
                effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#00ff41', 8);
            }
        }
 
        // 2. System Freeze Active check
        if (this.freezeLevel > 0) {
            this.freezeCooldown--;
            if (this.freezeCooldown <= 0) {
                for (const e of enemiesList) {
                    if (!e || (e.isActive && !e.isActive())) continue;
                    if (BOSS_TYPES.has(e.type)) continue;
                    e.frozenTimer = 180; // 3 seconds freeze
                    const ew = e.width !== undefined ? e.width : 1;
                    const eh = e.height !== undefined ? e.height : 1;
                    effects.spawnGlitchExplosion(e.x + ew / 2, e.y + eh / 2, '#00ff41', 6);
                }
                effects.triggerFlash();
                audio.playUpgradeSelect();
                this.freezeCooldown = Math.max(120, 720 - (this.freezeLevel - 1) * 120);
            }
        }
 
        // 3. Stack Flush Bomb shockwave check
        if (this.bombLevel > 0) {
            this.bombCooldown--;
            if (this.bombCooldown <= 0) {
                const px = this.x + this.width / 2;
                const py = this.y + this.height / 2;
                const bombRadius = 20 + (this.bombLevel - 1) * 4;
                
                // Clear enemy projectiles within radius 20
                if (enemies && enemies.projectiles) {
                    for (let i = enemies.projectiles.length - 1; i >= 0; i--) {
                        const proj = enemies.projectiles[i];
                        if (!proj || proj.x === undefined || proj.y === undefined) continue;
                        const dx = proj.x - px;
                        const dy = proj.y - py;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist <= bombRadius) {
                            effects.spawnImpactSparks(proj.x, proj.y);
                            enemies.projectiles.splice(i, 1);
                        }
                    }
                }
                
                // Deal damage and knockback to enemies within radius 20
                for (const e of enemiesList) {
                    if (!e || e.x === undefined || e.y === undefined || (e.isTargetable && !e.isTargetable())) continue;
                    const ew = e.width !== undefined ? e.width : 1;
                    const eh = e.height !== undefined ? e.height : 1;
                    const dx = (e.x + ew / 2) - px;
                    const dy = (e.y + eh / 2) - py;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist <= bombRadius) {
                        e.takeDamage({ amount: 5 + (this.bombLevel - 1) * 2, source: 'stack_flush', damageType: 'splash', hitX: e.x + e.width / 2, hitY: e.y + e.height / 2 });
                        e.applyKnockback(dx * 0.15, dy * 0.15);
                        effects.spawnGlitchExplosion(e.x + ew / 2, e.y + eh / 2, '#ff3366', 8);
                    }
                }
                
                // Visual boom shockwave particles
                effects.spawnGlitchExplosion(px, py, '#00ff41', 25);
                renderer.triggerShake(12, 4);
                audio.playShoot('cannon');
                
                this.bombCooldown = Math.max(120, 600 - (this.bombLevel - 1) * 100);
            }
        }
    }

    stampToGrid(rendererInstance) {
        const px = this.x + this.width / 2;
        const py = this.y + this.height / 2;
        const shootVec = input.getShootingVector();
        let angle = this.aimAngle;
        if (shootVec) {
            angle = Math.atan2(shootVec.y, shootVec.x);
        }
        if (isNaN(angle)) {
            angle = -Math.PI / 2;
        }
        this.aimAngle = angle;
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
                        rendererInstance.customColors[gx][gy] = PALETTE.player;
                    }
                }
            }
        }

        // 2. Stamp helper drones
        for (let i = 0; i < this.hasHelperDrones; i++) {
            const droneAngle = (rendererInstance.animationTime * 0.05) + i * (Math.PI * 2 / this.hasHelperDrones);
            const dx = Math.cos(droneAngle) * 4;
            const dy = Math.sin(droneAngle) * 4;
            const dGridX = Math.floor(px + dx);
            const dGridY = Math.floor(py + dy);

            if (dGridX >= 0 && dGridX < rendererInstance.cols && dGridY >= 0 && dGridY < rendererInstance.rows) {
                rendererInstance.types[dGridX][dGridY] = RENDER_CELL_TYPES.GLITCH;
                rendererInstance.chars[dGridX][dGridY] = '+';
                rendererInstance.brightness[dGridX][dGridY] = 0.8;
                rendererInstance.customColors[dGridX][dGridY] = PALETTE.pickup;
            }
        }

        // 3. Stamp ship
        if (this.invincibilityTimer > 0 && Math.floor(this.invincibilityTimer / 4) % 2 === 0 && this.dashTimer === 0) return;

        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);

        for (let row = 0; row < this.height; row++) {
            for (let col = 0; col < this.width; col++) {
                let char = this.currentPattern[row][col];
                if (char === ' ') continue;

                // Make player ship characters glitch/change constantly to look alive
                const glitchChance = this.invincibilityTimer > 0 ? 0.16 : 0.025;
                if (Math.random() < glitchChance) {
                    const GLITCH_GLYPHS = '▲▼◀▶║═╔╗╚╝░▒▓█⌗*+';
                    char = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
                }

                const gx = ix + col;
                const gy = iy + row;

                if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                    rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.GLITCH;
                    rendererInstance.chars[gx][gy] = char;
                    rendererInstance.brightness[gx][gy] = 1.0;
                    rendererInstance.customColors[gx][gy] = PALETTE.player;
                }
            }
        }

        // 4. Stamp animated engine fire trail
        const isMoving = Math.sqrt(this.vx * this.vx + this.vy * this.vy) > 0.05;
        const numFireParticles = isMoving ? 3 : 1;
        for (let i = 0; i < numFireParticles; i++) {
            const dist = 1.2 + Math.random() * (isMoving ? 1.5 : 0.5);
            const fx = Math.floor(px - Math.cos(angle) * dist + (Math.random() - 0.5) * 1.0);
            const fy = Math.floor(py - Math.sin(angle) * dist + (Math.random() - 0.5) * 1.0);
            
            if (fx >= 0 && fx < rendererInstance.cols && fy >= 0 && fy < rendererInstance.rows) {
                rendererInstance.types[fx][fy] = RENDER_CELL_TYPES.GLITCH;
                rendererInstance.chars[fx][fy] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                rendererInstance.brightness[fx][fy] = isMoving ? (0.6 + Math.random() * 0.4) : (0.2 + Math.random() * 0.2);
                rendererInstance.customColors[fx][fy] = PALETTE.playerShot;
            }
        }

        // 5. Stamp rotating Shield Matrix circular outline
        if (this.shieldActive) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                // Slight spin offset using current time
                const rotAngle = a + rendererInstance.animationTime * 0.025;
                const sx = Math.floor(ix + 1.5 + Math.cos(rotAngle) * 2.6);
                const sy = Math.floor(iy + 1.5 + Math.sin(rotAngle) * 2.6);
                
                if (sx >= 0 && sx < rendererInstance.cols && sy >= 0 && sy < rendererInstance.rows) {
                    rendererInstance.types[sx][sy] = RENDER_CELL_TYPES.GLITCH;
                    
                    let shieldChar = '◦';
                    const cosVal = Math.cos(rotAngle);
                    if (cosVal < -0.5) shieldChar = '(';
                    else if (cosVal > 0.5) shieldChar = ')';
                    else shieldChar = '=';

                    rendererInstance.chars[sx][sy] = shieldChar;
                    rendererInstance.brightness[sx][sy] = 0.85;
                    rendererInstance.customColors[sx][sy] = PALETTE.pickup;
                }
            }
        }
    }
}
export const player = new Player();
export { SHIP_WIDTH as PLAYER_SHIP_WIDTH };
