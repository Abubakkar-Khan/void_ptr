import { FAMILY_BY_TYPE, hashSeed, seededRandom } from './biology.js';

const ADAPTATIONS = Object.freeze({
    bullet: { id: 'angled_shell', name: 'ANGLED SHELL', glyph: '/', modifiers: { bullet: 0.84, speed: 0.88 }, tradeoff: 'slower turning' },
    laser: { id: 'split_membrane', name: 'SPLIT MEMBRANE', glyph: '=', modifiers: { laser: 0.84, coreExposure: 1.18 }, tradeoff: 'larger exposed core' },
    splash: { id: 'dispersal_cilia', name: 'DISPERSAL CILIA', glyph: '~', modifiers: { splash: 0.84, spacing: 1.35, link: 0.78 }, tradeoff: 'weaker pack links' },
    dash: { id: 'anchor_roots', name: 'ANCHOR ROOTS', glyph: 'Y', modifiers: { dash: 0.82, speed: 0.82 }, tradeoff: 'reduced pursuit speed' },
    electric: { id: 'insulation_sac', name: 'INSULATION SAC', glyph: '8', modifiers: { electric: 0.82, coreExposure: 1.12 }, tradeoff: 'ruptures into residue' },
    unknown: { id: 'scar_tissue', name: 'SCAR TISSUE', glyph: 'x', modifiers: { speed: 0.94 }, tradeoff: 'slower movement' }
});

export class EvolutionDirector {
    constructor(seed = 1) { this.reset(seed); }

    reset(seed = 1) {
        this.seed = seed >>> 0;
        this.profiles = new Map();
        this.generation = 0;
    }

    profileFor(typeOrFamily) {
        const family = FAMILY_BY_TYPE[typeOrFamily] || typeOrFamily;
        if (!this.profiles.has(family)) this.profiles.set(family, { family, deaths: 0, pressures: {}, adaptations: [], generation: 0, announcement: null });
        return this.profiles.get(family);
    }

    recordDamage(enemy, context, amount) {
        const profile = this.profileFor(enemy.genome?.family || enemy.type);
        const key = ['bullet', 'laser', 'splash', 'dash', 'electric'].includes(context.damageType) ? context.damageType : 'unknown';
        profile.pressures[key] = (profile.pressures[key] || 0) + Math.max(0, amount);
    }

    recordDeath(enemy, elapsedSeconds = 0) {
        const profile = this.profileFor(enemy.genome?.family || enemy.type);
        profile.deaths++;
        return this.evaluate(profile, elapsedSeconds);
    }

    evaluate(profile, elapsedSeconds) {
        if (profile.adaptations.length >= 3) return null;
        const threshold = profile.adaptations.length + 1;
        if (profile.deaths < threshold * 12 || elapsedSeconds < threshold * 75) return null;
        const ranked = Object.entries(profile.pressures).sort((a, b) => b[1] - a[1]);
        const dominant = ranked[0]?.[0] || 'unknown';
        let adaptation = ADAPTATIONS[dominant] || ADAPTATIONS.unknown;
        if (profile.adaptations.some(existing => existing.id === adaptation.id)) {
            const alternatives = Object.keys(ADAPTATIONS).filter(key => !profile.adaptations.some(existing => existing.id === ADAPTATIONS[key].id));
            const rng = seededRandom(hashSeed(`${this.seed}:${profile.family}:${threshold}`));
            adaptation = ADAPTATIONS[alternatives[Math.floor(rng() * alternatives.length)] || 'unknown'];
        }
        const installed = { ...adaptation, modifiers: { ...adaptation.modifiers }, generation: threshold };
        profile.adaptations.push(installed);
        profile.generation++;
        profile.announcement = `${profile.family.toUpperCase()} // ${installed.name} // ${installed.tradeoff}`;
        this.generation++;
        return installed;
    }

    adaptationsFor(type) { return [...this.profileFor(type).adaptations]; }
    announcementFor(type) {
        const profile = this.profileFor(type);
        const value = profile.announcement;
        profile.announcement = null;
        return value;
    }
}

export const evolution = new EvolutionDirector();
