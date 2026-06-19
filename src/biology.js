export const SpeciesFamily = Object.freeze({
    SKITTER: 'skitter', BLOOMCASTER: 'bloomcaster', RIBBON: 'ribbon', PRISM: 'prism',
    CARAPACE: 'carapace', BURST_SAC: 'burst_sac', ROOTWEAVER: 'rootweaver',
    SPORE: 'spore', COLONY: 'colony', PARASITE: 'parasite', AMALGAM: 'amalgam',
    SERPENT: 'serpent', WATCHER: 'watcher', CARRIER: 'carrier'
});

export const OrganState = Object.freeze({ HEALTHY: 'healthy', WOUNDED: 'wounded', RUPTURED: 'ruptured', SEVERED: 'severed' });
export const PackRole = Object.freeze({ SCOUT: 'scout', FLANKER: 'flanker', ANCHOR: 'anchor', FEEDER: 'feeder', PROTECTOR: 'protector', RETREAT: 'retreat' });

export const FAMILY_BY_TYPE = Object.freeze({
    drone: SpeciesFamily.SKITTER, shooter: SpeciesFamily.BLOOMCASTER, worm: SpeciesFamily.RIBBON,
    virus: SpeciesFamily.PRISM, brute: SpeciesFamily.CARAPACE, brute_medium: SpeciesFamily.CARAPACE,
    kamikaze: SpeciesFamily.BURST_SAC, shield_projector: SpeciesFamily.ROOTWEAVER,
    cell_spore: SpeciesFamily.SPORE, cell_colony: SpeciesFamily.COLONY,
    cell_parasite: SpeciesFamily.PARASITE, cell_amalgam: SpeciesFamily.AMALGAM,
    boss_snake: SpeciesFamily.SERPENT, boss_eye: SpeciesFamily.WATCHER, boss_carrier: SpeciesFamily.CARRIER
});

const FAMILY_ROLES = Object.freeze({
    skitter: PackRole.SCOUT, bloomcaster: PackRole.FEEDER, ribbon: PackRole.FLANKER,
    prism: PackRole.SCOUT, carapace: PackRole.PROTECTOR, burst_sac: PackRole.FLANKER,
    rootweaver: PackRole.ANCHOR, spore: PackRole.FEEDER, colony: PackRole.ANCHOR,
    parasite: PackRole.FEEDER, amalgam: PackRole.PROTECTOR,
    serpent: PackRole.FLANKER, watcher: PackRole.ANCHOR, carrier: PackRole.PROTECTOR
});

