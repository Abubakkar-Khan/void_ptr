import { RENDER_CELL_TYPES } from './renderer.js';
import { PALETTE, PROGRESSION_CONFIG } from './config.js';
import { stats } from './stats.js';

export class MemoryPickup {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.life = Infinity;
        this.phase = Math.random() * Math.PI * 2;
        this.age = 0;
        this.baseValue = value;
    }

    update(player, enemyList = []) {
        this.age++;
        this.phase += 0.08;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const magnetRadius = PROGRESSION_CONFIG.pickupMagnetRadius + (player.upgrades.garbageCollector || 0) * PROGRESSION_CONFIG.pickupRadiusPerUpgrade;
        if (dist < magnetRadius) {
            const pull = 0.22 + (1 - dist / magnetRadius) * 0.72;
            this.x += (dx / dist) * pull;
            this.y += (dy / dist) * pull;
        }
        if (player.upgrades.memoryLeak) {
            if (this.age % 300 === 0) this.value = Math.min(this.baseValue * (1 + player.upgrades.memoryLeak * 0.5), Math.ceil(this.value * 1.12));
            for (const enemy of enemyList) {
                if (!enemy) continue;
                const edx = this.x - (enemy.x + enemy.width / 2);
                const edy = this.y - (enemy.y + enemy.height / 2);
                const edist = Math.hypot(edx, edy) || 1;
                if (edist < 14) {
                    enemy.vx += (edx / edist) * 0.008 * player.upgrades.memoryLeak;
                    enemy.vy += (edy / edist) * 0.008 * player.upgrades.memoryLeak;
                }
            }
        }
        const collectedDistance = Math.hypot(px - this.x, py - this.y);
        return collectedDistance < 2.6;
    }

    stamp(renderer) {
        const x = Math.floor(this.x);
        const y = Math.floor(this.y);
        if (x < 0 || x >= renderer.cols || y < 0 || y >= renderer.rows) return;
        renderer.types[x][y] = RENDER_CELL_TYPES.GLITCH;
        renderer.chars[x][y] = this.value >= 100 ? '◆' : (this.value >= 30 ? '◇' : '·');
        renderer.brightness[x][y] = 0.75 + Math.sin(this.phase) * 0.2;
        renderer.customColors[x][y] = PALETTE.pickup;
    }
}

export class PickupSystem {
    constructor() {
        this.items = [];
    }

    reset() {
        this.items = [];
    }

    spawnMemory(x, y, totalValue) {
        if (totalValue <= 0) return;
        const chunks = Math.min(5, Math.max(1, Math.ceil(totalValue / 40)));
        const base = Math.floor(totalValue / chunks);
        let remainder = totalValue - base * chunks;
        for (let i = 0; i < chunks; i++) {
            const angle = (i / chunks) * Math.PI * 2 + Math.random() * 0.4;
            const radius = chunks === 1 ? 0 : 0.8 + Math.random() * 1.6;
            const value = base + (remainder-- > 0 ? 1 : 0);
            this.items.push(new MemoryPickup(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, value));
        }
    }

    update(player, enemyList = []) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.update(player, enemyList)) {
                player.gainXp(item.value);
                stats.recordXp(item.value);
                this.items.splice(i, 1);
            }
        }
    }

    vacuumAll(player) {
        for (const item of this.items) {
            item.x = player.x + player.width / 2;
            item.y = player.y + player.height / 2;
        }
    }

    stampToGrid(renderer) {
        for (const item of this.items) item.stamp(renderer);
    }
}

export const pickups = new PickupSystem();
