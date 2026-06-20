import { renderer, RENDER_CELL_TYPES } from './renderer.js';
import { effects } from './effects.js';
import { matrixRain } from './matrixRain.js';
import { audio } from './audio.js';
import { BOSS_TYPES, COMBAT_CONFIG, ECOSYSTEM_TYPES, ENEMY_DEFS, NORMAL_ENEMY_TYPES, PALETTE } from './config.js';
import { stats } from './stats.js';
import { createBiology, damageOrgan, getGenomeModifiers, hashSeed, normalizeDamageContext, organModifier, OrganState, renderCreatureBody, SpeciesFamily } from './biology.js';
import { evolution } from './evolution.js';
import { colonyMind } from './colonyMind.js';
import { ecosystem } from './ecosystem.js';

const GLYPHS = '01.:;|/\\-_';
const BRUTE_GLYPHS = ['█', '▓', '▒', '░', '#', '■', '▪', ' ', '█', '█'];

const DRONE_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const BRUTE_CHARS = ['█', '▓', '▒', '░', '☣', '☠', '✖', '†', '#'];
const BRUTE_MED_CHARS = ['█', '▓', '▒', '░', '✖', '†', '#'];
const SHOOTER_CHARS = ['B', 'U', 'G', 'E', 'R', 'R', 'P', 'T', 'R', 'V', 'O', 'I', 'D'];
const WORM_CHARS = ['S', 'N', 'A', 'K', 'E', '8', 's', 'o', '0'];
const VIRUS_CHARS = ['☣', '☠', '✖', '†', '‡', '§', '¶', '?', '*'];
const BOSS_HEAD_CHARS = ['█', '☣', '☠', '⚔', '✖', '☠', '☣'];
const BOSS_SEG_CHARS = ['F','A','T','A','L','E','R','R','O','R','C','R','A','S','H'];
const FAMILY_COLORS = Object.freeze({
    skitter: '#ff355d', bloomcaster: '#ff3dbb', ribbon: '#d92f63', prism: '#ff82c8',
    carapace: '#b91f49', burst_sac: '#ff9b32', rootweaver: '#52d6c7',
    spore: '#79a86b', colony: '#568b63', parasite: '#bd62ff', amalgam: '#d84592',
    serpent: '#ff214f', watcher: '#ff4fb8', carrier: '#c72768'
});

export const SpawnLifecycle = Object.freeze({
    RESERVED: 'reserved', GERMINATING: 'germinating', ACTIVE: 'active', DYING: 'dying'
});

export const BehaviorState = Object.freeze({
    EMERGE: 'emerge', SEEK: 'seek', PREPARE: 'prepare', COMMIT: 'commit',
    RECOVER: 'recover', RETREAT: 'retreat', DISABLED: 'disabled'
});

export class EnemySpawnRequest {
    constructor(x, y, type, options = {}) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.source = options.source || 'system';
        this.encounterId = options.encounterId || null;
        this.safeRadius = options.safeRadius ?? COMBAT_CONFIG.spawnSafeRadius;
        this.emergenceTicks = Math.max(0, Math.round(options.emergenceTicks
            ?? options.birthTimer
            ?? (BOSS_TYPES.has(type) ? COMBAT_CONFIG.bossEmergenceTicks : COMBAT_CONFIG.normalEmergenceTicks)));
        this.options = options;
    }
}

function get8WayDirection(vx, vy) {
    let angle = Math.atan2(vy, vx);
    if (angle < 0) angle += Math.PI * 2;
    const step = Math.PI / 4;
    const index = Math.round(angle / step) % 8;
    return ['RIGHT', 'DOWN_RIGHT', 'DOWN', 'DOWN_LEFT', 'LEFT', 'UP_LEFT', 'UP', 'UP_RIGHT'][index];
}

// Stamping organic wobbly metaball blob shapes on the ASCII grid
function stampOrganicBlob(rendererInstance, cx, cy, baseRadius, charSet = GLYPHS, brightnessMult = 1.0, directionVec = null) {
    const radius = Math.ceil(baseRadius + 1.8);
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist === 0) continue;

            const angle = Math.atan2(dy, dx);
            // Wobbles with time and angle to make it organic/pulsating
            const wobble = Math.sin(angle * 5 + rendererInstance.animationTime * 0.11) * 0.7;
            
            // Add direction extension spike if vector is provided
            let spike = 0;
            if (directionVec) {
                const targetAngle = Math.atan2(directionVec.y, directionVec.x);
                const diff = Math.cos(angle - targetAngle);
                if (diff > 0.6) spike = 0.9;
            }

            const currentRadius = baseRadius + wobble + spike;

            if (dist <= currentRadius) {
                const gx = icx + dx;
                const gy = icy + dy;

                if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                    const animFrame = Math.floor(rendererInstance.animationTime / 13);
                    const charIndex = Math.abs(gx * 31 + gy * 17 + animFrame) % charSet.length;
                    const char = charSet[charIndex];
                    rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                    rendererInstance.chars[gx][gy] = char;
                    rendererInstance.brightness[gx][gy] = (0.72 + ((charIndex % 3) * 0.1)) * brightnessMult;
                }
            }
        }
    }
}

function stampPattern(rendererInstance, x, y, rows, brightness = 1, color = PALETTE.enemy) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].length; col++) {
            const char = rows[row][col];
            if (char === ' ') continue;
            const gx = ix + col;
            const gy = iy + row;
            if (gx < 0 || gx >= rendererInstance.cols || gy < 0 || gy >= rendererInstance.rows) continue;
            rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
            rendererInstance.chars[gx][gy] = char;
            rendererInstance.brightness[gx][gy] = brightness;
            rendererInstance.customColors[gx][gy] = color;
        }
    }
}

function stampOrganicBoss(enemy, rendererInstance, brightness, blink, wounded) {
    const rows = renderCreatureBody(enemy, rendererInstance.animationTime) || [];
    const bodyWidth = Math.max(1, ...rows.map(row => row.length));
    const bx = enemy.x + Math.floor((enemy.width - bodyWidth) / 2);
    const by = enemy.y + Math.floor((enemy.height - rows.length) / 2);
    stampPattern(rendererInstance, bx, by, rows, brightness, enemy.color);
    const state = id => enemy.organs?.find(entry => entry.id === id)?.state || OrganState.HEALTHY;
    const living = (id, glyph) => [OrganState.RUPTURED, OrganState.SEVERED].includes(state(id)) ? 'x' : state(id) === OrganState.WOUNDED ? ':' : glyph;
    if (enemy.type === 'boss_snake') {
        for (let i = 7; i < enemy.trail.length; i += enemy.phase === 2 ? 11 : 8) {
            const pos = enemy.trail[i];
            const phase = Math.floor(rendererInstance.animationTime / 5 + i) % 3;
            const cluster = phase === 0 ? [' ~=:', '  %~'] : phase === 1 ? [' :=% ', '~='] : [' %~', '=::~'];
            stampPattern(rendererInstance, pos.x + enemy.width * 0.3, pos.y + enemy.height * 0.3, cluster, Math.max(0.3, brightness * (1 - i / enemy.trail.length)), enemy.color);
        }
        const contraction = enemy.attackState === 'charge'
            ? ['  !  ', ':%%%:', ' ~=~ ']
            : blink ? [' ~:~ ', `:${living('core', '%')}:`, '  =  '] : ['  ~  ', `~${living('core', '%')}~`, ' :=: '];
        stampPattern(rendererInstance, enemy.x + enemy.width * 0.38, enemy.y + enemy.height * 0.32, contraction, 1, enemy.attackState === 'charge' ? PALETTE.enemyShot : PALETTE.boss);
        stampPattern(rendererInstance, enemy.x + (enemy.genome.bias > 0 ? enemy.width - 3 : 2), enemy.y + 2, [living('sense', blink ? '*' : ':')], 1, '#ff9de2');
    } else if (enemy.type === 'boss_eye') {
        const lobes = enemy.phase === 2 ? Math.min(5, 2 + enemy.genome.tendrilCount) : 3;
        for (let i = 0; i < lobes; i++) {
            const angle = i / lobes * Math.PI * 2 + rendererInstance.animationTime * 0.012 * enemy.genome.bias;
            const lx = enemy.x + enemy.width / 2 + Math.cos(angle) * (enemy.width * 0.3 + i % 2 * 2);
            const ly = enemy.y + enemy.height / 2 + Math.sin(angle) * (enemy.height * 0.22 + i % 2);
            const lobe = i % 2 ? [blink ? ': *' : '* :', ' : '] : [blink ? '*:' : ':*', ' :'];
            stampPattern(rendererInstance, lx - 1, ly, lobe, 0.74, state('lobe') === OrganState.HEALTHY ? enemy.color : '#9b315f');
        }
        const focus = living('core', enemy.attackState === 'gaze' ? '!' : '*');
        const sensory = enemy.phase === 2
            ? [blink ? ':  * :  x' : 'x :  *  :', `   :${focus}:   `, blink ? 'x :  :  *' : '*  : : x']
            : [blink ? ' : * : ' : '* : : *', `  :${focus}:  `, blink ? '* : : *' : ' : * : '];
        stampPattern(rendererInstance, enemy.x + enemy.width / 2 - 4, enemy.y + enemy.height / 2 - 1, sensory, 1, enemy.attackState === 'gaze' ? PALETTE.enemyShot : PALETTE.boss);
    } else if (enemy.type === 'boss_carrier') {
        const bay = living('bay', blink ? 'o' : '%');
        const heart = living('core', enemy.phase === 2 ? (blink ? '@' : '*') : '%');
        stampPattern(rendererInstance, enemy.x + 2, enemy.y + 3, [`:${bay}:`, blink ? '% ::' : ':: %', ' :%'], 0.9, enemy.color);
        stampPattern(rendererInstance, enemy.x + enemy.width - 7, enemy.y + enemy.height - 6, [`${bay}:`, blink ? ':: %' : '% ::', ': %'], 0.9, enemy.color);
        const heartOrgan = enemy.organs?.find(entry => entry.id === 'core');
        const heartX = enemy.x + Math.floor((heartOrgan?.x ?? 9) - 2);
        const heartY = enemy.y + Math.floor((heartOrgan?.y ?? 5) - 1);
        stampPattern(rendererInstance, heartX, heartY, [blink ? ':% :' : '% ::', ` :${heart}: `, blink ? ':: %' : ': %:'], 1, PALETTE.boss);
        if (enemy.attackState === 'broadside' && enemy.broodType) {
            const broodGlyph = enemy.broodType === 'virus' ? '+' : enemy.broodType === 'kamikaze' ? '!' : '~';
            stampPattern(rendererInstance, enemy.x + 2, enemy.y + 1, [`:${broodGlyph}  ${broodGlyph}:`], 1, PALETTE.enemyShot);
            stampPattern(rendererInstance, enemy.x + enemy.width - 7, enemy.y + enemy.height - 4, [`${broodGlyph}: ${broodGlyph}`], 1, PALETTE.enemyShot);
        }
        stampPattern(rendererInstance, enemy.x + enemy.width * 0.25, enemy.y + enemy.height - 2, [blink ? 'Y  :   Y  |' : '|   Y  :  Y'], 0.65, '#ff9de2');
        if (enemy.broodRuptured) stampPattern(rendererInstance, enemy.x + 3, enemy.y + 3, ['x : x', ' ,x, '], 1, '#ff9de2');
    }
    for (const point of enemy.weakPoints || []) {
        if (enemy.phase < point.phase) continue;
        stampPattern(rendererInstance, enemy.x + Math.floor(point.x + point.width / 2), enemy.y + Math.floor(point.y + point.height / 2), [blink ? '*' : ':'], 1, '#ffd0e8');
    }
    if (enemy.signal) stampPattern(rendererInstance, enemy.x + enemy.width / 2, enemy.y - 2, [enemy.signal], 1, PALETTE.enemyShot);
}

