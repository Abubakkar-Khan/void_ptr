import { renderer } from './renderer.js';

const GLITCH_CHARS = '. : * + # @'.split(' ');

class Particle {
    constructor(px, py, vx, vy, options = {}) {
        this.px = px; 
        this.py = py;
        this.vx = vx;
        this.vy = vy;
        
        this.char = options.char || GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        this.color = options.color || '#00ff41';
        this.life = options.life || 30; 
        this.maxLife = this.life;
        this.glow = options.glow || false;
        this.size = options.size || 14;
        this.friction = options.friction || 0.93;
    }

    update() {
        this.px += this.vx;
        this.py += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.life--;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.font = `bold ${this.size}px 'VT323', monospace`;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        
        if (this.glow) {
            ctx.shadowColor = this.color === '#ff3366' ? 'rgba(255, 51, 102, 0.8)' : 'rgba(0, 255, 65, 0.8)';
            ctx.shadowBlur = 6;
        }
        
        ctx.fillText(this.char, this.px, this.py);
        ctx.restore();
    }
}

class EffectSystem {
    constructor() {
        this.particles = [];
        this.damageTexts = [];
        this.scanlineFlash = 0; 
        this.lightningArcs = [];
    }

    reset() {
        this.particles = [];
        this.damageTexts = [];
        this.scanlineFlash = 0;
        this.lightningArcs = [];
    }

    spawnGlitchExplosion(gridX, gridY, color = '#00ff41', count = 15) {
        const screenX = (gridX - renderer.camX) * renderer.cellWidth;
        const screenY = (gridY - renderer.camY) * renderer.cellHeight;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 4.0;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            const char = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            
            this.particles.push(new Particle(screenX, screenY, vx, vy, {
                char: char,
                color: color,
                life: 30 + Math.floor(Math.random() * 30),
                glow: Math.random() < 0.5,
                size: 8 + Math.floor(Math.random() * 10)
            }));
        }
    }

    spawnShatter(gridX, gridY, char, color = '#00ff41') {
        const screenX = (gridX - renderer.camX) * renderer.cellWidth;
        const screenY = (gridY - renderer.camY) * renderer.cellHeight;
        
        for (let i = 0; i < 4; i++) {
            const vx = (Math.random() - 0.5) * 4;
            const vy = (Math.random() - 0.5) * 4 - 2; 
            
            this.particles.push(new Particle(screenX, screenY, vx, vy, {
                char: char,
                color: color,
                life: 15 + Math.random() * 15,
                size: 10 + Math.random() * 6
            }));
        }
    }

    spawnImpactSparks(gridX, gridY, color = '#00ff41') {
        const screenX = (gridX - renderer.camX) * renderer.cellWidth;
        const screenY = (gridY - renderer.camY) * renderer.cellHeight;
        
        for (let i = 0; i < 2; i++) {
            const vx = (Math.random() - 0.5) * 1.5;
            const vy = (Math.random() - 0.5) * 1.5; 
            
            this.particles.push(new Particle(screenX, screenY, vx, vy, {
                char: '.',
                color: color,
                life: 6 + Math.random() * 8,
                size: 8,
                glow: false
            }));
        }
    }

    spawnLightningArc(gx1, gy1, gx2, gy2) {
        const x1 = (gx1 - renderer.camX) * renderer.cellWidth;
        const y1 = (gy1 - renderer.camY) * renderer.cellHeight;
        const x2 = (gx2 - renderer.camX) * renderer.cellWidth;
        const y2 = (gy2 - renderer.camY) * renderer.cellHeight;
        this.lightningArcs.push({ x1, y1, x2, y2, life: 12 });
    }

    spawnDamageText(gridX, gridY, text, color = '#00ff41') {
        const screenX = (gridX - renderer.camX) * renderer.cellWidth;
        const screenY = (gridY - renderer.camY) * renderer.cellHeight;
        this.damageTexts.push(new DamageText(screenX, screenY, text, color));
    }

    triggerFlash(duration = 10) {
        this.scanlineFlash = 0.3; 
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.damageTexts.length - 1; i >= 0; i--) {
            const dt = this.damageTexts[i];
            dt.update();
            if (dt.life <= 0) {
                this.damageTexts.splice(i, 1);
            }
        }

        for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
            this.lightningArcs[i].life--;
            if (this.lightningArcs[i].life <= 0) {
                this.lightningArcs.splice(i, 1);
            }
        }

        if (this.scanlineFlash > 0) {
            this.scanlineFlash -= 0.02;
            if (this.scanlineFlash < 0) this.scanlineFlash = 0;
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }

        for (const dt of this.damageTexts) {
            dt.draw(ctx);
        }

        // Draw Tesla lightning discharges
        for (const arc of this.lightningArcs) {
            ctx.save();
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = 'rgba(0, 255, 65, 0.95)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(arc.x1, arc.y1);

            const dx = arc.x2 - arc.x1;
            const dy = arc.y2 - arc.y1;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const steps = Math.floor(dist / 8) || 1;
            let cx = arc.x1;
            let cy = arc.y1;
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const targetX = arc.x1 + dx * t;
                const targetY = arc.y1 + dy * t;
                const px = -dy / dist;
                const py = dx / dist;
                const offset = (Math.random() - 0.5) * 12;
                cx = targetX + px * offset;
                cy = targetY + py * offset;
                ctx.lineTo(cx, cy);
            }
            ctx.lineTo(arc.x2, arc.y2);
            ctx.stroke();
            ctx.restore();
        }

        if (this.scanlineFlash > 0 && ctx.canvas) {
            ctx.save();
            ctx.fillStyle = `rgba(0, 255, 65, ${this.scanlineFlash})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    }
}

export const effects = new EffectSystem();
