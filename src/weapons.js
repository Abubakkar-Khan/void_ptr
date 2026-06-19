import { RENDER_CELL_TYPES } from './renderer.js';
import { matrixRain } from './matrixRain.js';
import { effects } from './effects.js';
import { enemies } from './enemies.js';
import { audio } from './audio.js';
import { collision } from './collision.js';
import { COMBAT_CONFIG, PALETTE, WEAPON_DEFS } from './config.js';
import { stats } from './stats.js';
import { ecosystem } from './ecosystem.js';

export function findNearestTarget(originX, originY, enemiesList, maxRadius = COMBAT_CONFIG.aimAssistRadius) {
    let target = null;
    let bestDistance = maxRadius;
    for (const enemy of enemiesList || []) {
        if (!enemy || enemy.hp <= 0 || enemy.introTimer > 0) continue;
        const ex = enemy.x + (enemy.width || 1) / 2;
        const ey = enemy.y + (enemy.height || 1) / 2;
        const distance = Math.hypot(ex - originX, ey - originY);
        if (distance < bestDistance) {
            bestDistance = distance;
            target = enemy;
        }
    }
    return target;
}

export function resolveAssistedAim(originX, originY, manualVector, enemiesList, weaponType = 'auto_blaster') {
    const fallback = { x: manualVector.x, y: manualVector.y, target: null };
    let best = null;
    let bestAngle = COMBAT_CONFIG.aimAssistConeRadians;
    for (const enemy of enemiesList || []) {
        if (!enemy || enemy.hp <= 0 || enemy.introTimer > 0) continue;
        const dx = enemy.x + (enemy.width || 1) / 2 - originX;
        const dy = enemy.y + (enemy.height || 1) / 2 - originY;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance > COMBAT_CONFIG.aimAssistRadius) continue;
        const dot = Math.max(-1, Math.min(1, (manualVector.x * dx + manualVector.y * dy) / distance));
        const angle = Math.acos(dot);
        if (angle < bestAngle) {
            bestAngle = angle;
            best = { enemy, x: dx / distance, y: dy / distance };
        }
    }
    if (!best) return fallback;
    const strength = weaponType === 'null_laser' ? 0.4 : COMBAT_CONFIG.aimAssistStrength;
    const x = manualVector.x * (1 - strength) + best.x * strength;
    const y = manualVector.y * (1 - strength) + best.y * strength;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length, target: best.enemy };
}

export class Projectile {
    constructor(x, y, vx, vy, options = {}) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.width = options.width || 1;
        this.height = options.height || 1;
        this.damage = options.damage || 1;
        this.life = options.life || 240; 
        this.type = options.type || 'bullet';
        this.piercing = options.piercing || false;
        this.targetEnemy = null; // For rockets
        this.hasDied = false;
        this.canFork = options.canFork !== false;
        this.blastRadius = options.blastRadius || WEAPON_DEFS.seeker_rockets.blastRadius;
        this.blastMultiplier = options.blastMultiplier || WEAPON_DEFS.seeker_rockets.blastMultiplier;
        this.hitEnemies = new Set();
        
