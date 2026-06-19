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

export const ORGANIC_FIELD_PROFILES = Object.freeze({
    skitter: { width: 6, height: 4, glyphs: ["'", '~', '-'], density: 0.42, birth: [3], survive: [2, 3], maxCells: 15 },
    bloomcaster: { width: 7, height: 5, glyphs: ['*', ':', '%'], density: 0.55, birth: [3, 4], survive: [2, 3, 4], maxCells: 24 },
    ribbon: { width: 9, height: 4, glyphs: ['~', '=', '.'], density: 0.38, birth: [2, 3], survive: [1, 2, 3], maxCells: 22 },
    prism: { width: 6, height: 6, glyphs: ['+', ':', 'x'], density: 0.45, birth: [3], survive: [2, 3], maxCells: 24 },
    carapace: { width: 8, height: 6, glyphs: ['#', '%', ';'], density: 0.68, birth: [3, 4], survive: [2, 3, 4, 5], maxCells: 36 },
    burst_sac: { width: 6, height: 5, glyphs: ['!', '*', ':'], density: 0.54, birth: [3], survive: [2, 3, 4], maxCells: 22 },
    rootweaver: { width: 7, height: 7, glyphs: ['|', ':', 'Y'], density: 0.46, birth: [3, 4], survive: [2, 3, 4], maxCells: 28 },
    spore: { width: 3, height: 3, glyphs: ['.', "'", '*'], density: 0.32, birth: [2, 3], survive: [1, 2, 3], maxCells: 5 },
    colony: { width: 5, height: 5, glyphs: ['o', ':', '+'], density: 0.5, birth: [3], survive: [2, 3], maxCells: 17 },
    parasite: { width: 5, height: 3, glyphs: ['~', ':', '^'], density: 0.4, birth: [2, 3], survive: [1, 2, 3], maxCells: 11 },
    amalgam: { width: 10, height: 7, glyphs: ['%', '~', ':', '#'], density: 0.58, birth: [3, 4], survive: [2, 3, 4], maxCells: 48 },
    serpent: { width: 12, height: 9, glyphs: ['~', '=', ':', '%'], density: 0.52, birth: [2, 3], survive: [1, 2, 3], maxCells: 66 },
    watcher: { width: 15, height: 11, glyphs: [':', 'o', '*', '+'], density: 0.47, birth: [3], survive: [2, 3, 4], maxCells: 78 },
    carrier: { width: 18, height: 11, glyphs: ['#', '%', ':', 'Y'], density: 0.62, birth: [3, 4], survive: [2, 3, 4, 5], maxCells: 112 }
});

// These are growth grammars, not sprites. Each mark is a preferred tissue site;
// the automaton mutates its edges while preserving the family's visual rhythm.
const FAMILY_GROWTH_GRAMMARS = Object.freeze({
    skitter: ['  x x ', ' xxx  ', 'x xx x', '  x   '],
    bloomcaster: ['  xxx  ', ' xxxxx ', 'xx x xx', ' xxxxx ', '  x x  '],
    ribbon: ['xx       ', ' xxxx    ', '   xxxx  ', '      xxx'],
    prism: ['  x x ', ' xxxxx', 'xx x x', ' xxxxx', 'x x x ', '  x   '],
    carapace: ['  xxxx  ', ' xxxxxx ', 'xxxxxxxx', 'xxx  xxx', ' xxxxxx ', '  xxxx  '],
    burst_sac: ['  xx  ', ' xxxx ', 'xx xx ', ' xxxx ', '  xx  '],
    rootweaver: ['   x   ', ' xxxxx ', '  xxx  ', 'xxxxxxx', '  xxx  ', ' x x x ', 'x  x  x'],
    spore: [' x ', 'xxx', ' x '],
    colony: [' xx  ', 'xxxx ', ' xxx ', '  xxx', ' x x '],
    parasite: ['xx   ', ' xxxx', 'xx x '],
    amalgam: ['  xxx xxx ', ' xxxxxxxx ', 'xxx xx xxx', ' xxxxxxxx ', 'xxx xxxx  ', ' xx  xxxx ', '  xx xx   '],
    serpent: ['   xxxx     ', ' xxxxxxxx   ', 'xxx  xxxxx  ', ' xxxxx xxxxx', '  xxxxx xxxx', ' xxxx xxx   ', '  xxxxx     ', '   xxx      ', '    x       '],
    watcher: ['    xxxxxxx    ', '  xxxxxxxxxxx  ', 'xxxxxx   xxxxxx', ' xxxx xxx xxxx ', 'xxx  xxxxx  xxx', ' xxxx xxx xxxx ', 'xxxxxx   xxxxxx', '  xxxxxxxxxxx  ', '    xxxxxxx    ', ' x   xxx   x   ', '   x  x  x     '],
    carrier: ['   xxxx  xxxx   ', ' xxxxxxxxxxxxxxxx ', 'xxxx  xxxxxx  xxxx', 'xxxxxxxxxxxxxxxxxx', 'xxx xxxx  xxxx xxx', 'xxxxxxxxxxxxxxxxxx', ' xxxx xxxxxx xxxx ', '  xxxxxxxxxxxxxx  ', ' xx  xxxxxxxx  xx ', 'x x   xxxxxx   x x', ' x     xxxx     x ']
});

const cellKey = (x, y) => `${x},${y}`;
const cellNoise = (seed, frame, x, y) => seededRandom(hashSeed(`${seed}:${frame}:${x}:${y}`))();

