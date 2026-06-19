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
        ctx.font = `500 ${renderer.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        
        if (this.glow && !renderer.lowPowerMode) {
            ctx.shadowColor = this.color === '#ff3366' ? 'rgba(255, 51, 102, 0.8)' : 'rgba(0, 255, 65, 0.8)';
            ctx.shadowBlur = 6;
        }
        
        ctx.fillText(this.char, Math.round(this.px / renderer.cellWidth) * renderer.cellWidth, Math.round(this.py / renderer.cellHeight) * renderer.cellHeight);
        ctx.restore();
    }
}

class DamageText {
    constructor(px, py, text, color) {
        this.px = px;
        this.py = py;
        this.text = text;
        this.color = color;
        this.life = 38;
        this.maxLife = 38;
    }

    update() {
        this.py -= 0.35;
        this.life--;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = `500 ${renderer.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, Math.round(this.px / renderer.cellWidth) * renderer.cellWidth, Math.round(this.py / renderer.cellHeight) * renderer.cellHeight);
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

        const actualCount = renderer.lowPowerMode ? Math.ceil(count * 0.28) : renderer.reducedMotion ? Math.ceil(count * 0.35) : count;
        for (let i = 0; i < actualCount; i++) {
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
        // Damage is communicated by wounds, recoil, sound, and the HP bar.
        // Floating numbers are intentionally disabled to preserve ASCII readability.
    }

    triggerFlash(duration = 10) {
        this.scanlineFlash = Math.min(0.5, 0.16 + duration * 0.012);
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

        // Tesla discharges are sampled into terminal glyphs, never vector lines.
        for (const arc of this.lightningArcs) {
            ctx.save();
            ctx.fillStyle = '#00ff41';
            ctx.font = `500 ${renderer.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
            ctx.shadowColor = renderer.lowPowerMode ? 'transparent' : 'rgba(0, 255, 65, 0.95)';
            ctx.shadowBlur = renderer.lowPowerMode ? 0 : 4;
            const dx = arc.x2 - arc.x1;
            const dy = arc.y2 - arc.y1;
            const dist = Math.hypot(dx, dy) || 1;
            const steps = Math.max(1, Math.floor(dist / Math.min(renderer.cellWidth, renderer.cellHeight)));
            const glyph = Math.abs(dx) > Math.abs(dy) * 1.8 ? '-' : Math.abs(dy) > Math.abs(dx) * 1.2 ? '|' : dx * dy > 0 ? '\\' : '/';
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const jitter = i > 0 && i < steps ? ((i + arc.life) % 3 - 1) : 0;
                const x = Math.round((arc.x1 + dx * t - dy / dist * jitter * renderer.cellWidth) / renderer.cellWidth) * renderer.cellWidth;
                const y = Math.round((arc.y1 + dy * t + dx / dist * jitter * renderer.cellHeight) / renderer.cellHeight) * renderer.cellHeight;
                ctx.fillText(i === 0 || i === steps ? '*' : glyph, x, y);
            }
            ctx.restore();
        }

        if (this.scanlineFlash > 0 && ctx.canvas) {
            ctx.save();
            ctx.fillStyle = `rgba(0, 255, 65, ${this.scanlineFlash})`;
            ctx.font = `500 ${renderer.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
            for (let y = 0; y < renderer.height; y += renderer.cellHeight * 3) {
                const offset = ((y / renderer.cellHeight + renderer.animationTime) % 5) * renderer.cellWidth;
                for (let x = offset; x < renderer.width; x += renderer.cellWidth * 5) ctx.fillText(':', x, y);
            }
            ctx.restore();
        }
    }
}

export const effects = new EffectSystem();