        // Calculate shape based on velocity angle
        const angle = Math.atan2(this.vy, this.vx) * (180 / Math.PI);
        this.char = this.getCharForAngle(angle);
    }

    getCharForAngle(deg) {
        // Normalize to 0-360
        let a = deg;
        if (a < 0) a += 360;
        
        // Snap to nearest 45
        if ((a >= 337.5 || a < 22.5) || (a >= 157.5 && a < 202.5)) return '-';
        if ((a >= 67.5 && a < 112.5) || (a >= 247.5 && a < 292.5)) return '|';
        if ((a >= 22.5 && a < 67.5) || (a >= 202.5 && a < 247.5)) return '\\';
        if ((a >= 112.5 && a < 157.5) || (a >= 292.5 && a < 337.5)) return '/';
        return '*';
    }

    update(enemiesList) {
        this.life--;

        if (this.type === 'bullet') {
            const target = findNearestTarget(this.x, this.y, enemiesList, 6);
            if (target) {
                const dx = target.x + target.width / 2 - this.x;
                const dy = target.y + target.height / 2 - this.y;
                const distance = Math.hypot(dx, dy) || 1;
                const speed = Math.hypot(this.vx, this.vy) || WEAPON_DEFS.auto_blaster.projectileSpeed;
                this.vx = this.vx * 0.94 + (dx / distance) * speed * 0.06;
                this.vy = this.vy * 0.94 + (dy / distance) * speed * 0.06;
            }
        }

        if (this.type === 'rocket') {
            if (!this.targetEnemy || !enemiesList.includes(this.targetEnemy) || this.targetEnemy.hp <= 0) {
                let minDist = 40; 
                this.targetEnemy = null;
                for (const e of enemiesList) {
                    if (!e || e.x === undefined || e.y === undefined) continue;
                    const dx = e.x - this.x;
                    const dy = e.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < minDist) {
                        minDist = dist;
                        this.targetEnemy = e;
                    }
                }
            }
            if (this.targetEnemy && this.targetEnemy.x !== undefined && this.targetEnemy.y !== undefined) {
                const ew = this.targetEnemy.width !== undefined ? this.targetEnemy.width : 1;
                const eh = this.targetEnemy.height !== undefined ? this.targetEnemy.height : 1;
                const dx = this.targetEnemy.x + ew/2 - this.x;
                const dy = this.targetEnemy.y + eh/2 - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    this.vx += (dx / dist) * 0.15; // increased steering force
                    this.vy += (dy / dist) * 0.15;
                }
            }
            
            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            if (speed > 1.4) { // increased speed cap from 0.9
                this.vx = (this.vx / speed) * 1.4;
                this.vy = (this.vy / speed) * 1.4;
            }
            
            const angle = Math.atan2(this.vy, this.vx) * (180 / Math.PI);
            this.char = this.getCharForAngle(angle);
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    stampToGrid(rendererInstance) {
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        
        if (ix >= 0 && ix < rendererInstance.cols && iy >= 0 && iy < rendererInstance.rows) {
            rendererInstance.types[ix][iy] = RENDER_CELL_TYPES.BULLET_VOID;
            rendererInstance.chars[ix][iy] = this.char;
            rendererInstance.customColors[ix][iy] = PALETTE.playerShot;
            
            if (this.type === 'laser') {
                rendererInstance.brightness[ix][iy] = 1.0;
            } else if (this.type === 'rocket') {
                rendererInstance.brightness[ix][iy] = 0.9;
                rendererInstance.chars[ix][iy] = '*'; // Rockets are asterisks
            } else {
                rendererInstance.brightness[ix][iy] = 0.8;
            }
        }
    }
    onDeath() {
        if (this.hasDied) return;
        this.hasDied = true;
        if (this.type === 'rocket') {
            effects.spawnGlitchExplosion(this.x, this.y, '#00ff41', 15);
            audio.playExplosion();
            const blastRadius = this.blastRadius;
            const blastDmg = this.damage * this.blastMultiplier;
            if (enemies && enemies.enemies) {
                for (const e of enemies.enemies) {
                    if (e && e.hp > 0 && e.x !== undefined && e.y !== undefined) {
                        const odx = e.x + e.width/2 - this.x;
                        const ody = e.y + e.height/2 - this.y;
                        const odist = Math.sqrt(odx*odx + ody*ody);
                        if (odist < blastRadius) {
                            e.takeDamage(blastDmg);
                            e.applyKnockback(odx / (odist || 1) * 1.5, ody / (odist || 1) * 1.5);
                        }
                    }
                }
            }
        }
    }
    getHitbox() {
        return { x: this.x - this.width/2, y: this.y - this.height/2, width: this.width, height: this.height };
    }
}

class WeaponSystem {
    constructor() {
        this.projectiles = [];
        this.laserSoundCooldown = 0;
    }
    reset() {
        this.projectiles = [];
        this.laserSoundCooldown = 0;
    }

    update(enemiesList) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(enemiesList);

            // Obstacle collision check (for non-laser bullets)
            if (p.type !== 'visual_laser') {
                const ix = Math.floor(p.x);
                const iy = Math.floor(p.y);
                if (ix >= 0 && ix < matrixRain.cols && iy >= 0 && iy < matrixRain.rows) {
                    if (matrixRain.obstacles && matrixRain.obstacles[ix][iy]) {
                        const destroyed = matrixRain.damageObstacle(ix, iy, p.damage);
                        if (destroyed) ecosystem.addTerrain(ix, iy, 1);
                        effects.spawnImpactSparks(p.x, p.y);
                        p.life = 0;
                    } else if (ecosystem.blocksProjectile(ix, iy)) {
                        ecosystem.damageTerrain(ix, iy, Math.max(1, p.damage / 8));
                        effects.spawnImpactSparks(p.x, p.y, '#8cff7a');
                        p.life = 0;
                    }
                }
            }

