import { enemies, EnemySpawnRequest } from './enemies.js';
import { effects } from './effects.js';
import { BOSS_SCHEDULE_TICKS, BOSS_TYPES, COMBAT_CONFIG, ENEMY_DEFS, NORMAL_ENEMY_TYPES } from './config.js';

const BOSS_ORDER = ['boss_snake', 'boss_eye', 'boss_carrier'];

export class EncounterReservation {
    constructor(id, name, requests, pressureTicks, recoveryTicks) {
        this.id = id;
        this.name = name;
        this.requests = requests;
        this.pressureTicks = pressureTicks;
        this.recoveryTicks = recoveryTicks;
    }
}

export class Director {
    constructor() {
        this.reset(10);
    }

    reset(minutes = 10) {
        this.timeElapsed = 0;
        this.endless = minutes >= 999;
        this.modeTimeLimit = this.endless ? Infinity : minutes * 60 * 60;
        this.inProgress = false;
        this.spawnTimer = 90;
        this.recoveryTimer = 0;
        this.nextBossAt = this.endless ? 150 * 60 : BOSS_SCHEDULE_TICKS[0];
        this.bossIndex = 0;
        this.bossWasAlive = false;
        this.encounterName = 'BOOTSTRAP';
        this.encounterCounter = 0;
    }

    startGame() {
        this.inProgress = true;
    }

    get elapsedSeconds() {
        return this.timeElapsed / 60;
    }

    get threatTier() {
        return 1 + Math.floor(this.elapsedSeconds / 60);
    }

    update(rendererInstance, player = null) {
        if (!this.inProgress) return;
        this.timeElapsed++;

        const bossAlive = enemies.enemies.some(e => e && BOSS_TYPES.has(e.type) && e.hp > 0);
        if (this.bossWasAlive && !bossAlive) this.recoveryTimer = 8 * 60;
        this.bossWasAlive = bossAlive;

        if (this.recoveryTimer > 0) {
            this.recoveryTimer--;
            this.encounterName = 'MEMORY RECOVERY';
            return;
        }

        if (!bossAlive && this.timeElapsed >= this.nextBossAt) {
            this.spawnBoss(rendererInstance, BOSS_ORDER[this.bossIndex % BOSS_ORDER.length]);
            this.bossIndex++;
            this.nextBossAt = this.endless
                ? this.nextBossAt + 180 * 60
                : (BOSS_SCHEDULE_TICKS[this.bossIndex] ?? Infinity);
            this.bossWasAlive = true;
            return;
        }

        this.spawnTimer--;
        if (bossAlive && this.threatTier < 5) return;
        if (this.spawnTimer <= 0) {
            const reservation = this.spawnEncounter(rendererInstance, player);
            this.spawnTimer = reservation ? reservation.pressureTicks + reservation.recoveryTicks : 120;
        }
    }

    getAvailableTypes() {
        const seconds = this.elapsedSeconds;
        const available = ['drone'];
        if (seconds >= 25) available.push('shooter');
        if (seconds >= 75) available.push('worm', 'kamikaze');
        if (seconds >= 130) available.push('virus');
        if (seconds >= 150) available.push('cell_parasite');
        if (seconds >= 190) available.push('brute');
        if (seconds >= 240) available.push('shield_projector');
        if (seconds >= 300) available.push('cell_amalgam', 'cell_spore');
        return available;
    }