export function hashSeed(value) {
    const text = String(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
}

export function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let t = state;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const pick = (rng, values) => values[Math.floor(rng() * values.length) % values.length];

export class Genome {
    constructor(type, seed, adaptations = []) {
        const rng = seededRandom(hashSeed(`${type}:${seed}`));
        this.seed = seed >>> 0;
        this.signature = hashSeed(`${type}:${seed}`).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
        this.family = FAMILY_BY_TYPE[type] || SpeciesFamily.SKITTER;
        this.role = FAMILY_ROLES[this.family] || PackRole.SCOUT;
        this.symmetry = pick(rng, ['bilateral', 'bilateral', 'radial', 'offset']);
        this.limbCount = 2 + Math.floor(rng() * 3) * 2;
        this.tendrilCount = 1 + Math.floor(rng() * 4);
        this.coreGlyph = pick(rng, ['@', 'O', '0', 'X']);
        this.shellGlyph = pick(rng, ['#', '=', '%', 'H']);
        this.sensorGlyph = pick(rng, ['o', '^', '!', '*']);
        this.scarGlyph = pick(rng, ['x', '/', '\\', ':']);
        this.bias = rng() < 0.5 ? -1 : 1;
        this.pulseOffset = Math.floor(rng() * 24);
        this.adaptations = [...adaptations];
    }
}

const organ = (id, type, x, y, maxHp, effect) => ({ id, type, x, y, hp: maxHp, maxHp, state: OrganState.HEALTHY, effect });

export class BodyPlan {
    constructor(type, genome, width, height) {
        this.type = type;
        this.genome = genome;
        this.width = width;
        this.height = height;
        this.organs = this.createOrgans();
    }

    createOrgans() {
        const w = this.width, h = this.height;
        const list = [organ('core', 'core', w * 0.5, h * 0.5, 18, 'vulnerability')];
        if (![SpeciesFamily.SPORE, SpeciesFamily.COLONY].includes(this.genome.family)) list.push(organ('sense', 'sensory', w * 0.5, Math.max(0, h * 0.18), 8, 'aim'));
        if ([SpeciesFamily.SKITTER, SpeciesFamily.RIBBON, SpeciesFamily.CARAPACE, SpeciesFamily.AMALGAM, SpeciesFamily.SERPENT, SpeciesFamily.CARRIER].includes(this.genome.family)) list.push(organ('motion', 'locomotion', w * 0.5, h * 0.82, 10, 'movement'));
        if ([SpeciesFamily.BLOOMCASTER, SpeciesFamily.RIBBON, SpeciesFamily.PRISM, SpeciesFamily.BURST_SAC, SpeciesFamily.WATCHER, SpeciesFamily.CARRIER, SpeciesFamily.SERPENT].includes(this.genome.family)) list.push(organ('attack', 'attack', w * 0.78, h * 0.48, 10, 'fire'));
        if ([SpeciesFamily.CARAPACE, SpeciesFamily.ROOTWEAVER, SpeciesFamily.CARRIER].includes(this.genome.family)) list.push(organ('shell', 'defensive', w * 0.22, h * 0.48, 13, 'armor'));
        if (![SpeciesFamily.SPORE, SpeciesFamily.COLONY, SpeciesFamily.BURST_SAC].includes(this.genome.family)) list.push(organ('signal', 'social', w * 0.18, h * 0.2, 7, 'coordination'));
        if (this.genome.family === SpeciesFamily.SERPENT) list.push(organ('vertebra', 'defensive', w * 0.38, h * 0.68, 12, 'segment'));
        if (this.genome.family === SpeciesFamily.WATCHER) list.push(organ('lobe', 'sensory', w * 0.72, h * 0.3, 9, 'vision_lobe'));
        if (this.genome.family === SpeciesFamily.CARRIER) list.push(organ('bay', 'attack', w * 0.28, h * 0.68, 11, 'gestation'));
        return list;
    }
}

export function createBiology(type, seed, width, height, adaptations = []) {
    const genome = new Genome(type, seed, adaptations);
    return { genome, bodyPlan: new BodyPlan(type, genome, width, height) };
}

export function normalizeDamageContext(input, hitX = null, hitY = null) {
    if (typeof input === 'object' && input) return {
        amount: Math.max(0, input.amount || 0), source: input.source || 'unknown', damageType: input.damageType || input.source || 'unknown',
        hitX: input.hitX ?? hitX, hitY: input.hitY ?? hitY, directionX: input.directionX || 0, directionY: input.directionY || 0, force: input.force || 0
    };
    return { amount: Math.max(0, Number(input) || 0), source: 'unknown', damageType: 'unknown', hitX, hitY, directionX: 0, directionY: 0, force: 0 };
}

export function damageOrgan(enemy, context) {
    const organs = enemy.organs?.filter(entry => entry.state !== OrganState.SEVERED) || [];
    if (!organs.length) return null;
    const localX = context.hitX == null ? enemy.width * 0.5 : context.hitX - enemy.x;
    const localY = context.hitY == null ? enemy.height * 0.5 : context.hitY - enemy.y;
    let target = organs.reduce((best, entry) => {
        const distance = Math.hypot(entry.x - localX, entry.y - localY);
        return !best || distance < best.distance ? { entry, distance } : best;
    }, null).entry;
    target.hp -= context.amount * 0.55;
    const previous = target.state;
    const ratio = target.hp / target.maxHp;
    target.state = ratio <= -0.35 ? OrganState.SEVERED : ratio <= 0 ? OrganState.RUPTURED : ratio <= 0.55 ? OrganState.WOUNDED : OrganState.HEALTHY;
    return { organ: target, previous, changed: previous !== target.state };
}

export function organModifier(enemy, effect, healthy = 1, wounded = 0.72, disabled = 0.25) {
    const target = enemy.organs?.find(entry => entry.effect === effect);
    if (!target) return healthy;
    if (target.state === OrganState.WOUNDED) return wounded;
    if (target.state === OrganState.RUPTURED || target.state === OrganState.SEVERED) return disabled;
    return healthy;
}

const stateGlyph = (organState, healthyGlyph, genome) => organState === OrganState.HEALTHY ? healthyGlyph : organState === OrganState.WOUNDED ? genome.scarGlyph : organState === OrganState.RUPTURED ? 'x' : ' ';
const findOrgan = (enemy, id) => enemy.organs?.find(entry => entry.id === id) || { state: OrganState.HEALTHY };

export function renderCreatureBody(enemy, animationTime = 0) {
    const g = enemy.genome;
    const pulse = Math.floor((animationTime + g.pulseOffset) / 10) % 2 === 0;
    const cache = enemy.bodyPlan?.silhouetteCache || (enemy.bodyPlan ? (enemy.bodyPlan.silhouetteCache = new Map()) : null);
    const cacheKey = `${pulse ? 1 : 0}:${enemy.attackState || 'idle'}:${(enemy.organs || []).map(entry => entry.state[0]).join('')}`;
    if (cache?.has(cacheKey)) return cache.get(cacheKey);
    const remember = rows => { if (cache) cache.set(cacheKey, rows); return rows; };
    const core = stateGlyph(findOrgan(enemy, 'core').state, g.coreGlyph, g);
    const sense = stateGlyph(findOrgan(enemy, 'sense').state, g.sensorGlyph, g);
    const attack = stateGlyph(findOrgan(enemy, 'attack').state, pulse ? '*' : '+', g);
    const shell = stateGlyph(findOrgan(enemy, 'shell').state, g.shellGlyph, g);
    const motion = stateGlyph(findOrgan(enemy, 'motion').state, pulse ? '/' : '\\', g);
    const signal = stateGlyph(findOrgan(enemy, 'signal').state, '^', g);
    const adapted = g.adaptations.length ? g.adaptations.at(-1).glyph : '';
    switch (g.family) {
        case SpeciesFamily.SKITTER: return remember([` ${signal} ${adapted}`, `${motion}<${core}>${motion}`, ` / ${sense} \\`]);
        case SpeciesFamily.BLOOMCASTER: return remember([` /${sense}\\ `, `<${shell}${core}${attack}>`, ` \\_|_/ `]);
        case SpeciesFamily.RIBBON: return remember([`${signal}${sense}`, `<${core}${attack}=>`, ` ${motion}${motion}`]);
        case SpeciesFamily.PRISM: return remember([` \\${sense}/ `, `--{${core}}--`, ` /${attack}\\ `]);
        case SpeciesFamily.CARAPACE: return remember([` /${shell}${shell}\\ `, `<${shell}[${core}]${shell}>`, ` \\${motion}${motion}/ `]);
        case SpeciesFamily.BURST_SAC: return remember([` /${sense}\\ `, `<(${core})>`, ` \\${attack}/ `]);
        case SpeciesFamily.ROOTWEAVER: return remember([` ${signal}${sense}${signal} `, `<{${core}}>`, ` /|${attack}|\\`, `_${motion}|${motion}_`]);
        case SpeciesFamily.SPORE: return remember([pulse ? '*' : '.']);
        case SpeciesFamily.COLONY: return remember([pulse ? 'o' : 'O']);
        case SpeciesFamily.PARASITE: return remember([pulse ? '~^' : '^~']);
        case SpeciesFamily.AMALGAM: return remember([` /${sense}-${sense}\\ `, `<{${core}${attack}${core}}>`, ` \\_${motion}_/ `]);
        default: return null;
    }
}

export function getGenomeModifiers(genome) {
    const result = { bullet: 1, laser: 1, splash: 1, dash: 1, electric: 1, speed: 1, spacing: 1, link: 1, coreExposure: 1 };
    for (const adaptation of genome?.adaptations || []) Object.assign(result, adaptation.modifiers || {});
    return result;
}
