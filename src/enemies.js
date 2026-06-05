import { RENDER_CELL_TYPES } from './renderer.js';
import { effects } from './effects.js';
import { matrixRain } from './matrixRain.js';

const GLYPHS = '01.:;|/\\-_';
const BRUTE_GLYPHS = ['█', '▓', '▒', '░', '#', '■', '▪', ' ', '█', '█'];

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
            const wobble = Math.sin(angle * 5 + Date.now() * 0.007) * 0.7;
            
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
                    const char = charSet[Math.floor(Math.random() * charSet.length)];
                    rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                    rendererInstance.chars[gx][gy] = char;
                    rendererInstance.brightness[gx][gy] = (0.5 + Math.random() * 0.5) * brightnessMult;
                }
            }
        }
    }
}

export class EnemyProjectile {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = '#ff3366'; // red bullets
        this.damage = 1;
        this.life = 120;
    }

    update() {
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
        }
    }

    getHitbox() { return { x: this.x, y: this.y, width: 1, height: 1, isCircle: false }; }
}

export class Enemy {
    constructor(x, y, type = 'drone') {
        this.x = x; this.y = y;
        this.type = type;
        
        this.vx = 0; this.vy = 0;
        this.hp = 1; this.maxHp = 1;
        this.xpValue = 10;
        
        this.fireCooldown = 30 + Math.random() * 60; // faster fire rate for bullet hell
        this.color = '#ff3366';

        // Physics
        this.mass = 1.0;
        this.friction = 0.85;

        this.trail = [];
        this.waveTime = Math.random() * 10;
        this.replicateTimer = 180 + Math.random() * 90;

        this.initType();
    }

    initType() {
        switch(this.type) {
            case 'drone': // Swarmers — glitch snake of blobs
                this.hp = 2; this.xpValue = 15;
                this.width = 1; this.height = 1; 
                this.mass = 0.8;
                break;
            case 'brute': // Giant tank — splits into medium brutes
                this.hp = 18; this.xpValue = 50;
                this.width = 5; this.height = 5;
                this.mass = 3.0;
                break;
            case 'brute_medium': // Split offspring of brute
                this.hp = 6; this.xpValue = 20;
                this.width = 3; this.height = 3;
                this.mass = 1.5;
                break;
            case 'shooter': // Keeps distance and fires rings
                this.hp = 4; this.xpValue = 25;
                this.width = 3; this.height = 3;
                this.mass = 1.0;
                break;
            case 'worm': // Slitherer sinewave worm of segments
                this.hp = 6; this.xpValue = 30;
                this.width = 1; this.height = 1;
                this.mass = 1.1;
                break;
            case 'virus': // Erratic teleporter and replicator
                this.hp = 4; this.xpValue = 35;
                this.width = 3; this.height = 3;
                this.mass = 1.2;
                break;
        }
        this.maxHp = this.hp;
    }

    applyKnockback(impactVx, impactVy) {
        this.vx += impactVx / this.mass;
        this.vy += impactVy / this.mass;
    }