    spawnEncounter(rendererInstance, player = null) {
        const normalCount = enemies.enemies.filter(e => e && NORMAL_ENEMY_TYPES.has(e.type)).length;
        const remainingSlots = Math.max(0, COMBAT_CONFIG.normalPopulationCap - normalCount);
        if (remainingSlots < 2) return null;

        const available = this.getAvailableTypes();
        const tier = this.threatTier;
        const recipes = [
            { name: 'HUNTING RING', types: ['drone'], bonus: 5, formation: 'arc', recovery: 120 },
            { name: 'MOVING NEST', types: ['brute', 'shooter'], bonus: 2, formation: 'cluster', recovery: 210 },
            { name: 'HERDING CURRENT', types: ['worm', 'drone'], bonus: 3, formation: 'line', recovery: 150 },
            { name: 'DIVISION FIELD', types: ['virus'], bonus: 2, formation: 'mirror', recovery: 180 },
            { name: 'PARASITE MIGRATION', types: ['cell_parasite', 'drone'], bonus: 3, formation: 'line', recovery: 150 },
            { name: 'ROOT TERRITORY', types: ['brute', 'shield_projector'], bonus: 2, formation: 'cluster', recovery: 210 },
            { name: 'PREDATOR FEED', types: ['cell_amalgam', 'cell_spore'], bonus: 2, formation: 'cluster', recovery: 240 },
            { name: 'PANIC BLOOM', types: ['kamikaze', 'drone'], bonus: 4, formation: 'arc', recovery: 150 }
        ].filter(recipe => recipe.types.every(type => available.includes(type)));

        const recipe = recipes.length && Math.random() < 0.55
            ? recipes[Math.floor(Math.random() * recipes.length)]
            : { name: 'WILD PROCESSES', types: available.slice(-2), bonus: 2, formation: 'line', recovery: 135 };
        this.encounterName = recipe.name;
        const anchor = this.getEdgeSpawn(rendererInstance, COMBAT_CONFIG.spawnCameraMargin + 2);
        const encounterId = `encounter-${++this.encounterCounter}`;

        let budget = Math.min(34, 8 + tier * 2.5 + recipe.bonus);
        let safety = 0;
        const requests = [];
        while (budget >= 1 && safety++ < 24 && requests.length < remainingSlots) {
            const affordable = recipe.types.filter(type => (ENEMY_DEFS[type]?.cost || 1) <= budget);
            if (!affordable.length) break;
            const type = affordable[Math.floor(Math.random() * affordable.length)];
            const pos = this.getFormationPosition(rendererInstance, anchor, recipe.formation, safety);
            const safePos = this.ensureSafeSpawn({
                x: pos.x + (Math.random() - 0.5) * 1.5,
                y: pos.y + (Math.random() - 0.5) * 1.5
            }, rendererInstance, player);
            requests.push(new EnemySpawnRequest(
                safePos.x,
                safePos.y,
                type,
                { source: 'encounter', encounterId, emergenceTicks: 60 }
            ));
            budget -= ENEMY_DEFS[type]?.cost || 1;
        }
        if (requests.length < 2 || enemies.reserveEncounter(requests).length !== requests.length) return null;
        const pressureTicks = Math.round(Math.max(8, Math.min(15, 8 + tier * 0.7)) * 60);
        return new EncounterReservation(encounterId, recipe.name, requests, pressureTicks, recipe.recovery);
    }

    getFormationPosition(rendererInstance, anchor, formation, index) {
        const centerX = rendererInstance.camX + rendererInstance.viewCols / 2;
        const centerY = rendererInstance.camY + rendererInstance.viewRows / 2;
        const toward = Math.atan2(centerY - anchor.y, centerX - anchor.x);
        const tangentX = -Math.sin(toward), tangentY = Math.cos(toward);
        if (formation === 'ring' || formation === 'arc') {
            const spread = (index % 9 - 4) * 3;
            const depth = Math.floor(index / 9) * 2;
            return { x: anchor.x + tangentX * spread - Math.cos(toward) * depth, y: anchor.y + tangentY * spread - Math.sin(toward) * depth };
        }
        if (formation === 'cluster') return { x: anchor.x + (index % 3 - 1) * 4, y: anchor.y + (Math.floor(index / 3) % 3 - 1) * 3 };
        if (formation === 'mirror') {
            const side = index % 2 ? 1 : -1;
            return { x: anchor.x + tangentX * side * (3 + index), y: anchor.y + tangentY * side * (3 + index) };
        }
        return { x: anchor.x + tangentX * (index - 4) * 2.5, y: anchor.y + tangentY * (index - 4) * 2.5 };
    }