export class EnemyProjectile {
    constructor(x, y, vx, vy, isHoming = false) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = PALETTE.enemyShot;
        this.damage = 1;
        this.life = 120;
        this.isHoming = isHoming;
    }

    update(playerInstance) {
        if (this.isHoming && playerInstance) {
            const targetX = playerInstance.x + 1.5;
            const targetY = playerInstance.y + 1.5;
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0.1) {
                const targetVx = (dx / dist) * 0.28;
                const targetVy = (dy / dist) * 0.28;
                this.vx = this.vx * 0.95 + targetVx * 0.05;
                this.vy = this.vy * 0.95 + targetVy * 0.05;
            }
        }
        this.x += this.vx; this.y += this.vy;
        this.life--;
    }

    stampToGrid(rendererInstance) {
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        if (ix >= 0 && ix < rendererInstance.cols && iy >= 0 && iy < rendererInstance.rows) {
            rendererInstance.types[ix][iy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
            rendererInstance.chars[ix][iy] = '☼';
            rendererInstance.brightness[ix][iy] = 1.0;
            rendererInstance.customColors[ix][iy] = this.color;
        }
    }

    getHitbox() {
        return {
            x: this.x - 0.2,
            y: this.y - 0.2,
            width: 0.4,
            height: 0.4,
            isCircle: false
        };
    }
}

export class Enemy {
    constructor(x, y, type = 'drone', options = {}) {
        this.x = x; this.y = y;
        this.type = type;
        
        this.vx = 0; this.vy = 0;
        this.hp = 1; this.maxHp = 1;
        this.xpValue = 10;
        
        this.fireCooldown = 30 + Math.random() * 60; // faster fire rate for bullet hell
        this.color = '#ff3366';

        // Physics
        this.mass = 1.0;
        this.friction = 0.92; // 60 FPS scaling

        this.trail = [];
        this.waveTime = Math.random() * 10;
        this.replicateTimer = 360 + Math.random() * 180; // 60 FPS scaling
        this.frozenTimer = 0;
        this.shielded = false;
        this.linkedTargets = [];
        this.detonationTimer = null;
        this.detonated = false;
        this.introTimer = 0;
        this.phase = 1;
        this.phaseTransitionTimer = 0;
        this.attackState = 'idle';
        this.attackStateTimer = 0;
        this.lungeTimer = 0;
        this.telegraphTimer = 0;
        this.lockedAimAngle = 0;
        this.weakPoints = [];
        this.attackCycle = 0;
        this.energy = 0;
        this.parasiteCount = 0;
        this.symbioteBoosted = false;
        this.armorFacingAngle = 0;
        this.inheritedFamilies = options.inheritedFamilies || [];
        this.genomeSeed = options.seed ?? hashSeed(`${type}:${Math.round(x * 10)}:${Math.round(y * 10)}`);
        this.inheritedAdaptations = options.adaptations || [];
        this.packId = null;
        this.packRole = null;
        this.signal = null;
        this.signalTimer = 0;
        this.socialTarget = null;
        this.intentOffset = null;
        this.consumed = false;
        this.deathState = null;
        this.rewardedOrganStates = new Set();
        this.impactTimer = 0;
        this.impactDirectionX = 0;
        this.impactDirectionY = 0;
        this.spawnSource = options.source || 'direct';
        this.encounterId = options.encounterId || null;
        this.spawnSafeRadius = options.safeRadius ?? COMBAT_CONFIG.spawnSafeRadius;
        this.emergenceTotal = Math.max(0, options.emergenceTicks ?? 0);
        this.emergenceTimer = this.emergenceTotal;
        this.birthTimer = this.emergenceTimer;
        this.spawnLifecycle = this.emergenceTimer > 0 ? SpawnLifecycle.GERMINATING : SpawnLifecycle.ACTIVE;
        this.behaviorState = this.emergenceTimer > 0 ? BehaviorState.EMERGE : BehaviorState.SEEK;

        this.initType();
    }

    initType() {
        this.life = 0;
        const def = ENEMY_DEFS[this.type] || ENEMY_DEFS.drone;
        this.hp = def.hp;
        this.xpValue = def.xp;
        this.width = def.width;
        this.height = def.height;
        this.mass = def.mass;
        if (this.type === 'kamikaze') this.color = PALETTE.enemyShot;
        if (this.type === 'shield_projector') this.color = PALETTE.pickup;
        if (BOSS_TYPES.has(this.type)) this.color = PALETTE.boss;
        if (this.type === 'boss_snake') this.weakPoints = [{ x: this.width * 0.36, y: this.height * 0.22, width: 4, height: 3, phase: 1 }];
        if (this.type === 'boss_eye') this.weakPoints = [{ x: this.width * 0.42, y: this.height * 0.38, width: 4, height: 4, phase: 1 }];
        if (this.type === 'boss_carrier') this.weakPoints = [{ x: this.width * 0.4, y: this.height * 0.38, width: 6, height: 4, phase: 2 }];
        this.maxHp = this.hp;
        const biology = createBiology(this.type, this.genomeSeed, this.width, this.height, this.inheritedAdaptations);
        this.genome = biology.genome;
        this.bodyPlan = biology.bodyPlan;
        this.organs = biology.bodyPlan.organs;
        this.color = FAMILY_COLORS[this.genome.family] || this.color;
        if (this.type === 'kamikaze') this.color = PALETTE.enemyShot;
        if (BOSS_TYPES.has(this.type)) this.color = FAMILY_COLORS[this.genome.family] || PALETTE.boss;
        this.coordinationRadius = 18 * getGenomeModifiers(this.genome).link;
    }

    applyKnockback(impactVx, impactVy) {
        if (!this.isActive()) return;
        this.vx += impactVx / this.mass;
        this.vy += impactVy / this.mass;
    }

    isActive() {
        return this.spawnLifecycle === SpawnLifecycle.ACTIVE && this.hp > 0;
    }

    isTargetable() {
        return this.isActive() && this.introTimer <= 0;
    }

    setBehaviorState(state) {
        this.behaviorState = state;
    }