    update(playerX, playerY, gridCols, gridRows, spawnedProjectiles, enemyManager) {
        this.fireCooldown--;

        // Track trail history for glitch tails/worms
        this.trail.unshift({ x: this.x, y: this.y, vx: this.vx, vy: this.vy });
        const maxTrail = this.type === 'worm' ? 12 : 8;
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
            moveX = (dx / dist) * 0.14;
            moveY = (dy / dist) * 0.14;
        } 
        else if (this.type === 'brute' || this.type === 'brute_medium') {
            moveX = (dx / dist) * 0.05;
            moveY = (dy / dist) * 0.05;
        }
        else if (this.type === 'shooter') {
            if (dist > 22) {
                moveX = (dx / dist) * 0.08;
                moveY = (dy / dist) * 0.08;
            } else if (dist < 12) {
                moveX = -(dx / dist) * 0.05;
                moveY = -(dy / dist) * 0.05;
            }

            // Bullet Hell Firing: Radial ring of 6 bullets
            if (this.fireCooldown <= 0 && dist < 30) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2, 
                        Math.cos(a) * 0.4, Math.sin(a) * 0.4
                    ));
                }
                this.fireCooldown = 110 + Math.random() * 50;
            }
        }
        else if (this.type === 'worm') {
            // Slithers in a sinewave path chasing the player
            this.waveTime += 0.15;
            const baseAngle = Math.atan2(dy, dx);
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.6;
            moveX = Math.cos(slitherAngle) * 0.15;
            moveY = Math.sin(slitherAngle) * 0.15;

            // Bullet Hell Firing: 3-bullet spread towards player
            if (this.fireCooldown <= 0 && dist < 25) {
                const spreadAngles = [-0.2, 0, 0.2];
                for (let sp of spreadAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(baseAngle + sp) * 0.45, Math.sin(baseAngle + sp) * 0.45
                    ));
                }
                this.fireCooldown = 90 + Math.random() * 40;
            }
        }
        else if (this.type === 'virus') {
            // Erratic teleporter and replicator
            if (Math.random() < 0.02) {
                this.x += (Math.random() - 0.5) * 5;
                this.y += (Math.random() - 0.5) * 5;
            }

            moveX = (dx / dist) * 0.09;
            moveY = (dy / dist) * 0.09;

            // Bullet Hell Firing: Diagonal 4-bullet cross
            if (this.fireCooldown <= 0 && dist < 28) {
                const diagAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
                for (let a of diagAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(a) * 0.38, Math.sin(a) * 0.38
                    ));
                }
                this.fireCooldown = 100 + Math.random() * 40;
            }

            // Replicate clone
            this.replicateTimer--;
            if (this.replicateTimer <= 0) {
                this.replicateTimer = 180 + Math.random() * 90;
                if (enemyManager && enemyManager.enemies.filter(e => e.type === 'virus').length < 15) {
                    enemyManager.spawn(this.x + (Math.random() - 0.5) * 6, this.y + (Math.random() - 0.5) * 6, 'virus');
                    effects.spawnGlitchExplosion(this.x + 1.5, this.y + 1.5, '#ff3366', 10);
                }
            }
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

        if (insideGlitchField) {
            moveX *= 0.4;
            moveY *= 0.4;
            this.vx *= 0.55;
            this.vy *= 0.55;
        }

        // Collision Check with Obstacles
        const nextX = this.x + this.vx + moveX;
        const nextY = this.y + this.vy + moveY;
        let collides = false;

        for (let w = 0; w < this.width; w++) {
            for (let h = 0; h < this.height; h++) {
                const ex_cell = Math.floor(nextX + w);
                const ey_cell = Math.floor(nextY + h);
                if (ex_cell >= 0 && ex_cell < gridCols && ey_cell >= 0 && ey_cell < gridRows) {
                    if (matrixRain.obstacles && matrixRain.obstacles[ex_cell][ey_cell]) {
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

    stampToGrid(rendererInstance) {
        if (this.type === 'drone') {
            // Glitch Snake trail (chain of wobbly organic blobs)
            for (let i = 0; i < this.trail.length; i++) {
                const pos = this.trail[i];
                const radius = 1.0 - (i / this.trail.length) * 0.7;
                stampOrganicBlob(rendererInstance, pos.x + 0.5, pos.y + 0.5, radius, GLYPHS, 0.7 * (1 - i / this.trail.length));
            }
            // Head
            stampOrganicBlob(rendererInstance, this.x + 0.5, this.y + 0.5, 1.2, GLYPHS, 1.0, { x: this.vx || 0.1, y: this.vy || 0.1 });
        } 
        else if (this.type === 'brute') {
            // Large wobbly organic blob
            stampOrganicBlob(rendererInstance, this.x + 2.5, this.y + 2.5, 2.8, BRUTE_GLYPHS, 1.0);
        }
        else if (this.type === 'brute_medium') {
            // Medium wobbly organic blob
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, 1.8, BRUTE_GLYPHS, 0.9);
        }
        else if (this.type === 'shooter') {
            // Shooter teardrop shape blob pointing towards movement
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, 1.5, GLYPHS, 0.9, { x: this.vx || 0.1, y: this.vy || 0.1 });
        }
        else if (this.type === 'worm') {
            // Slitherer chain of wobbly blobs
            for (let i = 0; i < this.trail.length; i++) {
                const pos = this.trail[i];
                const char = (i % 2 === 0) ? ['O'] : ['0'];
                stampOrganicBlob(rendererInstance, pos.x + 0.5, pos.y + 0.5, 1.1, char, 0.9 * (1 - i / this.trail.length));
            }
        }
        else if (this.type === 'virus') {
            // Pulsating virus blob
            const scale = 1.4 + Math.sin(Date.now() * 0.02) * 0.2;
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, scale, ['§', '*', '#'], 0.85);
        }
    }

    getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height, isCircle: false }; }

    takeDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }

    onDeath(enemyManager, spawnedProjectiles = []) {
        effects.spawnGlitchExplosion(this.x + this.width/2, this.y + this.height/2, this.color, this.type === 'brute' ? 35 : 15);
        
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
    }

    reset() {
        this.enemies = [];
        this.projectiles = [];
    }

    spawn(x, y, type) {
        this.enemies.push(new Enemy(x, y, type));
    }

    update(playerInstance, gridCols, gridRows) {
        const spawnedProjectiles = [];

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.update(playerInstance.x, playerInstance.y, gridCols, gridRows, spawnedProjectiles, this);

            // Clean up offscreen enemies
            if (enemy.x < -30 || enemy.x > gridCols + 30 || enemy.y < -30 || enemy.y > gridRows + 30) {
                this.enemies.splice(i, 1);
            }
        }

        for (const proj of spawnedProjectiles) this.projectiles.push(proj);

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update();
            if (p.life <= 0 || p.x < 0 || p.x > gridCols || p.y < 0 || p.y > gridRows) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    stampToGrid(rendererInstance) {
        for (const enemy of this.enemies) enemy.stampToGrid(rendererInstance);
        for (const p of this.projectiles) p.stampToGrid(rendererInstance);
    }
}

export const enemies = new EnemyManager();
export { EnemyManager as EnemyManagerClass };