    ensureSafeSpawn(position, rendererInstance, player) {
        let x = position.x;
        let y = position.y;
        if (player) {
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const dx = x - px;
            const dy = y - py;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < COMBAT_CONFIG.spawnSafeRadius) {
                x = px + dx / distance * COMBAT_CONFIG.spawnSafeRadius;
                y = py + dy / distance * COMBAT_CONFIG.spawnSafeRadius;
            }
        }
        const left = rendererInstance.camX - COMBAT_CONFIG.spawnCameraMargin;
        const right = rendererInstance.camX + rendererInstance.viewCols + COMBAT_CONFIG.spawnCameraMargin;
        const top = rendererInstance.camY - COMBAT_CONFIG.spawnCameraMargin;
        const bottom = rendererInstance.camY + rendererInstance.viewRows + COMBAT_CONFIG.spawnCameraMargin;
        const insideX = x > left && x < right;
        const insideY = y > top && y < bottom;
        if (insideX && insideY) {
            const distances = [Math.abs(x - left), Math.abs(right - x), Math.abs(y - top), Math.abs(bottom - y)];
            const nearest = distances.indexOf(Math.min(...distances));
            if (nearest === 0) x = left;
            else if (nearest === 1) x = right;
            else if (nearest === 2) y = top;
            else y = bottom;
        }
        return { x, y };
    }

    getEdgeSpawn(rendererInstance, padding = 6) {
        const edge = Math.floor(Math.random() * 4);
        const minX = Math.max(1, Math.floor(rendererInstance.camX));
        const maxX = Math.min(rendererInstance.cols - 2, Math.ceil(rendererInstance.camX + rendererInstance.viewCols));
        const minY = Math.max(1, Math.floor(rendererInstance.camY));
        const maxY = Math.min(rendererInstance.rows - 2, Math.ceil(rendererInstance.camY + rendererInstance.viewRows));
        let x;
        let y;
        if (edge === 0) { x = minX + Math.random() * Math.max(1, maxX - minX); y = minY - padding; }
        else if (edge === 1) { x = minX + Math.random() * Math.max(1, maxX - minX); y = maxY + padding; }
        else if (edge === 2) { x = minX - padding; y = minY + Math.random() * Math.max(1, maxY - minY); }
        else { x = maxX + padding; y = minY + Math.random() * Math.max(1, maxY - minY); }
        return {
            x: Math.max(-20, Math.min(rendererInstance.cols + 20, x)),
            y: Math.max(-20, Math.min(rendererInstance.rows + 20, y))
        };
    }

    spawnBoss(rendererInstance, type = 'boss_snake') {
        const pos = this.getEdgeSpawn(rendererInstance, 10);
        const boss = enemies.spawn(pos.x, pos.y, type, { source: 'boss', emergenceTicks: 90 });
        if (boss) {
            const hpScale = 1 + Math.max(0, this.threatTier - 1) * 0.12;
            boss.hp = Math.round(boss.hp * hpScale);
            boss.maxHp = boss.hp;
        }
        const names = { boss_snake: 'NULL SERPENT', boss_eye: 'THE WATCHER', boss_carrier: 'HEAP CARRIER' };
        this.encounterName = `FATAL: ${names[type] || type.toUpperCase()}`;
        effects.triggerFlash(18);
    }

    getTimeRemainingFormatted() {
        if (this.endless) {
            const total = Math.floor(this.timeElapsed / 60);
            return `∞ ${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
        }
        const remainingTicks = Math.max(0, this.modeTimeLimit - this.timeElapsed);
        const seconds = Math.floor((remainingTicks / 60) % 60);
        const minutes = Math.floor(remainingTicks / 3600);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getThreatLabel() {
        return `THREAT ${this.threatTier} // ${this.encounterName}`;
    }

    isVictory() {
        const finalBossAlive = enemies.enemies.some(e => e && e.type === BOSS_ORDER[BOSS_ORDER.length - 1] && e.hp > 0);
        return !this.endless && this.inProgress && this.timeElapsed >= this.modeTimeLimit && this.bossIndex >= BOSS_ORDER.length && !finalBossAlive;
    }
}

export const waves = new Director();
