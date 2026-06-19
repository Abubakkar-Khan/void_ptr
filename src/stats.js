const STORAGE_KEY = 'voidptr_stats_v1';

const emptyLifetime = () => ({
    version: 1,
    runs: 0,
    wins: 0,
    totalKills: 0,
    totalDamage: 0,
    totalDamageTaken: 0,
    totalPlaytime: 0,
    bossesDefeated: 0,
    highestScore: 0,
    highestLevel: 1,
    longestSurvival: 0,
    largestCombo: 0,
    perHullBest: { runner: 0, daemon: 0, cutter: 0 }
});

const emptyRun = () => ({
    kills: 0,
    killsByType: {},
    genomeKills: {},
    bossKills: 0,
    damageDealt: 0,
    damageTaken: 0,
    xpCollected: 0,
    levelsGained: 0,
    upgradesSelected: [],
    shotsFired: 0,
    hitEvents: 0,
    dashes: 0,
    distanceTravelled: 0,
    maxCombo: 0,
    coloniesDestroyed: 0,
    parasitesRemoved: 0,
    amalgamsKilled: 0,
    score: 0,
    survivalSeconds: 0,
    hull: 'runner',
    victory: false,
    finalized: false
});

export class StatsTracker {
    constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
        this.storage = storage;
        this.lifetime = this.loadLifetime();
        this.run = emptyRun();
    }

    loadLifetime() {
        if (!this.storage) return emptyLifetime();
        try {
            const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) || 'null');
            if (!parsed || parsed.version !== 1) return emptyLifetime();
            const base = emptyLifetime();
            return { ...base, ...parsed, perHullBest: { ...base.perHullBest, ...(parsed.perHullBest || {}) } };
        } catch {
            return emptyLifetime();
        }
    }

    reset(hull = 'runner') {
        this.run = emptyRun();
        this.run.hull = hull;
    }

    recordShot(count = 1) { this.run.shotsFired += count; }
    recordHit(amount = 0) {
        this.run.hitEvents++;
        this.run.damageDealt += Math.max(0, amount);
    }
    recordDamageTaken(amount = 0) { this.run.damageTaken += Math.max(0, amount); }
    recordXp(amount = 0) { this.run.xpCollected += Math.max(0, amount); }
    recordLevel() { this.run.levelsGained++; }
    recordUpgrade(id) { if (id) this.run.upgradesSelected.push(id); }
    recordDash() { this.run.dashes++; }
    recordDistance(amount = 0) { this.run.distanceTravelled += Math.max(0, amount); }
    recordCombo(combo = 0) { this.run.maxCombo = Math.max(this.run.maxCombo, combo); }

    recordKill(type, isBoss = false, genomeSignature = null) {
        this.run.kills++;
        this.run.killsByType[type] = (this.run.killsByType[type] || 0) + 1;
        if (genomeSignature) this.run.genomeKills[genomeSignature] = (this.run.genomeKills[genomeSignature] || 0) + 1;
        if (isBoss) this.run.bossKills++;
        if (type === 'cell_colony') this.run.coloniesDestroyed++;
        if (type === 'cell_parasite') this.run.parasitesRemoved++;
        if (type === 'cell_amalgam') this.run.amalgamsKilled++;
    }

    snapshot() {
        return {
            ...this.run,
            killsByType: { ...this.run.killsByType },
            genomeKills: { ...this.run.genomeKills },
            upgradesSelected: [...this.run.upgradesSelected],
            distanceTravelled: Math.round(this.run.distanceTravelled * 10) / 10,
            damageDealt: Math.round(this.run.damageDealt),
            damageTaken: Math.round(this.run.damageTaken)
        };
    }

    finalize({ victory, score, level, survivalSeconds }) {
        if (this.run.finalized) return this.snapshot();
        Object.assign(this.run, { victory, score, survivalSeconds, finalized: true });
        const life = this.lifetime;
        life.runs++;
        if (victory) life.wins++;
        life.totalKills += this.run.kills;
        life.totalDamage += Math.round(this.run.damageDealt);
        life.totalDamageTaken += Math.round(this.run.damageTaken);
        life.totalPlaytime += Math.round(survivalSeconds);
        life.bossesDefeated += this.run.bossKills;
        life.highestScore = Math.max(life.highestScore, score);
        life.highestLevel = Math.max(life.highestLevel, level);
        life.longestSurvival = Math.max(life.longestSurvival, survivalSeconds);
        life.largestCombo = Math.max(life.largestCombo, this.run.maxCombo);
        life.perHullBest[this.run.hull] = Math.max(life.perHullBest[this.run.hull] || 0, score);
        if (this.storage) {
            try { this.storage.setItem(STORAGE_KEY, JSON.stringify(life)); } catch { /* storage is optional */ }
        }
        return this.snapshot();
    }
}

export const stats = new StatsTracker();
