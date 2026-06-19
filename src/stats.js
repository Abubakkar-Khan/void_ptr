// Lightweight per-run summary only. Lifetime records, detailed telemetry, and
// persistent statistics were deliberately removed from the game.
const emptyRun = () => ({
    kills: 0,
    bossKills: 0,
    levelsGained: 0,
    score: 0,
    survivalSeconds: 0,
    victory: false,
    finalized: false
});

export class StatsTracker {
    constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
        try { storage?.removeItem?.('voidptr_stats_v1'); } catch { /* optional cleanup */ }
        this.run = emptyRun();
    }

    reset() { this.run = emptyRun(); }
    recordKill(_type, isBoss = false) { this.run.kills++; if (isBoss) this.run.bossKills++; }
    recordLevel() { this.run.levelsGained++; }

    // Compatibility no-ops keep combat modules decoupled from presentation.
    recordShot() {}
    recordHit() {}
    recordDamageTaken() {}
    recordXp() {}
    recordUpgrade() {}
    recordDash() {}
    recordDistance() {}
    recordCombo() {}

    snapshot() { return { ...this.run }; }

    finalize({ victory, score, survivalSeconds }) {
        if (!this.run.finalized) Object.assign(this.run, { victory, score, survivalSeconds, finalized: true });
        return this.snapshot();
    }
}

export const stats = new StatsTracker();
