import { RENDER_CELL_TYPES } from './renderer.js';
import { matrixRain } from './matrixRain.js';
import { effects } from './effects.js';

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

        if (this.type === 'rocket') {
            if (!this.targetEnemy || this.targetEnemy.hp <= 0) {
                let minDist = 40; 
                this.targetEnemy = null;
                for (const e of enemiesList) {
                    const dx = e.x - this.x;
                    const dy = e.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < minDist) {
                        minDist = dist;
                        this.targetEnemy = e;
                    }
                }
            }
            if (this.targetEnemy) {
                const dx = this.targetEnemy.x + this.targetEnemy.width/2 - this.x;
                const dy = this.targetEnemy.y + this.targetEnemy.height/2 - this.y;
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

            // Obstacle collision check
            if (p.type !== 'laser') {
                const ix = Math.floor(p.x);
                const iy = Math.floor(p.y);
                if (ix >= 0 && ix < matrixRain.cols && iy >= 0 && iy < matrixRain.rows) {
                    if (matrixRain.obstacles && matrixRain.obstacles[ix][iy]) {
                        // Damage obstacle, trigger impact spark, destroy projectile
                        matrixRain.damageObstacle(ix, iy, p.damage);
                        effects.spawnImpactSparks(p.x, p.y);
                        p.life = 0;
                    }
                }
            }

            if (p.life <= 0) this.projectiles.splice(i, 1);
        }
    }

    fire(playerInstance, targetX, targetY) {
        if (playerInstance.fireCooldown > 0) return false;
        
        const px = playerInstance.x + playerInstance.width / 2;
        const py = playerInstance.y + playerInstance.height / 2;
        
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        
        const streams = 1 + playerInstance.upgrades.extraThreads;
        const type = playerInstance.weaponType;

        if (type === 'auto_blaster') {
            const speed = 1.0;
            for (let i = 0; i < streams; i++) {
                const spread = (Math.random() - 0.5) * 0.2 * streams;
                const angle = Math.atan2(uy, ux) + spread;
                this.projectiles.push(new Projectile(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, { damage: 5.0, type: 'bullet', life: 120 }));
            }
            playerInstance.fireCooldown = playerInstance.fireRate;
        } 
        else if (type === 'null_laser') {
            const maxRange = 90; // extended laser range to 90
            for (let i = 0; i < streams; i++) {
                const spread = (i - (streams - 1) / 2) * 0.02; // tight parallel streams
                const angle = Math.atan2(uy, ux) + spread;
                const lux = Math.cos(angle);
                const luy = Math.sin(angle);
                
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

                for (let d = 0.5; d < maxRange; d += 0.5) {
                    const tx = px + lux * d;
                    const ty = py + luy * d;
                    const ix = Math.floor(tx);
                    const iy = Math.floor(ty);
                    
                    if (ix < 0 || ix >= matrixRain.cols || iy < 0 || iy >= matrixRain.rows) {
                        break;
                    }
                    
                    if (matrixRain.obstacles && matrixRain.obstacles[ix][iy]) {
                        matrixRain.damageObstacle(ix, iy, 0.5);
                        effects.spawnImpactSparks(tx, ty);
                        break;
                    }
                    
                    const laserProj = new Projectile(tx, ty, 0, 0, {
                        damage: 0.2, // laser damage balanced to 0.2 (1/5 of standard 1.0)
                        type: 'laser',
                        life: 8, // keep beam visible across fire ticks
                        piercing: true
                    });
                    laserProj.char = char;
                    this.projectiles.push(laserProj);
                }
            }
            playerInstance.fireCooldown = 8; // even slower fire rate for laser (cooldown 8 ticks)

            if (this.laserSoundCooldown <= 0) {
                this.laserSoundCooldown = 6;
                return true;
            } else {
                this.laserSoundCooldown--;
                return false;
            }
        }
        else if (type === 'seeker_rockets') {
            const speed = 0.45; // increased launch speed from 0.25
            for (let i = 0; i < streams; i++) {
                const spread = (Math.random() - 0.5) * 0.8;
                const angle = Math.atan2(uy, ux) + spread;
                this.projectiles.push(new Projectile(px, py, Math.cos(angle)*speed, Math.sin(angle)*speed, { damage: 5.0, type: 'rocket', life: 240, width: 2, height: 2 }));
            }
            playerInstance.fireCooldown = playerInstance.fireRate * 3.0; 
        }
        return true;
    }

    stampToGrid(rendererInstance) {
        for (const p of this.projectiles) p.stampToGrid(rendererInstance);
    }
}
export const weapons = new WeaponSystem();
export { Projectile as ProjectileBase };