            if (p.life <= 0) {
                p.onDeath();
                this.projectiles.splice(i, 1);
            }
        }
    }

    resolveTarget(playerInstance, manualVector, enemiesList, idleTicks) {
        const px = playerInstance.x + playerInstance.width / 2;
        const py = playerInstance.y + playerInstance.height / 2;
        if (!manualVector) return null;
        const assisted = resolveAssistedAim(px, py, manualVector, enemiesList, playerInstance.weaponType);
        return { x: px + assisted.x * 50, y: py + assisted.y * 50, target: assisted.target, automatic: false };
    }

    fire(playerInstance, targetX, targetY) {
        if (playerInstance.fireCooldown > 0) return false;
        if (playerInstance.weaponType === 'null_laser' && playerInstance.overheated) return false;
        stats.recordShot();
        
        const px = playerInstance.x + playerInstance.width / 2;
        const py = playerInstance.y + playerInstance.height / 2;
        
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        
        const streams = 1 + playerInstance.upgrades.extraThreads;
        const type = playerInstance.weaponType;
        const chaosDamage = 1 + (playerInstance.upgrades.chaosDamage || 0);

        if (type === 'auto_blaster') {
            const speed = WEAPON_DEFS.auto_blaster.projectileSpeed;
            const dmg = (WEAPON_DEFS.auto_blaster.baseDamage + (playerInstance.upgrades.blasterDmg || 0) * WEAPON_DEFS.auto_blaster.damagePerLevel) * chaosDamage;
            for (let i = 0; i < streams; i++) {
                const spread = (Math.random() - 0.5) * 0.2 * streams;
                const angle = Math.atan2(uy, ux) + spread;
                this.projectiles.push(new Projectile(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, { damage: dmg, type: 'bullet', life: 120, width: COMBAT_CONFIG.projectileHitboxScale, height: COMBAT_CONFIG.projectileHitboxScale, piercing: (playerInstance.upgrades.blasterDmg || 0) >= 4 }));
            }
            playerInstance.fireCooldown = playerInstance.fireRate;
        } 
        else if (type === 'null_laser') {
            const maxRange = WEAPON_DEFS.null_laser.range;
            const evolved = (playerInstance.upgrades.laserDmg || 0) >= 4;
            const dmg = (WEAPON_DEFS.null_laser.baseDamage + (playerInstance.upgrades.laserDmg || 0) * WEAPON_DEFS.null_laser.damagePerLevel) * chaosDamage * (evolved ? 1.25 : 1);
            
            for (let i = 0; i < streams; i++) {
                const spread = (i - (streams - 1) / 2) * 0.02; // tight parallel streams
                const angle = Math.atan2(uy, ux) + spread;
                let lux = Math.cos(angle);
                let luy = Math.sin(angle);
                let originX = px;
                let originY = py;
                let reflected = false;
                
                let char = '═';
                if (Math.abs(lux) > Math.abs(luy) * 1.5) {
                    char = '═';
                } else if (Math.abs(luy) > Math.abs(lux) * 1.5) {
                    char = '║';
                } else if (lux * luy > 0) {
                    char = '\\';
                } else {
                    char = '/';
                }

                const hitEnemies = new Set();

                for (let step = 1, d = 1.0; step < maxRange; step++, d += 1.0) {
                    const tx = originX + lux * d;
                    const ty = originY + luy * d;
                    const ix = Math.floor(tx);
                    const iy = Math.floor(ty);
                    
                    if (ix < 0 || ix >= matrixRain.cols || iy < 0 || iy >= matrixRain.rows) {
                        break;
                    }
                    
                    if (matrixRain.obstacles && matrixRain.obstacles[ix][iy]) {
                        const destroyed = matrixRain.damageObstacle(ix, iy, 0.5);
                        if (destroyed) ecosystem.addTerrain(ix, iy, 1);
                        effects.spawnImpactSparks(tx, ty);
                        if (playerInstance.upgrades.pointerArithmetic && !reflected) {
                            const prevX = Math.floor(tx - lux);
                            const prevY = Math.floor(ty - luy);
                            const hitVerticalFace = matrixRain.obstacles[ix]?.[prevY] && !matrixRain.obstacles[prevX]?.[iy];
                            if (hitVerticalFace) lux *= -1;
                            else luy *= -1;
                            originX = tx - lux;
                            originY = ty - luy;
                            reflected = true;
                            d = 0;
                            continue;
                        }
                        break;
                    }
                    if (ecosystem.blocksProjectile(ix, iy)) {
                        ecosystem.damageTerrain(ix, iy, Math.max(1, dmg / 10));
                        effects.spawnImpactSparks(tx, ty, '#8cff7a');
                        break;
                    }

                    // Instant collision check against enemies
                    if (enemies && enemies.enemies) {
                        const cellHitbox = { x: tx - 0.5, y: ty - 0.5, width: 1.0, height: 1.0 };
                        for (const enemy of enemies.enemies) {
                            if (enemy && enemy.hp > 0 && !hitEnemies.has(enemy)) {
                                const eBox = enemy.getHitbox();
                                if (collision.checkOverlap(cellHitbox, eBox)) {
                                    hitEnemies.add(enemy);
                                    enemy.applyKnockback(lux * 1.5, luy * 1.5);
                                    enemy.takeDamage(dmg, tx, ty);
                                    effects.spawnImpactSparks(tx, ty);
                                    audio.playHit();
                                }
                            }
                        }
                    }
                    
                    // Visual laser projectile (deals no collision damage, short duration)
                    const laserProj = new Projectile(tx, ty, 0, 0, {
                        damage: 0,
                        type: 'visual_laser',
                        life: 6,
                        piercing: true
                    });
                    laserProj.char = char;
                    this.projectiles.push(laserProj);
                }
            }
            playerInstance.fireCooldown = Math.max(8, playerInstance.fireRate * 1.2);
            playerInstance.heat += WEAPON_DEFS.null_laser.heatPerShot * (evolved ? 0.55 : 1) * (1 + (streams - 1) * 0.25);
            if (playerInstance.heat >= WEAPON_DEFS.null_laser.maxHeat) {
                playerInstance.heat = WEAPON_DEFS.null_laser.maxHeat;
                playerInstance.overheated = true;
            }
            return true;
        }
        else if (type === 'seeker_rockets') {
            const speed = WEAPON_DEFS.seeker_rockets.projectileSpeed;
            const dmg = (WEAPON_DEFS.seeker_rockets.baseDamage + (playerInstance.upgrades.seekerDmg || 0) * WEAPON_DEFS.seeker_rockets.damagePerLevel) * chaosDamage;
            for (let i = 0; i < streams; i++) {
                const spread = (Math.random() - 0.5) * 0.8;
                const angle = Math.atan2(uy, ux) + spread;
                const evolved = (playerInstance.upgrades.seekerDmg || 0) >= 4;
                this.projectiles.push(new Projectile(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, { damage: dmg, type: 'rocket', life: 240, width: 2, height: 2, blastRadius: evolved ? 9 : WEAPON_DEFS.seeker_rockets.blastRadius, blastMultiplier: evolved ? 1 : WEAPON_DEFS.seeker_rockets.blastMultiplier }));
            }
            playerInstance.fireCooldown = playerInstance.fireRate * WEAPON_DEFS.seeker_rockets.cooldownMultiplier;
        }
        return true;
    }

    spawnFork(projectile, level) {
        if (!level || !projectile.canFork || projectile.type === 'rocket' || projectile.type === 'visual_laser') return;
        const baseAngle = Math.atan2(projectile.vy, projectile.vx);
        const count = level + 1;
        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * 0.55;
            const speed = Math.max(0.8, Math.hypot(projectile.vx, projectile.vy) * 0.85);
            this.projectiles.push(new Projectile(projectile.x, projectile.y, Math.cos(baseAngle + offset) * speed, Math.sin(baseAngle + offset) * speed, {
                damage: projectile.damage * 0.45,
                type: 'bullet',
                life: 70,
                canFork: false
            }));
        }
    }

    stampToGrid(rendererInstance) {
        for (const p of this.projectiles) p.stampToGrid(rendererInstance);
    }
}
export const weapons = new WeaponSystem();
export { Projectile as ProjectileBase };