    update(playerX, playerY, gridCols, gridRows, spawnedProjectiles, enemyManager) {
        this.life++;
        if (this.impactTimer > 0) this.impactTimer--;
        this.lastPlayerX = playerX;
        this.lastPlayerY = playerY;
        if (this.spawnLifecycle === SpawnLifecycle.RESERVED) {
            this.spawnLifecycle = this.emergenceTimer > 0 ? SpawnLifecycle.GERMINATING : SpawnLifecycle.ACTIVE;
        }
        if (this.spawnLifecycle === SpawnLifecycle.GERMINATING) {
            this.behaviorState = BehaviorState.EMERGE;
            this.vx = 0;
            this.vy = 0;
            this.birthTimer = this.emergenceTimer;
            if (this.emergenceTimer > 0) this.emergenceTimer--;
            if (this.emergenceTimer <= 0) {
                this.birthTimer = 0;
                this.spawnLifecycle = SpawnLifecycle.ACTIVE;
                this.behaviorState = BehaviorState.SEEK;
                this.signal = this.genome.bias > 0 ? '>' : '<';
                this.signalTimer = 18;
            }
            return;
        }
        if (this.spawnLifecycle !== SpawnLifecycle.ACTIVE) return;
        if (this.attackStateTimer > 0 && --this.attackStateTimer === 0) {
            if (this.attackState === 'release') { this.attackState = 'recover'; this.attackStateTimer = 12; }
            else if (this.attackState === 'recover') this.attackState = 'idle';
        }
        if (this.lungeTimer > 0) this.lungeTimer--;
        if (this.signalTimer > 0) this.signalTimer--;
        else this.signal = null;
        this.birthTimer = 0;
        if (this.leaking && this.life % 36 === 0) ecosystem.addNutrient(this.x + this.width / 2, this.y + this.height / 2, 0.5);
        if (this.pendingDivision && enemyManager) {
            this.pendingDivision = false;
            const child = enemyManager.spawn(this.x + this.genome.bias * 2, this.y + 1, 'virus', { seed: hashSeed(`${this.genomeSeed}:wound:${this.life}`), adaptations: this.genome.adaptations, birthTimer: 55 });
            if (child) { child.hp *= 0.45; child.maxHp = child.hp; child.signal = ':'; child.signalTimer = 50; }
        }
        if (this.pendingSegmentShed && enemyManager) {
            this.pendingSegmentShed = false;
            enemyManager.spawn(this.x - 2, this.y + this.height, 'cell_spore', { seed: hashSeed(`${this.genomeSeed}:segment:${this.life}`), birthTimer: 35 });
        }

        if (this.frozenTimer > 0) {
            this.behaviorState = BehaviorState.DISABLED;
            this.frozenTimer--;
            // Shift trail history even when frozen
            this.trail.unshift({ x: this.x, y: this.y, vx: 0, vy: 0 });
            const maxTrail = this.type === 'boss_snake' ? (this.molted ? 48 : 80) : (this.type === 'worm' ? 12 : 8);
            if (this.trail.length > maxTrail) this.trail.pop();
            return;
        }

        if (this.introTimer > 0) {
            this.introTimer--;
            this.trail.unshift({ x: this.x, y: this.y, vx: 0, vy: 0 });
            if (this.trail.length > 80) this.trail.pop();
            return;
        }

        if (BOSS_TYPES.has(this.type) && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.phaseTransitionTimer = 35;
            this.attackState = 'phase_break';
            this.fireCooldown = 70;
            effects.spawnGlitchExplosion(this.x + this.width / 2, this.y + this.height / 2, PALETTE.boss, 45);
            renderer.triggerShake(10, 2.5);
            if (this.type === 'boss_snake') {
                this.molted = true;
                this.weakPoints.push({ x: 2, y: 2, width: 3, height: 3, phase: 2 }, { x: this.width - 5, y: 4, width: 3, height: 3, phase: 2 });
                for (let i = 0; i < 3; i++) enemyManager?.spawn(this.x - 2 - i * 2, this.y + 4 + i, 'cell_spore', { seed: hashSeed(`${this.genomeSeed}:shed:${i}`) });
            } else if (this.type === 'boss_eye') {
                this.fractured = true;
                for (let i = 0; i < 2; i++) enemyManager?.spawn(this.x + (i ? this.width - 2 : -2), this.y + this.height * 0.4 + i * 3, 'virus', { seed: hashSeed(`${this.genomeSeed}:lobe:${i}`), birthTimer: 60 });
            } else if (this.type === 'boss_carrier') {
                this.broodRuptured = true;
                const shell = this.organs.find(entry => entry.effect === 'armor');
                if (shell) { shell.hp = -1; shell.state = OrganState.RUPTURED; }
                this.weakPoints.push({ x: 3, y: 3, width: 5, height: 4, phase: 2 });
            }
        }
        if (this.phaseTransitionTimer > 0) {
            this.phaseTransitionTimer--;
            this.vx *= 0.8;
            this.vy *= 0.8;
            return;
        }

        this.fireCooldown--;
        const attackOrgan = this.organs?.find(entry => entry.effect === 'fire');
        if (attackOrgan?.state === OrganState.WOUNDED && this.fireCooldown > 0) this.fireCooldown += 0.22;
        if (attackOrgan && [OrganState.RUPTURED, OrganState.SEVERED].includes(attackOrgan.state) && this.fireCooldown <= 0) {
            this.fireCooldown = 90;
            this.attackState = 'ruptured';
        }

        // Track trail history for glitch tails/worms/boss
        this.trail.unshift({ x: this.x, y: this.y, vx: this.vx, vy: this.vy });
        const maxTrail = this.type === 'boss_snake' ? (this.molted ? 48 : 80) : (this.type === 'worm' ? 12 : 8);
        if (this.trail.length > maxTrail) this.trail.pop();

        // Player center (now 3x3, center is playerX + 1.5, playerY + 1.5)
        const dx = playerX + 1.5 - (this.x + this.width / 2);
        const dy = playerY + 1.5 - (this.y + this.height / 2);
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

        this.vx *= this.friction;
        this.vy *= this.friction;

        let moveX = 0;
        let moveY = 0;

        if (this.type === 'drone') {
            this.waveTime += 0.11;
            const flank = this.genome.bias * Math.sin(this.waveTime) * 0.065;
            moveX = (dx / dist) * 0.052 - (dy / dist) * flank;
            moveY = (dy / dist) * 0.052 + (dx / dist) * flank;
            if (this.fireCooldown <= 22 && this.fireCooldown > 0 && dist < 18) {
                this.attackState = 'prepare'; this.signal = this.genome.bias > 0 ? '>' : '<'; this.signalTimer = 10;
            }
            if (this.fireCooldown <= 0 && dist < 18) {
                this.attackState = 'release'; this.attackStateTimer = 7; this.lungeTimer = 14;
                this.vx += (dx / dist) * 0.72; this.vy += (dy / dist) * 0.72;
                this.fireCooldown = 95 + (this.genomeSeed % 35);
            }
        } 
        else if (this.type === 'brute' || this.type === 'brute_medium') {
            moveX = (dx / dist) * 0.025;
            moveY = (dy / dist) * 0.025;
            if (enemyManager && this.life % 8 === 0) {
                this.linkedTargets = colonyMind.query(this.x, this.y, 8)
                    .filter(other => other?.isActive?.() && other !== this && other.genome?.family === SpeciesFamily.BLOOMCASTER)
                    .slice(0, 2);
            }
            for (const protectedEnemy of this.linkedTargets) protectedEnemy.shielded = true;
        }
        else if (this.type === 'shooter') {
            if (this.socialTarget?.isActive?.()) {
                const protector = this.socialTarget;
                const awayX = protector.x - playerX, awayY = protector.y - playerY;
                const awayDist = Math.hypot(awayX, awayY) || 1;
                const shelterX = protector.x + awayX / awayDist * 4;
                const shelterY = protector.y + awayY / awayDist * 4;
                const shelterDist = Math.hypot(shelterX - this.x, shelterY - this.y) || 1;
                moveX += (shelterX - this.x) / shelterDist * 0.035;
                moveY += (shelterY - this.y) / shelterDist * 0.035;
            }
            if (dist > 22) {
                moveX = (dx / dist) * 0.04;
                moveY = (dy / dist) * 0.04;
            } else if (dist < 12) {
                moveX = -(dx / dist) * 0.025;
                moveY = -(dy / dist) * 0.025;
            }

            if (this.fireCooldown <= 28 && this.fireCooldown > 0 && dist < 30) this.attackState = 'prepare';
            if (this.fireCooldown <= 0 && dist < 30) {
                const aimDrift = (1 - organModifier(this, 'aim')) * 0.45 * this.genome.bias;
                const baseAngle = Math.atan2(dy, dx) + aimDrift;
                for (const spread of [-0.18, 0, 0.18]) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2, 
                        Math.cos(baseAngle + spread) * 0.24, Math.sin(baseAngle + spread) * 0.24
                    ));
                }
                this.attackState = 'release'; this.attackStateTimer = 8;
                this.fireCooldown = 220 + Math.random() * 100;
            }
        }
        else if (this.type === 'worm') {
            this.waveTime += 0.07;
            const baseAngle = Math.atan2(dy, dx);
            const herdSide = this.genome.bias || 1;
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.6 + herdSide * 0.38;
            moveX = Math.cos(slitherAngle) * 0.075;
            moveY = Math.sin(slitherAngle) * 0.075;
            if (this.fireCooldown <= 26 && this.fireCooldown > 0 && dist < 20) this.attackState = 'prepare';
            if (this.fireCooldown <= 0 && dist < 20) {
                const tangentX = -(dy / dist) * herdSide;
                const tangentY = (dx / dist) * herdSide;
                this.vx += tangentX * 0.48 + dx / dist * 0.18;
                this.vy += tangentY * 0.48 + dy / dist * 0.18;
                this.attackState = 'release'; this.attackStateTimer = 12; this.lungeTimer = 18;
                this.fireCooldown = 150 + this.genomeSeed % 50;
            }
        }
        else if (this.type === 'virus') {
            if ((this.life + this.genome.pulseOffset) % 150 === 0) {
                const side = this.genome.bias;
                this.x += -(dy / dist) * 3 * side;
                this.y += (dx / dist) * 3 * side;
                this.attackState = 'divide'; this.attackStateTimer = 14;
            }

            moveX = (dx / dist) * 0.045;
            moveY = (dy / dist) * 0.045;

            if (this.fireCooldown <= 0 && dist < 28) {
                const aimDrift = (1 - organModifier(this, 'aim')) * 0.6 * this.genome.bias;
                const diagAngles = [Math.PI/4, 5*Math.PI/4];
                for (let a of diagAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(a + aimDrift) * 0.19, Math.sin(a + aimDrift) * 0.19
                    ));
                }
                this.attackState = 'release'; this.attackStateTimer = 8;
                this.fireCooldown = 200 + Math.random() * 80;
            }

            this.replicateTimer--;
            if (this.replicateTimer <= 45 && this.replicateTimer > 0) this.attackState = 'divide';
            if (this.replicateTimer <= 0) {
                this.replicateTimer = 360 + Math.random() * 180;
                if (enemyManager && enemyManager.enemies.filter(e => e.type === 'virus').length < 15) {
                    enemyManager.spawn(this.x + this.genome.bias * 4, this.y + 2, 'virus', { source: 'division', emergenceTicks: 60 });
                    effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#ff3366', 10);
                }
                this.attackState = 'recover'; this.attackStateTimer = 18;
            }
        }
        else if (this.type === 'cell_spore') {
            this.waveTime += 0.13;
            moveX = Math.cos(this.waveTime) * 0.055 + (dx / dist) * 0.018;
            moveY = Math.sin(this.waveTime * 0.83) * 0.055 + (dy / dist) * 0.018;
        }
        else if (this.type === 'cell_colony') {
            moveX = 0;
            moveY = 0;
            this.vx *= 0.4;
            this.vy *= 0.4;
        }
        else if (this.type === 'cell_parasite') {
            const host = colonyMind.query(this.x, this.y, 22)
                .filter(other => other && other !== this && NORMAL_ENEMY_TYPES.has(other.type) && !ECOSYSTEM_TYPES.has(other.type))
                .reduce((best, other) => {
                    const distance = Math.hypot(other.x - this.x, other.y - this.y);
                    return !best || distance < best.distance ? { other, distance } : best;
                }, null)?.other;
            if (host) {
                const hdx = host.x + host.width / 2 - (this.x + 0.5);
                const hdy = host.y + host.height / 2 - (this.y + 0.5);
                const hdist = Math.hypot(hdx, hdy) || 1;
                moveX = (hdx / hdist) * 0.095;
                moveY = (hdy / hdist) * 0.095;
            } else {
                moveX = (dx / dist) * 0.06;
                moveY = (dy / dist) * 0.06;
            }
        }
        else if (this.type === 'cell_amalgam') {
            this.waveTime += 0.05;
            const sway = Math.sin(this.waveTime) * 0.025;
            moveX = (dx / dist) * 0.05 - (dy / dist) * sway;
            moveY = (dy / dist) * 0.05 + (dx / dist) * sway;
        }
        else if (this.type === 'boss_snake') {
            this.waveTime += 0.04;
            const baseAngle = Math.atan2(dy, dx);
            const coilBias = this.attackCycle % 3 === 1 ? this.genome.bias * 0.72 : 0;
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.8 + coilBias;
            const speedMult = this.phase === 2 ? 1.65 : 1;
            moveX = Math.cos(slitherAngle) * 0.04 * speedMult;
            moveY = Math.sin(slitherAngle) * 0.04 * speedMult;
            if (this.fireCooldown <= 30 && this.fireCooldown > 0) {
                this.attackState = this.attackCycle % 3 === 0 ? 'charge' : this.attackCycle % 3 === 1 ? 'tail_sweep' : 'prepare';
                this.lockedAimAngle = baseAngle + (1 - organModifier(this, 'aim')) * 0.5 * this.genome.bias;
            }
            if (this.fireCooldown <= 0) {
                const move = this.attackCycle % 3;
                const spreads = move === 1
                    ? [-1.25, -0.9, -0.55, 0.55, 0.9, 1.25]
                    : this.phase === 2 ? [-0.48, -0.24, 0, 0.24, 0.48] : [-0.3, -0.15, 0, 0.15, 0.3];
                for (const spread of spreads) {
                    const a = this.lockedAimAngle + spread;
                    spawnedProjectiles.push(new EnemyProjectile(this.x + this.width / 2, this.y + this.height / 2, Math.cos(a) * (move === 1 ? 0.24 : 0.3), Math.sin(a) * (move === 1 ? 0.24 : 0.3), this.phase === 2 && spread === 0));
                }
                if (move === 0) {
                    this.vx += Math.cos(this.lockedAimAngle) * (this.phase === 2 ? 1.25 : 0.85);
                    this.vy += Math.sin(this.lockedAimAngle) * (this.phase === 2 ? 1.25 : 0.85);
                } else if (move === 2 && enemyManager) {
                    const count = this.phase === 2 ? 3 : 2;
                    for (let i = 0; i < count; i++) enemyManager.spawn(this.x + 2 + i * 4, this.y + this.height - 2, 'cell_spore', { source: 'serpent_shed', emergenceTicks: 54 });
                }
                this.attackState = 'recover';
                this.attackCycle++;
                this.fireCooldown = this.phase === 2 ? 68 : 98;
            }
            if (this.life % 90 === 0) {
                for (let ox = -4; ox <= 4; ox += 2) for (let oy = -4; oy <= 4; oy += 2) {
                    if (ecosystem.damageTerrain(this.x + this.width / 2 + ox, this.y + this.height / 2 + oy, 1)) this.hp = Math.min(this.maxHp, this.hp + 0.35);
                }
            }
            if (this.life % 120 === 0) {
                const travel = (this.life / 120) % 4;
                this.weakPoints = [{ x: 2 + travel * 3, y: 2 + (travel % 2) * 4, width: 3, height: 3, phase: 1 }];
                if (this.phase === 2) this.weakPoints.push({ x: this.width - 4 - travel * 2, y: 6 - (travel % 2) * 2, width: 3, height: 3, phase: 2 });
            }
        }
        else if (this.type === 'boss_eye') {
            this.waveTime += 0.03;
            if (dist > 28) {
                moveX = (dx / dist) * 0.04;
                moveY = (dy / dist) * 0.04;
            } else if (dist < 18) {
                moveX = -(dx / dist) * 0.025;
                moveY = -(dy / dist) * 0.025;
            }

            const toPlayerA = Math.atan2(dy, dx);
            if (this.fireCooldown <= 42 && this.fireCooldown > 0) {
                this.attackState = this.attackCycle % 3 === 0 ? 'gaze' : this.attackCycle % 3 === 1 ? 'iris' : 'echo_bloom';
                this.lockedAimAngle = toPlayerA + (1 - organModifier(this, 'aim')) * 0.55 * this.genome.bias;
            }
            if (this.fireCooldown <= 0) {
                const cx = this.x + this.width / 2;
                const cy = this.y + this.height / 2;
                const move = this.attackCycle % 3;
                if (move === 0) {
                    for (let offset = -0.18; offset <= 0.18; offset += 0.09) {
                        const a = this.lockedAimAngle + offset;
                        spawnedProjectiles.push(new EnemyProjectile(cx, cy, Math.cos(a) * 0.38, Math.sin(a) * 0.38, offset === 0));
                    }
                } else if (move === 1) {
                    const safeGap = this.lockedAimAngle;
                    const count = this.phase === 2 ? 20 : 14;
                    for (let i = 0; i < count; i++) {
                        const a = this.waveTime + i * Math.PI * 2 / count;
                        const gapDistance = Math.abs(Math.atan2(Math.sin(a - safeGap), Math.cos(a - safeGap)));
                        if (gapDistance < 0.42) continue;
                        spawnedProjectiles.push(new EnemyProjectile(cx, cy, Math.cos(a) * 0.27, Math.sin(a) * 0.27));
                    }
                } else {
                    for (let lobe = -2; lobe <= 2; lobe++) {
                        const a = this.lockedAimAngle + lobe * 0.28;
                        spawnedProjectiles.push(new EnemyProjectile(cx + lobe * 2, cy + Math.abs(lobe), Math.cos(a) * 0.32, Math.sin(a) * 0.32, this.phase === 2 && lobe === 0));
                    }
                    if (this.phase === 2 && enemyManager && enemyManager.enemies.length < COMBAT_CONFIG.normalPopulationCap - 2) {
                        enemyManager.spawn(this.x - 2, this.y + this.height * 0.35, 'virus', { source: 'watcher_echo', emergenceTicks: 64 });
                        enemyManager.spawn(this.x + this.width, this.y + this.height * 0.6, 'virus', { source: 'watcher_echo', emergenceTicks: 64 });
                    }
                }
                this.attackCycle++;
                this.attackState = 'recover';
                this.fireCooldown = this.phase === 2 ? 92 : 125;
            }
        }
        else if (this.type === 'boss_carrier') {
            moveX = (dx / dist) * (this.phase === 2 ? 0.04 : 0.028);
            moveY = (dy / dist) * (this.phase === 2 ? 0.04 : 0.028);
            const baseA = Math.atan2(dy, dx);
            if (this.fireCooldown <= 38 && this.fireCooldown > 0) {
                this.attackState = this.attackCycle % 3 === 0 ? 'broadside' : this.attackCycle % 3 === 1 ? 'brood' : 'heartburst';
                this.lockedAimAngle = baseA;
                if (!this.broodType) this.broodType = (this.attackCycle + this.genomeSeed) % 3 === 0 ? 'virus' : (this.attackCycle + this.genomeSeed) % 3 === 1 ? 'drone' : 'kamikaze';
            }
            if (this.fireCooldown <= 0) {
                const move = this.attackCycle % 3;
                if (move === 1 && enemyManager && enemyManager.enemies.length < COMBAT_CONFIG.normalPopulationCap - 3 && organModifier(this, 'gestation') > 0.25) {
                    const spawnType = this.broodType || 'drone';
                    enemyManager.spawn(this.x - 2, this.y + 4, spawnType);
                    enemyManager.spawn(this.x + this.width, this.y + 5, spawnType);
                    if (this.phase === 2) enemyManager.spawn(this.x + this.width / 2, this.y + this.height, 'kamikaze');
                }
                const offsets = move === 2
                    ? Array.from({ length: this.phase === 2 ? 16 : 12 }, (_, i) => i * Math.PI * 2 / (this.phase === 2 ? 16 : 12)).filter((_, i) => i % 4 !== 0)
                    : move === 1 ? [-0.28, 0, 0.28] : [-0.65, -0.42, -0.2, 0, 0.2, 0.42, 0.65];
                const angles = offsets.map(offset => move === 2 ? offset + this.waveTime : this.lockedAimAngle + offset);
                for (let a of angles) {
                    spawnedProjectiles.push(new EnemyProjectile(this.x + this.width / 2, this.y + this.height / 2, Math.cos(a) * (move === 2 ? 0.25 : 0.31), Math.sin(a) * (move === 2 ? 0.25 : 0.31), this.phase === 2 && a === angles[Math.floor(angles.length / 2)]));
                }
                this.attackCycle++;
                this.broodType = null;
                this.attackState = 'recover';
                this.fireCooldown = this.phase === 2 ? 82 : 118;
            }
            if (enemyManager && this.life % 240 === 0) {
                const meal = enemyManager.enemies.find(other => other && other !== this && !BOSS_TYPES.has(other.type) && other.hp > 0 && other.hp / other.maxHp < 0.45 && Math.hypot(other.x - this.x, other.y - this.y) < 12);
                if (meal) {
                    meal.consumed = true;
                    enemyManager.enemies.splice(enemyManager.enemies.indexOf(meal), 1);
                    this.hp = Math.min(this.maxHp, this.hp + Math.max(4, meal.maxHp * 0.12));
                    const repair = this.organs.find(entry => entry.state === OrganState.WOUNDED || entry.state === OrganState.RUPTURED);
                    if (repair) { repair.hp = Math.min(repair.maxHp, repair.hp + 3); repair.state = repair.hp > repair.maxHp * 0.55 ? OrganState.HEALTHY : OrganState.WOUNDED; }
                    this.signal = '+'; this.signalTimer = 55;
                }
            }
            if (this.phase === 2 && this.life % 90 === 0) {
                const heart = this.organs.find(entry => entry.id === 'core');
                if (heart) {
                    heart.x = this.width * 0.25 + ((this.life / 90) % 3) * this.width * 0.2;
                    heart.y = this.height * 0.28 + ((this.life / 180) % 2) * this.height * 0.28;
                    this.weakPoints = [{ x: heart.x - 2, y: heart.y - 2, width: 5, height: 5, phase: 2 }];
                    this.signal = '@'; this.signalTimer = 32;
                }
            }
        }
        else if (this.type === 'kamikaze') {
            if (dist < 8 && this.detonationTimer === null) this.detonationTimer = 60;
            if (this.detonationTimer !== null) {
                this.attackState = 'countdown';
                this.detonationTimer--;
                moveX = (dx / dist) * 0.035;
                moveY = (dy / dist) * 0.035;
                if (this.detonationTimer <= 0 && this.hp > 0) {
                    this.detonated = true;
                    this.hp = 0;
                }
            } else {
                moveX = (dx / dist) * 0.12;
                moveY = (dy / dist) * 0.12;
            }
        }
        else if (this.type === 'shield_projector') {
            // Stay at a tactical distance from the player
            if (dist > 20) {
                moveX = (dx / dist) * 0.035;
                moveY = (dy / dist) * 0.035;
            } else if (dist < 14) {
                moveX = -(dx / dist) * 0.025;
                moveY = -(dy / dist) * 0.025;
            }

            // Project shields to other enemies within 16 units
            if (enemyManager && enemyManager.enemies && (this.life % 8 === 0 || !this.linkedTargets.length)) {
                const px = this.x + 1.5;
                const py = this.y + 1.5;
                this.linkedTargets = colonyMind.query(px, py, 16)
                    .filter(other => other && other !== this && other.type !== 'shield_projector' && other.hp > 0)
                    .map(other => ({ other, dist: Math.hypot(other.x + other.width / 2 - px, other.y + other.height / 2 - py) }))
                    .filter(entry => entry.dist < 16)
                    .sort((a, b) => a.dist - b.dist)
                    .slice(0, 2)
                    .map(entry => entry.other);
            }
            for (const target of this.linkedTargets) if (target?.hp > 0) target.shielded = true;
            if (this.life % 30 === 0) ecosystem.addNutrient(this.x + this.width / 2, this.y + this.height / 2, 0.18);
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

        if (insideGlitchField) {
            moveX *= 0.4;
            moveY *= 0.4;
            this.vx *= 0.55;
            this.vy *= 0.55;
        }

        if (this.packRole === 'retreat') {
            const target = this.socialTarget;
            if (target && target.hp > 0) {
                const tdx = target.x - this.x, tdy = target.y - this.y, td = Math.hypot(tdx, tdy) || 1;
                moveX = (tdx / td) * 0.065;
                moveY = (tdy / td) * 0.065;
            } else {
                moveX = -(dx / dist) * 0.06;
                moveY = -(dy / dist) * 0.06;
            }
        } else if (this.intentOffset) {
            const ix = playerX + this.intentOffset.x - this.x;
            const iy = playerY + this.intentOffset.y - this.y;
            const id = Math.hypot(ix, iy) || 1;
            moveX += (ix / id) * 0.025;
            moveY += (iy / id) * 0.025;
        }

        const preparing = ['prepare', 'countdown', 'divide', 'charge', 'tail_sweep', 'gaze', 'iris', 'echo_bloom', 'broadside', 'brood', 'heartburst'].includes(this.attackState);
        if (this.packRole === 'retreat') this.behaviorState = BehaviorState.RETREAT;
        else if (this.attackState === 'release' || this.lungeTimer > 0) this.behaviorState = BehaviorState.COMMIT;
        else if (preparing) this.behaviorState = BehaviorState.PREPARE;
        else if (this.attackState === 'recover' || this.attackState === 'ruptured') this.behaviorState = BehaviorState.RECOVER;
        else this.behaviorState = BehaviorState.SEEK;

        // Collision Check with Obstacles
        const genomeMods = getGenomeModifiers(this.genome);
        const symbioteSpeed = (this.symbioteBoosted ? 1.2 : 1) * genomeMods.speed * organModifier(this, 'movement');
        const nextX = this.x + this.vx + moveX * symbioteSpeed;
        const nextY = this.y + this.vy + moveY * symbioteSpeed;
        let collides = false;

        for (let w = 0; w < this.width; w++) {
            for (let h = 0; h < this.height; h++) {
                const ex_cell = Math.floor(nextX + w);
                const ey_cell = Math.floor(nextY + h);
                if (ex_cell >= 0 && ex_cell < gridCols && ey_cell >= 0 && ey_cell < gridRows) {
                    if (matrixRain.obstacles?.[ex_cell]?.[ey_cell]) {
                        collides = true;
                        break;
                    }
                }
            }
            if (collides) break;
        }

        if (collides) {
            this.vx *= -0.5;
            this.vy *= -0.5;
        } else {
            this.x = nextX;
            this.y = nextY;
        }
    }

    stampDirectionalTelegraph(rendererInstance) {
        if (this.introTimer > 0 && BOSS_TYPES.has(this.type)) {
            const blink = Math.floor(this.introTimer / 8) % 2 === 0;
            if (blink) {
                const w = this.width + 4;
                const x = this.x - 2;
                const y = this.y - 2;
                stampPattern(rendererInstance, x, y, [`+${'-'.repeat(w - 2)}+`], 0.9, PALETTE.enemyShot);
                stampPattern(rendererInstance, x, y + this.height + 3, [`+${'-'.repeat(w - 2)}+`], 0.9, PALETTE.enemyShot);
            }
            return;
        }
        const shouldWarn = (BOSS_TYPES.has(this.type) && this.fireCooldown > 0 && this.fireCooldown <= 42)
            || (['shooter', 'worm', 'virus'].includes(this.type) && this.fireCooldown > 0 && this.fireCooldown <= 26);
        if (!shouldWarn) return;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        let angle = this.lockedAimAngle;
        if (!BOSS_TYPES.has(this.type)) {
            angle = Math.atan2((this.lastPlayerY ?? cy) + 1.5 - cy, (this.lastPlayerX ?? cx) + 1.5 - cx);
        }
        const length = BOSS_TYPES.has(this.type) ? 26 : 10;
        for (let distance = Math.max(2, this.width / 2); distance < length; distance += 2) {
            const gx = Math.floor(cx + Math.cos(angle) * distance);
            const gy = Math.floor(cy + Math.sin(angle) * distance);
            if (gx < 0 || gx >= rendererInstance.cols || gy < 0 || gy >= rendererInstance.rows) continue;
            rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.GLITCH;
            rendererInstance.chars[gx][gy] = distance + 2 >= length ? '>' : ':';
            rendererInstance.brightness[gx][gy] = 0.75;
            rendererInstance.customColors[gx][gy] = PALETTE.enemyShot;
        }
    }

    stampAuthored(rendererInstance, brightMult) {
        const blink = Math.floor(rendererInstance.animationTime / 10) % 2 === 0;
        const wounded = this.hp / Math.max(1, this.maxHp) < 0.5;
        if (BOSS_TYPES.has(this.type)) {
            stampOrganicBoss(this, rendererInstance, brightMult, blink, wounded);
            return true;
        }
        const livingBody = renderCreatureBody(this, rendererInstance.animationTime);
        if (livingBody) {
            if (this.genome.family === SpeciesFamily.RIBBON) {
                const motion = this.organs.find(entry => entry.effect === 'movement');
                for (let i = 2; i < this.trail.length; i += 3) {
                    const pos = this.trail[i];
                    const vertebra = motion?.state === OrganState.SEVERED ? 'x' : (i % 2 ? 'o=' : '=o');
                    stampPattern(rendererInstance, pos.x, pos.y, [vertebra], Math.max(0.3, brightMult * (1 - i / this.trail.length)), this.color);
                }
            }
            const bodyWidth = Math.max(...livingBody.map(row => row.length));
            const recoilX = this.impactTimer > 0 ? -Math.sign(this.impactDirectionX) : 0;
            const recoilY = this.impactTimer > 0 ? -Math.sign(this.impactDirectionY) : 0;
            const bodyX = this.x - Math.floor((bodyWidth - this.width) / 2) + recoilX;
            const bodyY = this.y - Math.max(0, Math.floor((livingBody.length - this.height) / 2)) + recoilY;
            stampPattern(rendererInstance, bodyX, bodyY, livingBody, brightMult, this.color);
            const shell = this.organs.find(entry => entry.effect === 'armor');
            for (const organ of this.organs) {
                const activeAttack = organ.type === 'attack' && ['prepare', 'countdown', 'divide', 'charge', 'tail_sweep', 'gaze', 'iris', 'echo_bloom', 'broadside', 'brood', 'heartburst', 'release'].includes(this.attackState);
                const exposedCore = organ.type === 'core' && (!shell || shell.state !== OrganState.HEALTHY || this.hp < this.maxHp * 0.45);
                const damaged = organ.state !== OrganState.HEALTHY;
                if (!activeAttack && !exposedCore && !damaged) continue;
                const glyph = organ.state === OrganState.SEVERED ? ' ' : organ.state === OrganState.RUPTURED ? 'x' : organ.state === OrganState.WOUNDED ? ':' : organ.type === 'core' ? '@' : '*';
                if (glyph !== ' ') stampPattern(rendererInstance, this.x + Math.floor(organ.x), this.y + Math.floor(organ.y), [glyph], 1, activeAttack ? PALETTE.enemyShot : '#ffb3dc');
            }
            if (this.genome.family === SpeciesFamily.CARAPACE && shell && shell.state !== OrganState.SEVERED) {
                const plateX = this.x + this.width / 2 + Math.cos(this.armorFacingAngle) * Math.max(1, this.width * 0.42);
                const plateY = this.y + this.height / 2 + Math.sin(this.armorFacingAngle) * Math.max(1, this.height * 0.42);
                stampPattern(rendererInstance, plateX, plateY, [shell.state === OrganState.HEALTHY ? '#' : shell.state === OrganState.WOUNDED ? '%' : ';'], 0.95, this.color);
            }
            if (this.genome.family === SpeciesFamily.AMALGAM && this.inheritedFamilies.length) {
                const accents = { skitter: '~', bloomcaster: '*', ribbon: '=', prism: '+', carapace: '#', burst_sac: '!', rootweaver: 'Y' };
                for (let i = 0; i < Math.min(3, this.inheritedFamilies.length); i++) {
                    const phase = (Math.floor(rendererInstance.animationTime / 10) + i * 2) % Math.max(2, this.width);
                    stampPattern(rendererInstance, this.x + phase, this.y + 1 + i * 2, [accents[this.inheritedFamilies[i]] || ':'], 0.88, '#ff78ca');
                }
            }
            if (this.signal && this.signalTimer > 0) stampPattern(rendererInstance, this.x + Math.floor(this.width / 2), this.y - 2, [this.signal], 1, PALETTE.enemyShot);
            if (this.symbioteBoosted) {
                const crawl = (Math.floor(rendererInstance.animationTime / 8) + this.genomeSeed) % Math.max(2, this.width);
                const crawlY = (Math.floor(rendererInstance.animationTime / 16) + this.genomeSeed) % Math.max(2, this.height);
                stampPattern(rendererInstance, this.x + crawl, this.y + crawlY, [blink ? '^' : '~'], 1, '#d77aff');
            }
            return true;
        }
        return false;
    }

    stampGermination(rendererInstance) {
        const rows = renderCreatureBody(this, 0) || [':'];
        const progress = this.emergenceTotal > 0 ? 1 - this.emergenceTimer / this.emergenceTotal : 1;
        const pulse = Math.floor(this.life / 6) % 2;
        const bodyWidth = Math.max(1, ...rows.map(row => row.length));
        const bodyX = this.x - Math.floor((bodyWidth - this.width) / 2);
        const bodyY = this.y - Math.max(0, Math.floor((rows.length - this.height) / 2));
        const threshold = 0.12 + progress * 0.84;
        for (let row = 0; row < rows.length; row++) {
            for (let col = 0; col < rows[row].length; col++) {
                const original = rows[row][col];
                if (original === ' ') continue;
                const noise = (hashSeed(`${this.genomeSeed}:germ:${row}:${col}`) % 1000) / 1000;
                if (noise > threshold) continue;
                const glyph = progress < 0.34 ? '.' : progress < 0.72 ? ':' : original;
                stampPattern(rendererInstance, bodyX + col, bodyY + row, [glyph], 0.18 + progress * 0.55, this.color);
            }
        }
        const cx = Math.floor(this.x + this.width / 2);
        const cy = Math.floor(this.y + this.height / 2);
        if (pulse || progress > 0.8) stampPattern(rendererInstance, cx, cy, [progress > 0.8 ? '*' : '+'], 0.45 + progress * 0.45, PALETTE.enemyShot);
        if (progress > 0.68) {
            const dx = Math.sign((this.lastPlayerX ?? this.x) - this.x) || this.genome.bias;
            stampPattern(rendererInstance, cx + dx * Math.max(2, Math.floor(this.width / 2) + 1), cy, [dx > 0 ? '>' : '<'], 0.75, PALETTE.enemyShot);
        }
    }

    stampToGrid(rendererInstance) {
        const margin = BOSS_TYPES.has(this.type) ? 28 : 10;
        if (this.x + this.width < rendererInstance.camX - margin ||
            this.y + this.height < rendererInstance.camY - margin ||
            this.x > rendererInstance.camX + rendererInstance.viewCols + margin ||
            this.y > rendererInstance.camY + rendererInstance.viewRows + margin) return;
        const brightMult = this.frozenTimer > 0 ? 0.35 : this.shielded ? 1.08 : 1.0;
        if (this.spawnLifecycle === SpawnLifecycle.GERMINATING || this.spawnLifecycle === SpawnLifecycle.RESERVED) {
            this.stampGermination(rendererInstance);
            return;
        }
        if (this.spawnLifecycle === SpawnLifecycle.DYING) return;
        this.stampDirectionalTelegraph(rendererInstance);
        if (this.stampAuthored(rendererInstance, brightMult)) return;

        if (this.type === 'drone') {
            // Glitch Snake trail (chain of wobbly organic blobs)
            for (let i = 0; i < this.trail.length; i++) {
                const pos = this.trail[i];
                const radius = 1.0 - (i / this.trail.length) * 0.7;
                stampOrganicBlob(rendererInstance, pos.x + 0.5, pos.y + 0.5, radius, DRONE_CHARS, 0.7 * (1 - i / this.trail.length) * brightMult);
            }
            // Head
            stampOrganicBlob(rendererInstance, this.x + 0.5, this.y + 0.5, 1.2, DRONE_CHARS, 1.0 * brightMult, { x: this.vx || 0.1, y: this.vy || 0.1 });
        } 
        else if (this.type === 'brute') {
            // Large wobbly organic blob
            stampOrganicBlob(rendererInstance, this.x + 2.5, this.y + 2.5, 2.8, BRUTE_CHARS, 1.0 * brightMult);
        }
        else if (this.type === 'brute_medium') {
            // Medium wobbly organic blob
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, 1.8, BRUTE_MED_CHARS, 0.9 * brightMult);
        }
        else if (this.type === 'shooter') {
            // Shooter teardrop shape blob pointing towards movement
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, 1.5, SHOOTER_CHARS, 0.9 * brightMult, { x: this.vx || 0.1, y: this.vy || 0.1 });
        }
        else if (this.type === 'worm') {
            // Slitherer chain of wobbly blobs
            for (let i = 0; i < this.trail.length; i++) {
                const pos = this.trail[i];
                stampOrganicBlob(rendererInstance, pos.x + 0.5, pos.y + 0.5, 1.1, WORM_CHARS, 0.9 * (1 - i / this.trail.length) * brightMult);
            }
        }
        else if (this.type === 'virus') {
            // Pulsating virus blob
            const scale = 1.4 + Math.sin(rendererInstance.animationTime * 0.12) * 0.2;
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, scale, VIRUS_CHARS, 0.85 * brightMult);
        }
        else if (this.type === 'boss_snake') {
            // Draw wobbly trailing segments
            for (let i = 0; i < this.trail.length; i++) {
                if (i % 4 === 0) {
                    const pos = this.trail[i];
                    const radius = 4.2 - (i / this.trail.length) * 2.8;
                    stampOrganicBlob(rendererInstance, pos.x + 5.5, pos.y + 5.5, radius, BOSS_SEG_CHARS, 0.7 * (1 - i / this.trail.length) * brightMult);
                }
            }
            // Draw head
            stampOrganicBlob(rendererInstance, this.x + 5.5, this.y + 5.5, 5.6, BOSS_HEAD_CHARS, 1.0 * brightMult, { x: this.vx || 0.1, y: this.vy || 0.1 });
        }
        else if (this.type === 'boss_eye') {
            const cx = this.x + 7.5;
            const cy = this.y + 7.5;
            stampOrganicBlob(rendererInstance, cx, cy, 8.5, ['O', '0', '#', '▒', '░'], 0.95 * brightMult);
            
            // Stare at player coordinates
            const px = this.lastPlayerX !== undefined ? this.lastPlayerX + 1.5 : cx;
            const py = this.lastPlayerY !== undefined ? this.lastPlayerY + 1.5 : cy;
            const dx = px - cx;
            const dy = py - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let offsetScale = 3.2;
            let ox = 0;
            let oy = 0;
            if (dist > 0.1) {
                ox = (dx / dist) * offsetScale;
                oy = (dy / dist) * offsetScale;
            }
            const ix = Math.floor(cx + ox);
            const iy = Math.floor(cy + oy);
            
            // Draw pupil iris tracking player
            for (let dy_p = -4; dy_p <= 4; dy_p++) {
                for (let dx_p = -4; dx_p <= 4; dx_p++) {
                    const gx = ix + dx_p;
                    const gy = iy + dy_p;
                    if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                        const distFromCenter = Math.sqrt(dx_p*dx_p + dy_p*dy_p);
                        if (distFromCenter < 1.8) {
                            rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                            rendererInstance.chars[gx][gy] = '█'; // Solid pupil center
                            rendererInstance.brightness[gx][gy] = 1.0 * brightMult;
                        } else if (distFromCenter < 3.2) {
                            rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                            rendererInstance.chars[gx][gy] = '◉'; // Iris ring
                            rendererInstance.brightness[gx][gy] = 0.95 * brightMult;
                        } else if (distFromCenter < 4.2) {
                            rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                            rendererInstance.chars[gx][gy] = '░'; // Outer iris border
                            rendererInstance.brightness[gx][gy] = 0.8 * brightMult;
                        }
                    }
                }
            }
        }
        else if (this.type === 'boss_carrier') {
            const CARRIER_PATTERNS = [
                ['╔', '═', '═', '╦', '═', '╦', '╦', '╦', '╦', '╦', '╦', '═', '╦', '═', '═', '╗'],
                ['║', '█', '█', '║', ' ', '║', '░', '░', '░', '░', '║', ' ', '║', '█', '█', '║'],
                ['║', '█', '█', '╠', '═', '╬', '█', '█', '█', '█', '╬', '═', '╣', '█', '█', '║'],
                ['╠', '═', '═', '╣', ' ', '║', '█', '☣', '☣', '█', '║', ' ', '╠', '═', '═', '╣'],
                ['║', '░', '░', '║', ' ', '╚', '╦', '═', '═', '╦', '╝', ' ', '║', '░', '░', '║'],
                ['║', '█', '█', '╠', '═', '═', '╬', '░', '░', '╬', '═', '═', '╣', '█', '█', '║'],
                ['║', '█', '█', '║', ' ', ' ', '║', '█', '█', '║', ' ', ' ', '║', '█', '█', '║'],
                ['║', '░', '░', '║', ' ', ' ', '╚', '╦', '╦', '╝', ' ', ' ', '║', '░', '░', '║'],
                ['╚', '╦', '╦', '╝', ' ', ' ', ' ', '║', '║', ' ', ' ', ' ', '╚', '╦', '╦', '╝'],
                [' ', '▼', '▼', ' ', ' ', ' ', ' ', '▼', '▼', ' ', ' ', ' ', ' ', '▼', '▼', ' ']
            ];
            const ix = Math.floor(this.x);
            const iy = Math.floor(this.y);
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 16; col++) {
                    let char = CARRIER_PATTERNS[row][col];
                    if (row === 9 && char === '▼') {
                        const rand = Math.random();
                        if (rand < 0.25) char = '░';
                        else if (rand < 0.5) char = '▒';
                        else if (rand < 0.75) char = ' ';
                    }
                    const gx = ix + col;
                    const gy = iy + row;
                    if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                        rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                        rendererInstance.chars[gx][gy] = char;
                        const isFlame = row === 9 && char !== ' ';
                        rendererInstance.brightness[gx][gy] = (isFlame ? 1.0 : 0.85 + Math.random() * 0.15) * brightMult;
                    }
                }
            }
        }
        else if (this.type === 'kamikaze') {
            // Draw a wobbly blinking hazard symbol
            const isBlink = Math.floor(rendererInstance.animationTime / 9) % 2 === 0;
            const count = this.detonationTimer === null ? '!' : String(Math.max(1, Math.ceil(this.detonationTimer / 20)));
            const char = isBlink ? count : '!';
            stampOrganicBlob(rendererInstance, this.x + 0.5, this.y + 0.5, 1.2, [char], 1.0 * brightMult);
        }
        else if (this.type === 'shield_projector') {
            // Draw a neat structured triangle outline
            const ix = Math.floor(this.x);
            const iy = Math.floor(this.y);
            const patterns = [
                ['╔', '♦', '╗'],
                ['♦', '⚙', '♦'],
                ['╚', '♦', '╝']
            ];
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const gx = ix + col;
                    const gy = iy + row;
                    if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                        rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                        rendererInstance.chars[gx][gy] = patterns[row][col];
                        rendererInstance.brightness[gx][gy] = 1.0 * brightMult;
                    }
                }
            }

        }
    }

    getHitbox() {
        if (!this.isTargetable()) return { x: this.x, y: this.y, width: 0, height: 0, isCircle: false, inactive: true };
        const padding = Math.max(0.7, this.width * 0.2);
        
        if (this.type === 'boss_snake') {
            const boxes = [
                { x: this.x - padding, y: this.y - padding, width: this.width + padding * 2, height: this.height + padding * 2 }
            ];
            for (let i = 0; i < this.trail.length; i += 4) { // check every 4th segment
                const pos = this.trail[i];
                const size = Math.max(3, 8 - (i / this.trail.length) * 5);
                boxes.push({
                    x: pos.x - padding,
                    y: pos.y - padding,
                    width: size + padding * 2,
                    height: size + padding * 2
                });
            }
            return { isMultiBox: true, boxes };
        }
        
        return {
            x: this.x - padding,
            y: this.y - padding,
            width: this.width + padding * 2,
            height: this.height + padding * 2,
            isCircle: false
        };
    }

    getContactHitbox() {
        if (!this.isActive()) return { x: this.x, y: this.y, width: 0, height: 0, isCircle: false, inactive: true };
        if (this.type === 'drone' && this.lungeTimer <= 0) return { x: this.x, y: this.y, width: 0, height: 0, isCircle: false };
        if (this.type === 'worm' && this.lungeTimer <= 0) return { x: this.x, y: this.y, width: 0, height: 0, isCircle: false };
        if (['shooter', 'virus', 'shield_projector', 'cell_spore', 'cell_colony', 'cell_parasite'].includes(this.type)) return { x: this.x, y: this.y, width: 0, height: 0, isCircle: false };
        const insetX = Math.min(this.width * 0.15, 1.5);
        const insetY = Math.min(this.height * 0.15, 1.5);
        return {
            x: this.x + insetX,
            y: this.y + insetY,
            width: Math.max(0.8, this.width - insetX * 2),
            height: Math.max(0.8, this.height - insetY * 2),
            isCircle: false
        };
    }

    takeDamage(amount, hitX = null, hitY = null) {
        if (!this.isTargetable()) return false;
        const context = normalizeDamageContext(amount, hitX, hitY);
        if (context.directionX || context.directionY) this.armorFacingAngle = Math.atan2(-context.directionY, -context.directionX);
        if (this.shielded && this.type !== 'shield_projector') {
            effects.spawnImpactSparks(this.x + this.width/2, this.y + this.height/2);
            audio.playHit();
            return false; // shielded from damage
        }
        const weakPointHit = context.hitX !== null && context.hitY !== null && this.weakPoints.some(point =>
            this.phase >= point.phase
            && context.hitX >= this.x + point.x && context.hitX <= this.x + point.x + point.width
            && context.hitY >= this.y + point.y && context.hitY <= this.y + point.y + point.height
        );
        const genomeMods = getGenomeModifiers(this.genome);
        context.amount *= genomeMods[context.damageType] ?? 1;
        const wound = damageOrgan(this, context);
        const shell = this.organs?.find(entry => entry.effect === 'armor');
        if (shell?.state === OrganState.HEALTHY) context.amount *= 0.84;
        else if (shell?.state === OrganState.WOUNDED) context.amount *= 0.94;
        else if (shell && [OrganState.RUPTURED, OrganState.SEVERED].includes(shell.state)) context.amount *= 1.08;
        if (weakPointHit) context.amount *= 1.35;
        else if (wound?.organ.type === 'core') context.amount *= Math.min(1.18, genomeMods.coreExposure);
        if (wound?.changed) this.reactToWound(wound.organ);
        if (wound?.changed) {
            const rewardKey = `${wound.organ.id}:${wound.organ.state}`;
            if (!this.rewardedOrganStates.has(rewardKey) && [OrganState.RUPTURED, OrganState.SEVERED].includes(wound.organ.state)) {
                this.rewardedOrganStates.add(rewardKey);
                this.xpValue += BOSS_TYPES.has(this.type) ? 12 : 3;
            }
        }
        if (context.hitX !== null && context.hitY !== null) effects.spawnTissueEjection(context.hitX, context.hitY, context.directionX, context.directionY, this.color, context.amount >= 10 ? 5 : 3, wound?.organ.type === 'core' ? '@' : ':');
        this.impactTimer = 5;
        this.impactDirectionX = context.directionX || 0;
        this.impactDirectionY = context.directionY || 0;
        this.hp -= context.amount;
        evolution.recordDamage(this, context, context.amount);
        stats.recordHit(context.amount);
        if (BOSS_TYPES.has(this.type) && context.amount >= 10 && renderer.shakeTimer <= 0) {
            renderer.triggerShake(2, 0.35);
        }

        return this.hp <= 0;
    }

    reactToWound(organ) {
        this.signal = organ.type === 'social' ? '!' : organ.type === 'core' ? '@' : 'x';
        this.signalTimer = 48;
        if (organ.type === 'attack') { this.fireCooldown = Math.max(this.fireCooldown, 90); this.attackState = 'ruptured'; }
        if (organ.type === 'social') { this.packId = null; this.linkedTargets = []; }
        if (organ.type === 'core') { this.packRole = 'retreat'; this.energy += 1; }
        if (organ.type === 'attack' && organ.state === OrganState.RUPTURED) this.leaking = true;
        if (organ.effect === 'segment' && [OrganState.RUPTURED, OrganState.SEVERED].includes(organ.state)) this.pendingSegmentShed = true;
        if (organ.effect === 'vision_lobe' && [OrganState.RUPTURED, OrganState.SEVERED].includes(organ.state)) { this.signal = '?'; this.lockedAimAngle += 0.35 * this.genome.bias; }
        if (organ.effect === 'gestation' && [OrganState.RUPTURED, OrganState.SEVERED].includes(organ.state)) { this.broodRuptured = true; this.fireCooldown = Math.max(this.fireCooldown, 120); }
        if (this.genome.family === SpeciesFamily.PRISM && organ.state === OrganState.RUPTURED && !this.hasDividedFromWound) { this.hasDividedFromWound = true; this.pendingDivision = true; }
        if (this.genome.family === SpeciesFamily.RIBBON && organ.type === 'locomotion' && organ.state === OrganState.SEVERED) this.pendingSegmentShed = true;
        if (organ.state === OrganState.SEVERED) effects.spawnShatter(this.x + organ.x, this.y + organ.y, organ.type === 'sensory' ? 'o' : '~', this.color);
    }

    onDeath(enemyManager, spawnedProjectiles = []) {
        this.spawnLifecycle = SpawnLifecycle.DYING;
        this.behaviorState = BehaviorState.DISABLED;
        evolution.recordDeath(this, enemyManager?.elapsedSeconds || 0);
        this.deathState = this.genome?.family === SpeciesFamily.PRISM ? 'division' : this.genome?.family === SpeciesFamily.BURST_SAC ? 'rupture' : this.genome?.family === SpeciesFamily.CARAPACE ? 'collapse' : 'desiccate';
        if (BOSS_TYPES.has(this.type)) {
            renderer.triggerShake(28, 4.5);
            const sections = 7;
            for (let i = 0; i < sections; i++) {
                const sx = this.x + ((i * 7) % Math.max(1, this.width));
                const sy = this.y + ((i * 5) % Math.max(1, this.height));
                effects.spawnGlitchExplosion(sx, sy, PALETTE.boss, 18 + i * 4);
            }
        } else {
            const accent = { skitter: '-', bloomcaster: '%', ribbon: '~', prism: '+', carapace: '#', burst_sac: '!', rootweaver: 'Y', parasite: '^', amalgam: ':' }[this.genome?.family] || ':';
            const pieces = this.genome?.family === SpeciesFamily.CARAPACE ? 7 : this.genome?.family === SpeciesFamily.RIBBON ? 6 : 4;
            for (let i = 0; i < pieces; i++) effects.spawnShatter(this.x + this.width * (i + 1) / (pieces + 1), this.y + this.height * ((i % 3) + 1) / 4, accent, this.color);
            effects.spawnGlitchExplosion(this.x + this.width/2, this.y + this.height/2, this.color, this.type === 'brute' ? 18 : 9);
        }

        if (this.type === 'kamikaze') {
            effects.spawnGlitchExplosion(this.x + 0.5, this.y + 0.5, '#ff3333', 25);
            const away = Math.atan2(this.y - (this.lastPlayerY ?? this.y), this.x - (this.lastPlayerX ?? this.x));
            const spreads = this.detonated ? Array.from({ length: 10 }, (_, i) => i * Math.PI * 2 / 10) : [-0.55, -0.28, 0, 0.28, 0.55].map(offset => away + offset);
            for (const a of spreads) {
                spawnedProjectiles.push(new EnemyProjectile(
                    this.x + 0.5, this.y + 0.5,
                    Math.cos(a) * 0.35, Math.sin(a) * 0.35
                ));
            }
        }
        
        // Broken carapace divides into two vulnerable organisms without an unavoidable death ring.
        if (this.type === 'brute') {
            if (enemyManager) {
                enemyManager.spawn(this.x - 1, this.y, 'brute_medium');
                enemyManager.spawn(this.x + 2, this.y, 'brute_medium');
            }
        }
    }
}

