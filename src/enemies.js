import { RENDER_CELL_TYPES } from './renderer.js';
import { effects } from './effects.js';
import { matrixRain } from './matrixRain.js';

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
        this.friction = 0.92; // 60 FPS scaling

        this.trail = [];
        this.waveTime = Math.random() * 10;
        this.replicateTimer = 360 + Math.random() * 180; // 60 FPS scaling
        this.frozenTimer = 0;

        this.initType();
    }

    initType() {
        this.life = 0;
        switch(this.type) {
            case 'drone': // Swarmers
                this.hp = 14; this.xpValue = 15;
                this.width = 1; this.height = 1; 
                this.mass = 0.8;
                break;
            case 'brute': // Giant tank
                this.hp = 60; this.xpValue = 50;
                this.width = 5; this.height = 5;
                this.mass = 3.0;
                break;
            case 'brute_medium': // Split offspring of brute
                this.hp = 30; this.xpValue = 20;
                this.width = 3; this.height = 3;
                this.mass = 1.5;
                break;
            case 'shooter': // Keeps distance and fires rings
                this.hp = 25; this.xpValue = 25;
                this.width = 3; this.height = 3;
                this.mass = 1.0;
                break;
            case 'worm': // Slitherer sinewave worm of segments
                this.hp = 30; this.xpValue = 30;
                this.width = 1; this.height = 1;
                this.mass = 1.1;
                break;
            case 'virus': // Erratic teleporter and replicator
                this.hp = 25; this.xpValue = 35;
                this.width = 3; this.height = 3;
                this.mass = 1.2;
                break;
            case 'boss_snake': // Massive mothership snake
                this.hp = 600; this.xpValue = 1000;
                this.width = 5; this.height = 5;
                this.mass = 15.0;
                break;
            case 'boss_eye': // Eye boss (creates blackholes)
                this.hp = 500; this.xpValue = 800;
                this.width = 5; this.height = 5;
                this.mass = 10.0;
                break;
            case 'boss_carrier': // Carrier boss (spawns drones/viruses)
                this.hp = 500; this.xpValue = 800;
                this.width = 6; this.height = 5;
                this.mass = 12.0;
                break;
            case 'blackhole': // Gravitational vacuum hazard
                this.hp = 9999; this.xpValue = 0;
                this.width = 5; this.height = 5;
                this.mass = 999.0;
                this.life = 480; // 8 seconds
                break;
        }
        this.maxHp = this.hp;
    }

    applyKnockback(impactVx, impactVy) {
        this.vx += impactVx / this.mass;
        this.vy += impactVy / this.mass;
    }

    update(playerX, playerY, gridCols, gridRows, spawnedProjectiles, enemyManager) {
        if (this.frozenTimer > 0) {
            this.frozenTimer--;
            // Shift trail history even when frozen
            this.trail.unshift({ x: this.x, y: this.y, vx: 0, vy: 0 });
            const maxTrail = this.type === 'boss_snake' ? 60 : (this.type === 'worm' ? 12 : 8);
            if (this.trail.length > maxTrail) this.trail.pop();
            return;
        }

        this.fireCooldown--;

        // Track trail history for glitch tails/worms/boss
        this.trail.unshift({ x: this.x, y: this.y, vx: this.vx, vy: this.vy });
        const maxTrail = this.type === 'boss_snake' ? 60 : (this.type === 'worm' ? 12 : 8);
        if (this.trail.length > maxTrail) this.trail.pop();

        // Player center (now 3x3, center is playerX + 1.5, playerY + 1.5)
        const dx = playerX + 1.5 - (this.x + this.width / 2);
        const dy = playerY + 1.5 - (this.y + this.height / 2);
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

        this.vx *= this.friction;
        this.vy *= this.friction;

        // Blackhole gravitational pull on this enemy
        if (enemyManager && enemyManager.enemies) {
            for (const other of enemyManager.enemies) {
                if (other.type === 'blackhole' && other !== this) {
                    const bdx = (other.x + 2.5) - (this.x + this.width / 2);
                    const bdy = (other.y + 2.5) - (this.y + this.height / 2);
                    const bdist = Math.sqrt(bdx*bdx + bdy*bdy) || 1;
                    if (bdist < 25) {
                        const pullForce = ((25 - bdist) / 25) * 0.07;
                        this.vx += (bdx / bdist) * pullForce;
                        this.vy += (bdy / bdist) * pullForce;
                    }
                }
            }
        }

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
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2, 
                        Math.cos(a) * 0.2, Math.sin(a) * 0.2
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
                const spreadAngles = [-0.2, 0, 0.2];
                for (let sp of spreadAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(baseAngle + sp) * 0.22, Math.sin(baseAngle + sp) * 0.22
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
                const diagAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
                for (let a of diagAngles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + this.width/2, this.y + this.height/2,
                        Math.cos(a) * 0.19, Math.sin(a) * 0.19
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
        else if (this.type === 'boss_snake') {
            this.waveTime += 0.04;
            const baseAngle = Math.atan2(dy, dx);
            const slitherAngle = baseAngle + Math.sin(this.waveTime) * 0.8;
            moveX = Math.cos(slitherAngle) * 0.04;
            moveY = Math.sin(slitherAngle) * 0.04;

            // Firing logic
            if (this.fireCooldown <= 0) {
                // 1. Radial ring of 16 bullets
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + 2.5, this.y + 2.5,
                        Math.cos(a) * 0.18, Math.sin(a) * 0.18
                    ));
                }
                // 2. Targeted stream of 5 bullets
                const baseA = Math.atan2(dy, dx);
                for (let spread = -0.3; spread <= 0.3; spread += 0.15) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + 2.5, this.y + 2.5,
                        Math.cos(baseA + spread) * 0.25, Math.sin(baseA + spread) * 0.25
                    ));
                }
                this.fireCooldown = 90 + Math.random() * 50; // Every 1.5 - 2.3 seconds
            }

            // Spawn minion drone from tail occasionally
            if (Math.random() < 0.008 && enemyManager.enemies.length < 35) {
                const tailPos = this.trail[this.trail.length - 1] || this;
                enemyManager.spawn(tailPos.x, tailPos.y, 'drone');
            }
        }
        else if (this.type === 'boss_eye') {
            this.waveTime += 0.03;
            if (dist > 24) {
                moveX = (dx / dist) * 0.045;
                moveY = (dy / dist) * 0.045;
            } else if (dist < 14) {
                moveX = -(dx / dist) * 0.03;
                moveY = -(dy / dist) * 0.03;
            }

            if (this.fireCooldown <= 0) {
                // Spawn a blackhole near player (radius 5-12 cells away)
                if (enemyManager && enemyManager.enemies.filter(e => e.type === 'blackhole').length < 3) {
                    const angleBh = Math.random() * Math.PI * 2;
                    const distBh = 6 + Math.random() * 8;
                    const bhX = playerX + Math.cos(angleBh) * distBh;
                    const bhY = playerY + Math.sin(angleBh) * distBh;
                    enemyManager.spawn(bhX, bhY, 'blackhole');
                }

                // Ring sweep
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + 2.5, this.y + 2.5,
                        Math.cos(a) * 0.22, Math.sin(a) * 0.22
                    ));
                }
                this.fireCooldown = 150 + Math.random() * 80;
            }
        }
        else if (this.type === 'boss_carrier') {
            // Slither slowly towards player
            moveX = (dx / dist) * 0.03;
            moveY = (dy / dist) * 0.03;

            if (this.fireCooldown <= 0) {
                // Spawn minions (drones/viruses)
                if (enemyManager && enemyManager.enemies.length < 40) {
                    const spawnType = Math.random() < 0.65 ? 'drone' : 'virus';
                    enemyManager.spawn(this.x - 2, this.y + 2, spawnType);
                    enemyManager.spawn(this.x + 8, this.y + 2, spawnType);
                }

                // Triple target spread
                const baseA = Math.atan2(dy, dx);
                const angles = [baseA - 0.25, baseA, baseA + 0.25];
                for (let a of angles) {
                    spawnedProjectiles.push(new EnemyProjectile(
                        this.x + 3.0, this.y + 2.5,
                        Math.cos(a) * 0.26, Math.sin(a) * 0.26
                    ));
                }
                this.fireCooldown = 130 + Math.random() * 70;
            }
        }
        else if (this.type === 'blackhole') {
            this.life--;
            if (this.life <= 0) {
                this.hp = 0; // mark for deletion
            }
            moveX = 0;
            moveY = 0;
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
        const brightMult = this.frozenTimer > 0 ? 0.35 : 1.0;
        
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
            const scale = 1.4 + Math.sin(Date.now() * 0.02) * 0.2;
            stampOrganicBlob(rendererInstance, this.x + 1.5, this.y + 1.5, scale, VIRUS_CHARS, 0.85 * brightMult);
        }
        else if (this.type === 'boss_snake') {
            // Draw wobbly trailing segments
            for (let i = 0; i < this.trail.length; i++) {
                if (i % 4 === 0) {
                    const pos = this.trail[i];
                    const radius = 2.2 - (i / this.trail.length) * 1.2;
                    stampOrganicBlob(rendererInstance, pos.x + 2.5, pos.y + 2.5, radius, BOSS_SEG_CHARS, 0.7 * (1 - i / this.trail.length) * brightMult);
                }
            }
            // Draw head
            stampOrganicBlob(rendererInstance, this.x + 2.5, this.y + 2.5, 3.6, BOSS_HEAD_CHARS, 1.0 * brightMult, { x: this.vx || 0.1, y: this.vy || 0.1 });
        }
        else if (this.type === 'boss_eye') {
            // Organic eye shape (outer sclera + inner pupil)
            const angleOffset = Date.now() * 0.003;
            stampOrganicBlob(rendererInstance, this.x + 2.5, this.y + 2.5, 3.8, ['O', '0', '#', '▒', '░'], 0.95 * brightMult);
            
            const px_eye = Math.floor(this.x + 2.5 + Math.cos(angleOffset) * 0.8);
            const py_eye = Math.floor(this.y + 2.5 + Math.sin(angleOffset) * 0.8);
            if (px_eye >= 0 && px_eye < rendererInstance.cols && py_eye >= 0 && py_eye < rendererInstance.rows) {
                rendererInstance.types[px_eye][py_eye] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                rendererInstance.chars[px_eye][py_eye] = '◉';
                rendererInstance.brightness[px_eye][py_eye] = 1.0 * brightMult;
            }
        }
        else if (this.type === 'boss_carrier') {
            // Draw large spaceship structure
            const CARRIER_PATTERNS = [
                ['╔', '═', '╦', '╦', '═', '╗'],
                ['║', '█', '░', '░', '█', '║'],
                ['╠', '█', '█', '█', '█', '╣'],
                ['║', '█', '░', '░', '█', '║'],
                ['╚', '═', '╩', '╩', '═', '╝']
            ];
            const ix = Math.floor(this.x);
            const iy = Math.floor(this.y);
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 6; col++) {
                    const char = CARRIER_PATTERNS[row][col];
                    const gx = ix + col;
                    const gy = iy + row;
                    if (gx >= 0 && gx < rendererInstance.cols && gy >= 0 && gy < rendererInstance.rows) {
                        rendererInstance.types[gx][gy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                        rendererInstance.chars[gx][gy] = char;
                        rendererInstance.brightness[gx][gy] = 1.0 * brightMult;
                    }
                }
            }
        }
        else if (this.type === 'blackhole') {
            const angleOffset = (Date.now() * 0.005);
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                const rot = a + angleOffset;
                const sx = Math.floor(this.x + 2.5 + Math.cos(rot) * 2.0);
                const sy = Math.floor(this.y + 2.5 + Math.sin(rot) * 2.0);
                if (sx >= 0 && sx < rendererInstance.cols && sy >= 0 && sy < rendererInstance.rows) {
                    rendererInstance.types[sx][sy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                    rendererInstance.chars[sx][sy] = ['@', '%', '#', '*'][Math.floor(Math.random() * 4)];
                    rendererInstance.brightness[sx][sy] = 0.9;
                }
            }
            const cx = Math.floor(this.x + 2.5);
            const cy = Math.floor(this.y + 2.5);
            if (cx >= 0 && cx < rendererInstance.cols && cy >= 0 && cy < rendererInstance.rows) {
                rendererInstance.types[cx][cy] = RENDER_CELL_TYPES.ENEMY_GLITCH;
                rendererInstance.chars[cx][cy] = ' ';
                rendererInstance.brightness[cx][cy] = 1.0;
            }
        }
    }

    getHitbox() {
        const padding = 2.0; // Padded hitboxes so they are easy to hit!
        
        if (this.type === 'boss_snake') {
            const boxes = [
                { x: this.x - padding, y: this.y - padding, width: this.width + padding * 2, height: this.height + padding * 2 }
            ];
            for (let i = 0; i < this.trail.length; i += 4) { // check every 4th segment
                const pos = this.trail[i];
                const size = Math.max(2, 5 - (i / this.trail.length) * 3);
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
