import { enemies } from './enemies.js';
import { effects } from './effects.js';
import { BOSS_SCHEDULE_TICKS, BOSS_TYPES, ENEMY_DEFS, NORMAL_ENEMY_TYPES } from './config.js';

const BOSS_ORDER = ['boss_snake', 'boss_eye', 'boss_carrier'];

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

    update(rendererInstance) {
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
            this.spawnEncounter(rendererInstance);
            const pressure = Math.min(60, this.elapsedSeconds / 8);
            this.spawnTimer = Math.max(20, 88 - pressure);
        }
    }

    getAvailableTypes() {
        const seconds = this.elapsedSeconds;
        const available = ['drone'];
        if (seconds >= 35) available.push('shooter');
        if (seconds >= 75) available.push('worm', 'kamikaze');
        if (seconds >= 130) available.push('virus');
        if (seconds >= 190) available.push('brute');
        if (seconds >= 240) available.push('shield_projector');
        return available;
    }

    spawnEncounter(rendererInstance) {
        const normalCount = enemies.enemies.filter(e => e && NORMAL_ENEMY_TYPES.has(e.type)).length;
        if (normalCount >= 60) return;

        const available = this.getAvailableTypes();
        const tier = this.threatTier;
        const recipes = [
            { name: 'SWARM', types: ['drone'], bonus: 3 },
            { name: 'CROSSFIRE', types: ['shooter', 'drone'], bonus: 1 },
            { name: 'REPLICATION', types: ['virus', 'drone'], bonus: 1 },
            { name: 'ESCORT', types: ['brute', 'shield_projector', 'drone'], bonus: 0 },
            { name: 'PANIC', types: ['kamikaze', 'drone'], bonus: 2 }
        ].filter(recipe => recipe.types.every(type => available.includes(type)));

        const recipe = recipes.length && Math.random() < 0.55
            ? recipes[Math.floor(Math.random() * recipes.length)]
            : { name: 'WILD PROCESSES', types: available, bonus: 0 };
        this.encounterName = recipe.name;

        let budget = Math.min(26, 5 + tier * 2 + recipe.bonus);
        let safety = 0;
        while (budget >= 1 && safety++ < 24 && enemies.enemies.length < 63) {
            const affordable = recipe.types.filter(type => (ENEMY_DEFS[type]?.cost || 1) <= budget);
            if (!affordable.length) break;
            const type = affordable[Math.floor(Math.random() * affordable.length)];
            const pos = this.getEdgeSpawn(rendererInstance, 6);
            enemies.spawn(pos.x + (Math.random() - 0.5) * 5, pos.y + (Math.random() - 0.5) * 5, type);
            budget -= ENEMY_DEFS[type]?.cost || 1;
        }
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
        const boss = enemies.spawn(pos.x, pos.y, type);
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