class EnemyManager {
    constructor() {
        this.enemies = [];
        this.projectiles = [];
        this.runSeed = 1;
        this.spawnCounter = 0;
        this.elapsedSeconds = 0;
    }

    reset(seed = hashSeed(`run:${Date.now()}`)) {
        this.enemies = [];
        this.projectiles = [];
        this.runSeed = seed >>> 0;
        this.spawnCounter = 0;
        this.elapsedSeconds = 0;
        evolution.reset(this.runSeed);
        colonyMind.reset(this.runSeed);
    }

    spawn(x, y, type, options = {}) {
        const request = x instanceof EnemySpawnRequest ? x : new EnemySpawnRequest(x, y, type, options);
        x = request.x;
        y = request.y;
        type = request.type;
        options = request.options;
        if (NORMAL_ENEMY_TYPES.has(type)) {
            let normalCount = 0;
            let ecosystemCost = 0;
            for (const e of this.enemies) {
                if (e && NORMAL_ENEMY_TYPES.has(e.type)) {
                    normalCount++;
                    if (ECOSYSTEM_TYPES.has(e.type)) ecosystemCost += ENEMY_DEFS[e.type]?.populationCost || 1;
                }
            }
            if (normalCount >= COMBAT_CONFIG.normalPopulationCap) return null;
            if (ECOSYSTEM_TYPES.has(type) && ecosystemCost + (ENEMY_DEFS[type]?.populationCost || 1) > COMBAT_CONFIG.ecosystemPopulationCap) return null;
        }
        const seed = options.seed ?? hashSeed(`${this.runSeed}:${type}:${this.spawnCounter++}`);
        const adaptations = options.adaptations || evolution.adaptationsFor(type);
        const enemy = new Enemy(x, y, type, {
            ...options,
            source: request.source,
            encounterId: request.encounterId,
            safeRadius: request.safeRadius,
            emergenceTicks: request.emergenceTicks,
            seed,
            adaptations
        });
        enemy.spawnId = this.spawnCounter;
        if (adaptations.length) { enemy.signal = 'E'; enemy.signalTimer = 75; }
        this.enemies.push(enemy);
        return enemy;
    }