export class OrganicField {
    constructor(genome) {
        this.seed = genome.seed;
        this.family = genome.family;
        this.profile = ORGANIC_FIELD_PROFILES[this.family] || ORGANIC_FIELD_PROFILES.skitter;
        this.width = this.profile.width;
        this.height = this.profile.height;
        this.frames = this.buildFrames();
    }

    buildFrames() {
        const profile = this.profile;
        const rng = seededRandom(hashSeed(`field:${this.seed}:${this.family}`));
        let cells = new Set();
        const grammar = FAMILY_GROWTH_GRAMMARS[this.family];
        if (grammar) for (let y = 0; y < Math.min(this.height, grammar.length); y++) {
            for (let x = 0; x < Math.min(this.width, grammar[y].length); x++) {
                if (grammar[y][x] !== ' ') cells.add(cellKey(x, y));
            }
        }
        // Genome variation removes a few peripheral sites and grows a few new ones.
        // The central grammar remains, so variation reads as a species instead of noise.
        for (const key of [...cells]) {
            const [x, y] = key.split(',').map(Number);
            const edge = x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1;
            if ((edge ? 0.24 : 0.07) > rng()) cells.delete(key);
        }
        for (let i = 0; i < Math.ceil(profile.maxCells * 0.12); i++) {
            const x = Math.floor(rng() * this.width), y = Math.floor(rng() * this.height);
            if ([...cells].some(key => { const [cx, cy] = key.split(',').map(Number); return Math.abs(cx - x) <= 1 && Math.abs(cy - y) <= 1; })) cells.add(cellKey(x, y));
        }
        this.reseed(cells, 0);
        const frames = [];
        for (let frame = 0; frame < 8; frame++) {
            frames.push(this.snapshot(cells, frame));
            cells = this.evolve(cells, frame + 1);
        }
        return frames;
    }

    reseed(cells, frame) {
        const minimum = Math.max(3, Math.floor(this.profile.maxCells * 0.28));
        for (let attempt = 0; cells.size < minimum && attempt < this.width * this.height * 2; attempt++) {
            const x = Math.floor(cellNoise(this.seed, frame, attempt, 17) * this.width);
            const y = Math.floor(cellNoise(this.seed, frame, attempt, 31) * this.height);
            cells.add(cellKey(x, y));
        }
    }

    evolve(cells, frame) {
        const next = new Set();
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
            let neighbours = 0;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
                if ((ox || oy) && cells.has(cellKey(x + ox, y + oy))) neighbours++;
            }
            const alive = cells.has(cellKey(x, y));
            const noise = cellNoise(this.seed, frame, x, y);
            const survives = alive && (this.profile.survive.includes(neighbours) || noise < 0.1);
            const born = !alive && this.profile.birth.includes(neighbours) && noise < 0.82;
            if (survives || born) next.add(cellKey(x, y));
        }
        this.reseed(next, frame);
        if (next.size > this.profile.maxCells) {
            const kept = [...next].sort((a, b) => hashSeed(`${this.seed}:${frame}:${a}`) - hashSeed(`${this.seed}:${frame}:${b}`)).slice(0, this.profile.maxCells);
            return new Set(kept);
        }
        return next;
    }

    snapshot(cells, frame) {
        return [...cells].map(key => {
            const [x, y] = key.split(',').map(Number);
            const index = hashSeed(`${this.seed}:${frame}:${x}:${y}`) % this.profile.glyphs.length;
            return { x, y, glyph: this.profile.glyphs[index] };
        });
    }

    render(enemy, animationTime) {
        const frameIndex = Math.floor((animationTime + enemy.genome.pulseOffset) / 6) % this.frames.length;
        const cells = this.frames[frameIndex];
        const grid = Array.from({ length: this.height }, () => Array(this.width).fill(' '));
        for (const cell of cells) {
            let glyph = cell.glyph;
            let removed = false;
            for (const organ of enemy.organs || []) {
                if (organ.state === OrganState.HEALTHY) continue;
                const ox = organ.x / Math.max(1, enemy.width) * (this.width - 1);
                const oy = organ.y / Math.max(1, enemy.height) * (this.height - 1);
                const distance = Math.hypot(cell.x - ox, cell.y - oy);
                if (distance > 1.7) continue;
                const noise = cellNoise(this.seed, frameIndex, cell.x + organ.id.length, cell.y);
                if (organ.state === OrganState.SEVERED || (organ.state === OrganState.RUPTURED && noise < 0.7)) removed = true;
                else if (noise < 0.65) glyph = organ.state === OrganState.WOUNDED ? enemy.genome.scarGlyph : 'x';
            }
            if (!removed) grid[cell.y][cell.x] = glyph;
        }
        const occupiedRows = grid.map((row, y) => ({ row, y })).filter(entry => entry.row.some(glyph => glyph !== ' '));
        if (!occupiedRows.length) return ['x'];
        const minX = Math.min(...occupiedRows.flatMap(entry => entry.row.map((glyph, x) => glyph === ' ' ? this.width : x)));
        const maxX = Math.max(...occupiedRows.flatMap(entry => entry.row.map((glyph, x) => glyph === ' ' ? -1 : x)));
        return occupiedRows.map(entry => entry.row.slice(minX, maxX + 1).join(''));
    }
}

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
        this.organicField = new OrganicField(genome);
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

export function renderCreatureBody(enemy, animationTime = 0) {
    return enemy.bodyPlan?.organicField?.render(enemy, animationTime) || null;
}

export function getGenomeModifiers(genome) {
    const result = { bullet: 1, laser: 1, splash: 1, dash: 1, electric: 1, speed: 1, spacing: 1, link: 1, coreExposure: 1 };
    for (const adaptation of genome?.adaptations || []) Object.assign(result, adaptation.modifiers || {});
    return result;
}
