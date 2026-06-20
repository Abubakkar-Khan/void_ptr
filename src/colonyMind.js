import { BOSS_TYPES, ECOSYSTEM_TYPES } from './config.js';
import { OrganState, PackRole, SpeciesFamily, seededRandom, hashSeed } from './biology.js';

const CELL_SIZE = 14;
const keyFor = (x, y) => `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;

export class ColonyMindSystem {
    constructor(seed = 1) { this.reset(seed); }

    reset(seed = 1) {
        this.seed = seed >>> 0;
        this.tick = 0;
        this.spatial = new Map();
        this.packs = new Map();
        this.fusionReservations = new Set();
        this.nextPackId = 1;
        this.queryCount = 0;
    }

    rebuild(entities) {
        this.spatial.clear();
        for (const enemy of entities) {
            if (!enemy || enemy.hp <= 0 || (enemy.isActive && !enemy.isActive())) continue;
            const key = keyFor(enemy.x, enemy.y);
            if (!this.spatial.has(key)) this.spatial.set(key, []);
            this.spatial.get(key).push(enemy);
        }
    }

    query(x, y, radius = 18) {
        this.queryCount++;
        const result = [];
        const range = Math.ceil(radius / CELL_SIZE);
        const cx = Math.floor(x / CELL_SIZE), cy = Math.floor(y / CELL_SIZE);
        for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
            for (const enemy of this.spatial.get(`${cx + dx},${cy + dy}`) || []) {
                if (Math.hypot(enemy.x - x, enemy.y - y) <= radius) result.push(enemy);
            }
        }
        return result;
    }

    socialOrganWorks(enemy) {
        const organ = enemy.organs?.find(entry => entry.effect === 'coordination');
        return !organ || (organ.state !== OrganState.RUPTURED && organ.state !== OrganState.SEVERED);
    }

    update(manager, player) {
        this.tick++;
        if (this.tick % 12 !== 0) return;
        this.queryCount = 0;
        this.rebuild(manager.enemies);
        for (let index = this.tick / 12 % 3; index < manager.enemies.length; index += 3) this.think(manager.enemies[index], manager, player);
        if (this.tick % 120 === 0) this.attemptFusion(manager);
    }

    think(enemy, manager, player) {
        if (!enemy || enemy.hp <= 0 || (enemy.isActive && !enemy.isActive()) || BOSS_TYPES.has(enemy.type) || !this.socialOrganWorks(enemy)) return;
        const neighbours = this.query(enemy.x, enemy.y, enemy.coordinationRadius || 18).filter(other => other !== enemy && !BOSS_TYPES.has(other.type));
        const allies = neighbours.filter(other => other.genome?.family === enemy.genome?.family || this.compatible(enemy, other));
        if (allies.length) this.assignPack(enemy, allies);
        const wounded = enemy.hp / enemy.maxHp < 0.35 || enemy.organs?.some(entry => entry.state === OrganState.RUPTURED);
        if (wounded) {
            enemy.packRole = PackRole.RETREAT;
            enemy.signal = '?';
            enemy.signalTimer = 45;
            enemy.socialTarget = allies.find(other => [SpeciesFamily.ROOTWEAVER, SpeciesFamily.CARAPACE].includes(other.genome?.family)) || null;
        } else if (enemy.genome?.family === SpeciesFamily.SKITTER && allies.length >= 2) {
            enemy.packRole = PackRole.FLANKER;
            enemy.signal = '>';
            enemy.signalTimer = 35;
            const side = (enemy.genome.seed % 2 ? 1 : -1);
            enemy.intentOffset = { x: -side * (player.y - enemy.y) * 0.35, y: side * (player.x - enemy.x) * 0.35 };
        } else if (enemy.genome?.family === SpeciesFamily.BLOOMCASTER) {
            enemy.socialTarget = allies.find(other => other.genome?.family === SpeciesFamily.CARAPACE) || null;
            enemy.signal = '*'; enemy.signalTimer = 24;
        } else if (enemy.genome?.family === SpeciesFamily.RIBBON) {
            enemy.intentOffset = { x: (enemy.genome.bias || 1) * 8, y: -(enemy.genome.bias || 1) * 8 };
            enemy.signal = '~'; enemy.signalTimer = 24;
        } else if (enemy.genome?.family === SpeciesFamily.ROOTWEAVER) {
            enemy.signal = '='; enemy.signalTimer = 30;
            enemy.linkedTargets = allies.filter(other => other !== enemy).slice(0, 3);
        }
    }

    compatible(a, b) {
        const pair = new Set([a.genome?.family, b.genome?.family]);
        return (pair.has(SpeciesFamily.SKITTER) && pair.has(SpeciesFamily.BLOOMCASTER))
            || (pair.has(SpeciesFamily.BLOOMCASTER) && pair.has(SpeciesFamily.CARAPACE))
            || (pair.has(SpeciesFamily.CARAPACE) && pair.has(SpeciesFamily.ROOTWEAVER))
            || (pair.has(SpeciesFamily.PARASITE) && !ECOSYSTEM_TYPES.has(b.type));
    }

    assignPack(enemy, allies) {
        let pack = enemy.packId && this.packs.get(enemy.packId);
        if (!pack) {
            const existing = allies.find(other => other.packId && this.packs.has(other.packId));
            pack = existing ? this.packs.get(existing.packId) : { id: this.nextPackId++, members: new Set(), signal: 'idle' };
            this.packs.set(pack.id, pack);
        }
        pack.members.add(enemy);
        enemy.packId = pack.id;
        for (const ally of allies.slice(0, 5)) { pack.members.add(ally); ally.packId = pack.id; }
    }

    attemptFusion(manager) {
        for (const pack of this.packs.values()) {
            const candidates = [...pack.members].filter(enemy => manager.enemies.includes(enemy) && enemy.hp > 0 && !this.fusionReservations.has(enemy));
            const wounded = candidates.filter(enemy => enemy.hp / enemy.maxHp < 0.3);
            if (wounded.length < 2) continue;
            const [a, b] = wounded;
            if (Math.hypot(a.x - b.x, a.y - b.y) > 5 || (a.energy || 0) + (b.energy || 0) < 3) continue;
            this.fusionReservations.add(a); this.fusionReservations.add(b);
            const fused = manager.fuse?.([a, b]);
            this.fusionReservations.delete(a); this.fusionReservations.delete(b);
            if (fused) { fused.signal = '@'; fused.signalTimer = 90; }
            break;
        }
    }
}

export const colonyMind = new ColonyMindSystem();