    requestSpawn(request) {
        return this.spawn(request);
    }

    getPopulationUsage() {
        let normal = 0;
        let ecosystem = 0;
        for (const enemy of this.enemies) {
            if (!enemy || !NORMAL_ENEMY_TYPES.has(enemy.type) || enemy.spawnLifecycle === SpawnLifecycle.DYING) continue;
            normal++;
            if (ECOSYSTEM_TYPES.has(enemy.type)) ecosystem += ENEMY_DEFS[enemy.type]?.populationCost || 1;
        }
        return { normal, ecosystem };
    }

    reserveEncounter(requests) {
        const normalized = requests.map(request => request instanceof EnemySpawnRequest
            ? request
            : new EnemySpawnRequest(request.x, request.y, request.type, request.options));
        const usage = this.getPopulationUsage();
        const normalCost = normalized.filter(request => NORMAL_ENEMY_TYPES.has(request.type)).length;
        const ecosystemCost = normalized.reduce((sum, request) =>
            sum + (ECOSYSTEM_TYPES.has(request.type) ? ENEMY_DEFS[request.type]?.populationCost || 1 : 0), 0);
        if (usage.normal + normalCost > COMBAT_CONFIG.normalPopulationCap) return [];
        if (usage.ecosystem + ecosystemCost > COMBAT_CONFIG.ecosystemPopulationCap) return [];
        const spawned = [];
        for (const request of normalized) {
            const enemy = this.requestSpawn(request);
            if (enemy) spawned.push(enemy);
        }
        return spawned;
    }

