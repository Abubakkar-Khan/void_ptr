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

function stampTendril(rendererInstance, x1, y1, x2, y2, color = '#ff9de2') {
    const dx = x2 - x1, dy = y2 - y1;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const glyph = Math.abs(dx) > Math.abs(dy) * 1.7 ? '~' : Math.abs(dy) > Math.abs(dx) * 1.25 ? ':' : dx * dy > 0 ? '\\' : '/';
    for (let step = 1; step < steps; step += 2) {
        const x = Math.floor(x1 + dx * step / steps), y = Math.floor(y1 + dy * step / steps);
        if (x < 0 || x >= rendererInstance.cols || y < 0 || y >= rendererInstance.rows) continue;
        rendererInstance.types[x][y] = RENDER_CELL_TYPES.GLITCH;
        rendererInstance.chars[x][y] = glyph;
        rendererInstance.brightness[x][y] = 0.48;
        rendererInstance.customColors[x][y] = color;
    }
}

function stampOrganicBoss(enemy, rendererInstance, brightness, blink, wounded) {
    const state = effect => enemy.organs?.find(entry => entry.effect === effect)?.state || OrganState.HEALTHY;
    const stateById = id => enemy.organs?.find(entry => entry.id === id)?.state || OrganState.HEALTHY;
    const aliveGlyph = (effect, healthy, hurt = 'x') => state(effect) === OrganState.HEALTHY ? healthy : state(effect) === OrganState.WOUNDED ? hurt : ' ';
    const organGlyph = (id, healthy, hurt = 'x') => stateById(id) === OrganState.HEALTHY ? healthy : stateById(id) === OrganState.WOUNDED ? hurt : ' ';
    if (enemy.type === 'boss_snake') {
        const eye = aliveGlyph('aim', enemy.genome.sensorGlyph);
        const gland = aliveGlyph('fire', blink ? '*' : '+', ':');
        for (let i = 8; i < enemy.trail.length; i += enemy.phase === 2 ? 10 : 7) {
            const pos = enemy.trail[i];
            const contraction = Math.floor(rendererInstance.animationTime / 6 + i / 7) % 2 ? '=' : '-';
            const shell = enemy.molted && i % 20 === 0 ? 'x' : enemy.genome.shellGlyph;
            stampPattern(rendererInstance, pos.x + 4, pos.y + 4, [` /${shell}\\ `, `<${contraction}${gland}${contraction}>`, ` \\${shell}/ `], Math.max(0.35, brightness * (1 - i / enemy.trail.length)), enemy.color);
        }
        const jaw = enemy.attackState === 'charge' ? '\\  V  /' : wounded ? '\\_x=x_/' : '\\_===_/';
        const rows = enemy.phase === 2
            ? [`  /${gland}#/\\#${gland}\\  `, ` /#${eye}####${eye}#\\ `, `<##/[${enemy.genome.coreGlyph}]\\##>`, ' \\#\\===/#/ ', `  ${jaw}  `]
            : [`  /##${gland}##\\  `, ` /##${eye}#${eye}##\\ `, `<###/${enemy.genome.coreGlyph}\\###>`, ' \\##===##/ ', `  ${jaw}  `];
        stampPattern(rendererInstance, enemy.x, enemy.y + 1, rows, brightness, enemy.color);
    } else if (enemy.type === 'boss_eye') {
        const pupil = aliveGlyph('aim', enemy.attackState === 'gaze' ? '!' : enemy.genome.coreGlyph);
        const irisGlyph = aliveGlyph('fire', '=', '-');
        const lobeGlyph = organGlyph('lobe', 'o', 'x');
        const offset = enemy.phase === 2 ? (blink ? 1 : -1) : 0;
        stampPattern(rendererInstance, enemy.x + offset, enemy.y + 2, [`   .${irisGlyph.repeat(7)}.   `, ` /${irisGlyph.repeat(11)}\\ `, `<${irisGlyph.repeat(4)}-----${irisGlyph.repeat(4)}>`, `<${irisGlyph.repeat(3)}--[${pupil}]--${irisGlyph.repeat(3)}>`, `<${irisGlyph.repeat(4)}-----${irisGlyph.repeat(4)}>`, ` \\${irisGlyph.repeat(11)}/ `, `   '${irisGlyph.repeat(7)}'   `], brightness, enemy.color);
        const lobes = enemy.phase === 2 ? Math.min(4, 2 + enemy.genome.tendrilCount) : 1;
        for (let i = 0; i < lobes; i++) {
            const angle = i / lobes * Math.PI * 2 + enemy.genome.bias * 0.4;
            const lx = enemy.x + 7 + Math.cos(angle) * (10 + i % 2 * 2);
            const ly = enemy.y + 6 + Math.sin(angle) * (5 + i % 2);
            stampTendril(rendererInstance, enemy.x + 7, enemy.y + 6, lx, ly, enemy.color);
            stampPattern(rendererInstance, lx - 1, ly, [`<${i % 2 ? lobeGlyph : pupil}>`], 0.75, enemy.color);
        }
    } else if (enemy.type === 'boss_carrier') {
        const core = aliveGlyph('vulnerability', enemy.genome.coreGlyph, '!');
        const bay = organGlyph('bay', blink ? 'o' : 'O', ':');
        const shell = aliveGlyph('armor', enemy.genome.shellGlyph, '/');
        stampPattern(rendererInstance, enemy.x, enemy.y, [` /${shell.repeat(16)}\\ `, `/(${bay})==(${bay})==(${bay})\\`, `|${shell.repeat(5)}~~~~~~${shell.repeat(5)}|`, '|==\\  ~  ~  /==|', `|===\\  {${core}}  /===|`, '|==~~\\====/~~==|', `|(${bay})  |==|  (${bay})|`, '\\_Y__/|==|\\__Y_/', `  ${blink ? 'v' : '|'} ${blink ? 'v' : '|'}  |==|  ${blink ? 'v' : '|'} ${blink ? 'v' : '|'} `, `  ~~~ /${bay}${bay}\\ ~~~  `, '     \\||||/     '], brightness, enemy.color);
        if (enemy.broodRuptured) stampPattern(rendererInstance, enemy.x + 3, enemy.y + 3, ['x~x~x', ' ~x~ '], 1, '#ff9de2');
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
        this.introTimer = BOSS_TYPES.has(type) ? 90 : 0;
        this.phase = 1;
        this.phaseTransitionTimer = 0;
        this.attackState = 'idle';
        this.telegraphTimer = 0;
        this.lockedAimAngle = 0;
        this.weakPoints = [];
        this.attackCycle = 0;
        this.energy = 0;
        this.parasiteCount = 0;
        this.symbioteBoosted = false;
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
        this.birthTimer = options.birthTimer ?? 32;

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
        if (this.type === 'boss_snake') this.weakPoints = [{ x: 4, y: 2, width: 3, height: 2, phase: 1 }];
        if (this.type === 'boss_eye') this.weakPoints = [{ x: 6, y: 4, width: 3, height: 3, phase: 1 }];
        if (this.type === 'boss_carrier') this.weakPoints = [{ x: 7, y: 4, width: 5, height: 3, phase: 2 }];
        this.maxHp = this.hp;
        const biology = createBiology(this.type, this.genomeSeed, this.width, this.height, this.inheritedAdaptations);
        this.genome = biology.genome;
        this.bodyPlan = biology.bodyPlan;
        this.organs = biology.bodyPlan.organs;
        this.coordinationRadius = 18 * getGenomeModifiers(this.genome).link;
    }

    applyKnockback(impactVx, impactVy) {
        this.vx += impactVx / this.mass;
        this.vy += impactVy / this.mass;
    }

    update(playerX, playerY, gridCols, gridRows, spawnedProjectiles, enemyManager) {
        this.life++;
        this.lastPlayerX = playerX;
        this.lastPlayerY = playerY;
        if (this.signalTimer > 0) this.signalTimer--;
        else this.signal = null;
        if (this.birthTimer > 0) this.birthTimer--;
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
                this.weakPoints.push({ x: 2, y: 2, width: 2, height: 2, phase: 2 }, { x: 8, y: 3, width: 2, height: 2, phase: 2 });
                for (let i = 0; i < 3; i++) enemyManager?.spawn(this.x - 2 - i * 2, this.y + 4 + i, 'cell_spore', { seed: hashSeed(`${this.genomeSeed}:shed:${i}`) });
            } else if (this.type === 'boss_eye') {
                this.fractured = true;
                for (let i = 0; i < 2; i++) enemyManager?.spawn(this.x + (i ? 13 : -2), this.y + 5 + i * 3, 'virus', { seed: hashSeed(`${this.genomeSeed}:lobe:${i}`), birthTimer: 60 });
            } else if (this.type === 'boss_carrier') {
                this.broodRuptured = true;
                const shell = this.organs.find(entry => entry.effect === 'armor');
                if (shell) { shell.hp = -1; shell.state = OrganState.RUPTURED; }
                this.weakPoints.push({ x: 3, y: 3, width: 4, height: 3, phase: 2 });
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
            moveX = (dx / dist) * 0.07;
            moveY = (dy / dist) * 0.07;
        } 
        else if (this.type === 'brute' || this.type === 'brute_medium') {
            moveX = (dx / dist) * 0.025;
            moveY = (dy / dist) * 0.025;
        }
        else if (this.type === 'shooter') {
            if (dist > 22) {
                moveX = (dx / dist) * 0.04;
                moveY = (dy / dist) * 0.04;
            } else if (dist < 12) {
                moveX = -(dx / dist) * 0.025;
                moveY = -(dy / dist) * 0.025;
            }

            // Bullet Hell Firing: Radial ring of 6 bullets
            if (this.fireCooldown <= 0 && dist < 30) {
                const aimDrift = (1 - organModifier(this, 'aim')) * 0.45 * this.genome.bias;
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2, 
                        Math.cos(a + aimDrift) * 0.2, Math.sin(a + aimDrift) * 0.2
                    ));
                }
                this.fireCooldown = 220 + Math.random() * 100;
            }
        }
        else if (this.type === 'worm') {
            // Slithers in a sinewave path chasing the player
            this.waveTime += 0.07;
            const baseAngle = Math.atan2(dy, dx);
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.6;
            moveX = Math.cos(slitherAngle) * 0.075;
            moveY = Math.sin(slitherAngle) * 0.075;

            // Bullet Hell Firing: 3-bullet spread towards player
            if (this.fireCooldown <= 0 && dist < 25) {
                const aimDrift = (1 - organModifier(this, 'aim')) * 0.55 * this.genome.bias;
                const spreadAngles = [-0.2, 0, 0.2];
                for (let sp of spreadAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(baseAngle + aimDrift + sp) * 0.22, Math.sin(baseAngle + aimDrift + sp) * 0.22
                    ));
                }
                this.fireCooldown = 180 + Math.random() * 80;
            }
        }
        else if (this.type === 'virus') {
            // Erratic teleporter and replicator
            if (Math.random() < 0.01) {
                this.x += (Math.random() - 0.5) * 5;
                this.y += (Math.random() - 0.5) * 5;
            }

            moveX = (dx / dist) * 0.045;
            moveY = (dy / dist) * 0.045;

            // Bullet Hell Firing: Diagonal 4-bullet cross
            if (this.fireCooldown <= 0 && dist < 28) {
                const aimDrift = (1 - organModifier(this, 'aim')) * 0.6 * this.genome.bias;
                const diagAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
                for (let a of diagAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(a + aimDrift) * 0.19, Math.sin(a + aimDrift) * 0.19
                    ));
                }
                this.fireCooldown = 200 + Math.random() * 80;
            }

            // Replicate clone
            this.replicateTimer--;
            if (this.replicateTimer <= 0) {
                this.replicateTimer = 360 + Math.random() * 180;
                if (enemyManager && enemyManager.enemies.filter(e => e.type === 'virus').length < 15) {
                    enemyManager.spawn(this.x + (Math.random() - 0.5) * 6, this.y + (Math.random() - 0.5) * 6, 'virus');
                    effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#ff3366', 10);
                }
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
            const host = enemyManager?.enemies
                ?.filter(other => other && other !== this && NORMAL_ENEMY_TYPES.has(other.type) && !ECOSYSTEM_TYPES.has(other.type))
                .map(other => ({ other, distance: Math.hypot(other.x - this.x, other.y - this.y) }))
                .sort((a, b) => a.distance - b.distance)[0]?.other;
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
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.8;
            const speedMult = this.phase === 2 ? 1.65 : 1;
            moveX = Math.cos(slitherAngle) * 0.04 * speedMult;
            moveY = Math.sin(slitherAngle) * 0.04 * speedMult;
            if (this.fireCooldown <= 30 && this.fireCooldown > 0) {
                this.attackState = 'charge';
                this.lockedAimAngle = baseAngle + (1 - organModifier(this, 'aim')) * 0.5 * this.genome.bias;
            }
            if (this.fireCooldown <= 0) {
                const spreads = this.phase === 2 ? [-0.48, -0.24, 0, 0.24, 0.48] : [-0.3, -0.15, 0, 0.15, 0.3];
                for (const spread of spreads) {
                    const a = this.lockedAimAngle + spread;
                    spawnedProjectiles.push(new EnemyProjectile(this.x + 5.5, this.y + 5.5, Math.cos(a) * 0.3, Math.sin(a) * 0.3, this.phase === 2 && spread === 0));
                }
                this.vx += Math.cos(this.lockedAimAngle) * (this.phase === 2 ? 1.25 : 0.85);
                this.vy += Math.sin(this.lockedAimAngle) * (this.phase === 2 ? 1.25 : 0.85);
                this.attackState = 'recover';
                this.attackCycle++;
                this.fireCooldown = this.phase === 2 ? 72 : 105;
            }
            if (this.life % 90 === 0) {
                for (let ox = -4; ox <= 4; ox += 2) for (let oy = -4; oy <= 4; oy += 2) {
                    if (ecosystem.damageTerrain(this.x + this.width / 2 + ox, this.y + this.height / 2 + oy, 1)) this.hp = Math.min(this.maxHp, this.hp + 0.35);
                }
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
                this.attackState = this.attackCycle % 2 === 0 ? 'gaze' : 'iris';
                this.lockedAimAngle = toPlayerA + (1 - organModifier(this, 'aim')) * 0.55 * this.genome.bias;
            }
            if (this.fireCooldown <= 0) {
                const cx = this.x + 7.5;
                const cy = this.y + 7.5;
                if (this.attackCycle % 2 === 0) {
                    for (let offset = -0.18; offset <= 0.18; offset += 0.09) {
                        const a = this.lockedAimAngle + offset;
                        spawnedProjectiles.push(new EnemyProjectile(cx, cy, Math.cos(a) * 0.38, Math.sin(a) * 0.38, offset === 0));
                    }
                } else {
                    const safeGap = this.lockedAimAngle;
                    const count = this.phase === 2 ? 20 : 14;
                    for (let i = 0; i < count; i++) {
                        const a = this.waveTime + i * Math.PI * 2 / count;
                        const gapDistance = Math.abs(Math.atan2(Math.sin(a - safeGap), Math.cos(a - safeGap)));
                        if (gapDistance < 0.42) continue;
                        spawnedProjectiles.push(new EnemyProjectile(cx, cy, Math.cos(a) * 0.27, Math.sin(a) * 0.27));
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
                this.attackState = 'broadside';
                this.lockedAimAngle = baseA;
            }
            if (this.fireCooldown <= 0) {
                if (enemyManager && enemyManager.enemies.length < 40 && organModifier(this, 'gestation') > 0.25) {
                    const spawnType = Math.random() < 0.65 ? 'drone' : 'virus';
                    enemyManager.spawn(this.x - 2, this.y + 4, spawnType);
                    enemyManager.spawn(this.x + 18, this.y + 4, spawnType);
                    if (this.phase === 2) enemyManager.spawn(this.x + 8, this.y + 11, 'kamikaze');
                }
                const angles = [-0.5, -0.25, 0, 0.25, 0.5].map(offset => this.lockedAimAngle + offset);
                for (let a of angles) {
                    spawnedProjectiles.push(new EnemyProjectile(this.x + 9, this.y + 5, Math.cos(a) * 0.31, Math.sin(a) * 0.31, this.phase === 2 && a === angles[2]));
                }
                this.attackCycle++;
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
        }
        else if (this.type === 'kamikaze') {
            if (dist < 8 && this.detonationTimer === null) this.detonationTimer = 60;
            if (this.detonationTimer !== null) {
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
            if (enemyManager && enemyManager.enemies) {
                const px = this.x + 1.5;
                const py = this.y + 1.5;
                this.linkedTargets = enemyManager.enemies
                    .filter(other => other && other !== this && other.type !== 'shield_projector' && other.hp > 0)
                    .map(other => ({ other, dist: Math.hypot(other.x + other.width / 2 - px, other.y + other.height / 2 - py) }))
                    .filter(entry => entry.dist < 16)
                    .sort((a, b) => a.dist - b.dist)
                    .slice(0, 2)
                    .map(entry => entry.other);
                for (const target of this.linkedTargets) target.shielded = true;
            }
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
            stampPattern(rendererInstance, this.x - Math.floor((bodyWidth - this.width) / 2), this.y - Math.max(0, Math.floor((livingBody.length - this.height) / 2)), livingBody, brightMult, this.color);
            if (this.signal && this.signalTimer > 0) stampPattern(rendererInstance, this.x + Math.floor(this.width / 2), this.y - 2, [this.signal], 1, PALETTE.enemyShot);
            if (this.birthTimer > 0 && blink) stampPattern(rendererInstance, this.x - 1, this.y + this.height + 1, [`<${this.genome.signature}>`], 0.55, '#8cff7a');
            if (this.symbioteBoosted) stampPattern(rendererInstance, this.x - 1, this.y - 1, [blink ? '~^~' : '^~^'], 1, '#ff9de2');
            return true;
        }
        if (this.type === 'drone') {
            const rows = this.vx < 0 ? [' /|', '<@|', ' \\|'] : ['|\\ ', '|@>', '|/ '];
            stampPattern(rendererInstance, this.x - 1, this.y - 1, rows, brightMult, this.color);
        } else if (this.type === 'brute') {
            stampPattern(rendererInstance, this.x, this.y, wounded ? ['#/\\/#', '#|x|#', '<[X]>', '#|x|#', '#\\//#'] : ['#/==\\#', '#|##|#', '<[X]>', '#|##|#', '#\\==/#'], brightMult, this.color);
        } else if (this.type === 'brute_medium') {
            stampPattern(rendererInstance, this.x, this.y, ['/##\\', '<X=>', '\\##/'], brightMult, this.color);
        } else if (this.type === 'shooter') {
            stampPattern(rendererInstance, this.x - 1, this.y, ['/[+]\\', blink ? '<-X->' : '<=X=>', '\\[+]/'], brightMult, this.color);
        } else if (this.type === 'worm') {
            for (let i = 2; i < this.trail.length; i += 3) {
                const pos = this.trail[i];
                stampPattern(rendererInstance, pos.x, pos.y, [i % 2 ? '-o-' : '=o='], Math.max(0.25, brightMult * (1 - i / this.trail.length)), this.color);
            }
            stampPattern(rendererInstance, this.x, this.y, [this.vx < 0 ? '<S=' : '=S>'], brightMult, this.color);
        } else if (this.type === 'virus') {
            stampPattern(rendererInstance, this.x - 1, this.y - 1, [blink ? ' \\|/ ' : '  |  ', '--{X}--', blink ? ' /|\\ ' : '  |  '], brightMult, this.color);
        } else if (this.type === 'kamikaze') {
            const count = this.detonationTimer === null ? '!' : String(Math.max(1, Math.ceil(this.detonationTimer / 20)));
            stampPattern(rendererInstance, this.x, this.y, [blink ? `<${count}>` : `[${count}]`], brightMult, this.color);
        } else if (this.type === 'shield_projector') {
            stampPattern(rendererInstance, this.x - 1, this.y, [' /A\\ ', '<{+}>', ' \\V/ ', ' _|_ '], brightMult, this.color);
        } else if (this.type === 'cell_spore') {
            stampPattern(rendererInstance, this.x, this.y, [blink ? '*' : '.'], brightMult, PALETTE.pickup);
        } else if (this.type === 'cell_colony') {
            stampPattern(rendererInstance, this.x, this.y, [blink ? 'o' : 'O'], brightMult, '#8cff7a');
        } else if (this.type === 'cell_parasite') {
            stampPattern(rendererInstance, this.x, this.y, [blink ? '~' : '^'], brightMult, '#ff9de2');
        } else if (this.type === 'cell_amalgam') {
            stampPattern(rendererInstance, this.x - 1, this.y - 1, [blink ? ' /o-o\\ ' : ' /O=O\\ ', '<{oXo}>', ' \\o_o/ ', '  /|\\  '], brightMult, '#8cff7a');
        } else if (this.type === 'boss_snake') {
            for (let i = 8; i < this.trail.length; i += this.phase === 2 ? 10 : 7) {
                const pos = this.trail[i];
                stampPattern(rendererInstance, pos.x + 4, pos.y + 4, [' /#\\ ', '<=== >', ' \\#/ '], Math.max(0.35, brightMult * (1 - i / this.trail.length)), this.color);
            }
            const jaw = this.attackState === 'charge' ? '\\  V  /' : wounded ? '\\_x=x_/' : '\\_===_/';
            stampPattern(rendererInstance, this.x, this.y + 1, this.phase === 2 ? ['  /##/\\##\\  ', ' /#o####o#\\ ', '<##/[X]\\##>', ' \\#\\===/#/ ', `  ${jaw}  `] : ['  /#####\\  ', ' /##o#o##\\ ', '<###/X\\###>', ' \\##===##/ ', `  ${jaw}  `], brightMult, this.color);
        } else if (this.type === 'boss_eye') {
            const pupil = this.attackState === 'gaze' ? '!' : '@';
            const offset = this.phase === 2 ? (blink ? 1 : -1) : 0;
            stampPattern(rendererInstance, this.x + offset, this.y + 2, ['   .=======.   ', ' /===========\\ ', '<====-----====>', `<===--[${pupil}]--===>`, '<====-----====>', ' \\===========/ ', '   `=======`   '], brightMult, this.color);
        } else if (this.type === 'boss_carrier') {
            const core = this.phase === 2 ? (blink ? '{@}' : '{X}') : '[#]';
            stampPattern(rendererInstance, this.x, this.y, [' /================\\ ', '/[T]====[T]====[T]\\', '|################|', '|==\\          /==|', `|===\\  ${core}  /===|`, '|====\\======/====|', '|[B]  |====|  [B]|', '\\____/|====|\\____/', '  v v  |====|  v v ', '   *   /====\\   *  ', '      <<<<<<      '], brightMult, this.color);
        } else {
            return false;
        }
        if (this.symbioteBoosted) {
            stampPattern(rendererInstance, this.x - 1, this.y - 1, [blink ? '~^~' : '^~^'], 1, '#ff9de2');
            stampPattern(rendererInstance, this.x + this.width, this.y + this.height, ['\\~'], 0.9, '#ff9de2');
        }
        return true;
    }

    stampToGrid(rendererInstance) {
        const brightMult = this.frozenTimer > 0 ? 0.35 : 1.0;
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

            // Draw shield rays connecting to shielded enemies
            if (enemies && enemies.enemies) {
                const px = this.x + 1.5;
                const py = this.y + 1.5;
                for (const other of this.linkedTargets || []) {
                    if (other && other.hp > 0) {
                        // Draw a simple dotted line between projector and other
                        const ow = other.width !== undefined ? other.width : 1;
                        const oh = other.height !== undefined ? other.height : 1;
                        const tx = other.x + ow/2;
                        const ty = other.y + oh/2;
                        const ldx = tx - px;
                        const ldy = ty - py;
                        const ldist = Math.sqrt(ldx*ldx + ldy*ldy) || 1;
                        
                        // Sample points along the line
                        for (let d = 1; d < ldist; d += 1.5) {
                            const lx = Math.floor(px + (ldx / ldist) * d);
                            const ly = Math.floor(py + (ldy / ldist) * d);
                            if (lx >= 0 && lx < rendererInstance.cols && ly >= 0 && ly < rendererInstance.rows) {
                                // Only draw on blank/rain cells to keep it clean
                                if (rendererInstance.types[lx][ly] === RENDER_CELL_TYPES.RAIN || rendererInstance.types[lx][ly] === RENDER_CELL_TYPES.UI_VOID) {
                                    rendererInstance.types[lx][ly] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                                    rendererInstance.chars[lx][ly] = '≈';
                                    rendererInstance.brightness[lx][ly] = 0.8 * brightMult;
                                    rendererInstance.customColors[lx][ly] = this.color;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    getHitbox() {
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
        const context = normalizeDamageContext(amount, hitX, hitY);
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
        this.hp -= context.amount;
        evolution.recordDamage(this, context, context.amount);
        stats.recordHit(context.amount);
        if (context.amount >= 1) effects.spawnDamageText(this.x + this.width / 2, this.y, `-${Math.round(context.amount * 10) / 10}`, this.color);

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
            effects.spawnGlitchExplosion(this.x + this.width/2, this.y + this.height/2, this.color, this.type === 'brute' ? 35 : 15);
        }

        if (this.type === 'kamikaze') {
            effects.spawnGlitchExplosion(this.x + 0.5, this.y + 0.5, '#ff3333', 25);
            // Spawn circular ring of 10 projectiles
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
                spawnedProjectiles.push(new EnemyProjectile(
                    this.x + 0.5, this.y + 0.5,
                    Math.cos(a) * 0.35, Math.sin(a) * 0.35
                ));
            }
        }
        
        // Bullet Hell: Brute releases a massive 8-bullet ring when killed/splitting!
        if (this.type === 'brute') {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                spawnedProjectiles.push(new EnemyProjectile(
                    this.x + this.width/2, this.y + this.height/2,
                    Math.cos(a) * 0.45, Math.sin(a) * 0.45
                ));
            }

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
        const enemy = new Enemy(x, y, type, { ...options, seed, adaptations });
        enemy.spawnId = this.spawnCounter;
        if (adaptations.length) { enemy.signal = 'E'; enemy.signalTimer = 75; enemy.birthTimer = Math.max(enemy.birthTimer, 55); }
        this.enemies.push(enemy);
        return enemy;
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
        const fused = this.spawn(x, y, 'cell_amalgam', { seed, adaptations, birthTimer: 70 });
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
            if (!a) continue;
            for (const b of colonyMind.query(a.x, a.y, 5)) {
                if (!b || b === a || b.spawnId <= a.spawnId) continue;
                if (!b) continue;
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
        for (const pack of colonyMind.packs.values()) {
            const members = [...pack.members].filter(enemy => enemy && this.enemies.includes(enemy) && enemy.hp > 0 && colonyMind.socialOrganWorks(enemy)).slice(0, 6);
            for (let i = 1; i < members.length; i++) stampTendril(rendererInstance, members[i - 1].x + members[i - 1].width / 2, members[i - 1].y + members[i - 1].height / 2, members[i].x + members[i].width / 2, members[i].y + members[i].height / 2, '#a94f8f');
        }
        for (const enemy of this.enemies) {
            if (enemy) {
                enemy.stampToGrid(rendererInstance);
                const minX = Math.max(0, Math.floor(enemy.x - 7));
                const maxX = Math.min(rendererInstance.cols - 1, Math.ceil(enemy.x + enemy.width + 7));
                const minY = Math.max(0, Math.floor(enemy.y - 7));
                const maxY = Math.min(rendererInstance.rows - 1, Math.ceil(enemy.y + enemy.height + 7));
                for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
                    if (rendererInstance.types[x][y] === RENDER_CELL_TYPES.ENEMY_GLITCH) rendererInstance.customColors[x][y] = enemy.color;
                }
            }
        }
        for (const p of this.projectiles) {
            if (p) p.stampToGrid(rendererInstance);
        }
    }
}

export const enemies = new EnemyManager();
export { EnemyManager as EnemyManagerClass };