    fuse(participants) {
        const living = participants.filter(enemy => enemy && this.enemies.includes(enemy) && enemy.hp > 0 && !enemy.consumed);
        if (living.length < 2) return null;
        const x = living.reduce((sum, enemy) => sum + enemy.x, 0) / living.length;
        const y = living.reduce((sum, enemy) => sum + enemy.y, 0) / living.length;
        const seed = hashSeed(living.map(enemy => enemy.genome.signature).sort().join(':'));
        const adaptations = [...new Map(living.flatMap(enemy => enemy.genome.adaptations).map(adaptation => [adaptation.id, adaptation])).values()].slice(0, 3);
        const xp = living.reduce((sum, enemy) => sum + enemy.xpValue, 0);
        const hp = living.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0);
        const originalIndices = living.map(enemy => ({ enemy, index: this.enemies.indexOf(enemy) }));
        for (const enemy of living) { enemy.consumed = true; this.enemies.splice(this.enemies.indexOf(enemy), 1); }
        const inheritedFamilies = [...new Set(living.map(enemy => enemy.genome?.family).filter(Boolean))];
        const fused = this.spawn(x, y, 'cell_amalgam', { seed, adaptations, inheritedFamilies, source: 'fusion', emergenceTicks: 70 });
        if (!fused) {
            for (const { enemy, index } of originalIndices.sort((a, b) => a.index - b.index)) {
                enemy.consumed = false;
                this.enemies.splice(Math.min(index, this.enemies.length), 0, enemy);
            }
            return null;
        }
        fused.hp = Math.max(fused.hp, hp * 0.7);
        fused.maxHp = fused.hp;
        fused.xpValue = Math.round(xp * 1.15);
        fused.energy = 0;
        return fused;
    }

    update(playerInstance, gridCols, gridRows) {
        const spawnedProjectiles = [];

        // Reset shielded flag for all enemies at start of update frame
        for (const enemy of this.enemies) {
            if (enemy) {
                enemy.shielded = false;
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy) {
                this.enemies.splice(i, 1);
                continue;
            }

            if (enemy.spawnLifecycle === SpawnLifecycle.GERMINATING && !BOSS_TYPES.has(enemy.type)) {
                const px = playerInstance.x + playerInstance.width / 2;
                const py = playerInstance.y + playerInstance.height / 2;
                const ex = enemy.x + enemy.width / 2;
                const ey = enemy.y + enemy.height / 2;
                let dx = ex - px;
                let dy = ey - py;
                let distance = Math.hypot(dx, dy);
                if (distance < 0.001) {
                    const angle = (enemy.genomeSeed % 628) / 100;
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    distance = 1;
                }
                if (distance < enemy.spawnSafeRadius) {
                    enemy.x += dx / distance * (enemy.spawnSafeRadius - distance);
                    enemy.y += dy / distance * (enemy.spawnSafeRadius - distance);
                }
            }
            enemy.update(playerInstance.x, playerInstance.y, gridCols, gridRows, spawnedProjectiles, this);

            // Clean up offscreen enemies
            if (enemy.x < -30 || enemy.x > gridCols + 30 || enemy.y < -30 || enemy.y > gridRows + 30) {
                this.enemies.splice(i, 1);
            }
        }

        for (const proj of spawnedProjectiles) {
            if ((this.elapsedSeconds || 0) >= 300) { proj.vx *= 1.1; proj.vy *= 1.1; }
            this.projectiles.push(proj);
        }

        colonyMind.update(this, playerInstance);

        // Gentle separation keeps silhouettes from collapsing into unreadable red clumps.
        for (let i = 0; i < this.enemies.length; i++) {
            const a = this.enemies[i];
            if (!a?.isActive()) continue;
            for (const b of colonyMind.query(a.x, a.y, 5)) {
                if (!b?.isActive() || b === a || b.spawnId <= a.spawnId) continue;
                const dx = (b.x + b.width / 2) - (a.x + a.width / 2);
                const dy = (b.y + b.height / 2) - (a.y + a.height / 2);
                const dist = Math.hypot(dx, dy) || 0.01;
                const minDist = Math.min(4, (a.width + b.width) * 0.28 + 0.8);
                if (dist < minDist) {
                    const push = (minDist - dist) * 0.012;
                    a.vx -= (dx / dist) * push;
                    a.vy -= (dy / dist) * push;
                    b.vx += (dx / dist) * push;
                    b.vy += (dy / dist) * push;
                }
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(playerInstance);
            const ix = Math.floor(p.x);
            const iy = Math.floor(p.y);
            const hitObstacle = ix >= 0 && ix < matrixRain.cols && iy >= 0 && iy < matrixRain.rows && matrixRain.obstacles?.[ix]?.[iy];
            if (hitObstacle) {
                matrixRain.damageObstacle(ix, iy, 0.5);
                effects.spawnImpactSparks(p.x, p.y, PALETTE.enemyShot);
            }
            if (hitObstacle || p.life <= 0 || p.x < 0 || p.x > gridCols || p.y < 0 || p.y > gridRows) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    stampToGrid(rendererInstance) {
        for (const enemy of this.enemies) {
            if (enemy) {
                enemy.stampToGrid(rendererInstance);
            }
        }
        for (const p of this.projectiles) {
            if (p) p.stampToGrid(rendererInstance);
        }
    }
}

export const enemies = new EnemyManager();
export { EnemyManager as EnemyManagerClass };
