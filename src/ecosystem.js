import { COMBAT_CONFIG, ECOSYSTEM_TYPES, NORMAL_ENEMY_TYPES, PALETTE } from './config.js';
import { RENDER_CELL_TYPES } from './renderer.js';
import { matrixRain } from './matrixRain.js';

const LATTICE = 2;
const keyFor = (x, y) => `${Math.round(x / LATTICE)},${Math.round(y / LATTICE)}`;
const terrainKey = (x, y) => `${Math.round(x)},${Math.round(y)}`;
const isCell = enemy => enemy && ECOSYSTEM_TYPES.has(enemy.type);

export class EcosystemSystem {
    constructor() {
        this.reset(300, 200);
    }

    reset(cols = 300, rows = 200, manager = null) {
        this.cols = cols;
        this.rows = rows;
        this.tick = 0;
        this.nutrients = [];
        this.terrain = new Map();
        this.lastMergeTick = -999;
        if (manager) {
            this.seed(manager, 3);
            this.seedTerrain(5);
        }
    }

    count(manager) {
        return manager.enemies.filter(isCell).reduce((sum, enemy) => sum + (enemy.type === 'cell_amalgam' ? 5 : 1), 0);
    }

    seed(manager, clusters = 1) {
        for (let cluster = 0; cluster < clusters; cluster++) {
            const cx = 20 + Math.random() * Math.max(10, this.cols - 40);
            const cy = 20 + Math.random() * Math.max(10, this.rows - 40);
            const pattern = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 2]];
            for (const [dx, dy] of pattern) {
                if (this.count(manager) >= COMBAT_CONFIG.ecosystemPopulationCap) return;
                const cell = manager.spawn(Math.round((cx + dx * LATTICE) / LATTICE) * LATTICE, Math.round((cy + dy * LATTICE) / LATTICE) * LATTICE, 'cell_colony');
                if (cell) cell.ecosystemAge = 0;
            }
            manager.spawn(cx - 3, cy + 2, cluster % 2 ? 'cell_parasite' : 'cell_spore');
        }
    }

    addNutrient(x, y, value = 1) {
        this.nutrients.push({ x, y, value: Math.max(1, value), life: 30 * 60 });
        if (this.nutrients.length > 40) this.nutrients.shift();
    }

    sectorAt(x, y) {
        const left = x < this.cols / 2;
        const top = y < this.rows / 2;
        if (left && top) return 'STACK';
        if (!left && top) return 'HEAP';
        if (left && !top) return 'NULL';
        return 'KERNEL';
    }

    addTerrain(x, y, density = 1, mutation = null) {
        const gx = Math.max(1, Math.min(this.cols - 2, Math.round(x)));
        const gy = Math.max(1, Math.min(this.rows - 2, Math.round(y)));
        if (matrixRain.obstacles?.[gx]?.[gy]) return null;
        const key = terrainKey(gx, gy);
        const existing = this.terrain.get(key);
        if (existing) {
            existing.density = Math.min(4, existing.density + density);
            existing.age = 0;
            return existing;
        }
        if (this.terrain.size >= COMBAT_CONFIG.ecosystemTerrainCap) return null;
        const cell = { x: gx, y: gy, age: 0, density: Math.max(1, density), nutrient: 0, mutation: mutation || this.sectorAt(gx, gy) };
        this.terrain.set(key, cell);
        return cell;
    }

    seedTerrain(clusters = 1, edge = false) {
        const patterns = [[0, 0], [2, 0], [-2, 0], [0, 2], [2, 2], [-2, -2]];
        for (let i = 0; i < clusters; i++) {
            const cx = edge ? (Math.random() < 0.5 ? 3 : this.cols - 4) : 12 + Math.random() * Math.max(8, this.cols - 24);
            const cy = edge ? 8 + Math.random() * Math.max(8, this.rows - 16) : 12 + Math.random() * Math.max(8, this.rows - 24);
            for (const [dx, dy] of patterns) this.addTerrain(cx + dx, cy + dy, 1);
        }
    }

    terrainAt(x, y) { return this.terrain.get(terrainKey(x, y)) || null; }
    densityAt(x, y) { return this.terrainAt(x, y)?.density || 0; }
    isDense(x, y) { return this.densityAt(x, y) >= COMBAT_CONFIG.ecosystemDenseThreshold; }
    movementMultiplier(x, y) { return this.isDense(x, y) ? 0.78 : 1; }
    blocksProjectile(x, y) { return this.isDense(x, y); }

    damageTerrain(x, y, damage = 1) {
        const key = terrainKey(x, y);
        const cell = this.terrain.get(key);
        if (!cell) return false;
        cell.density -= damage;
        if (cell.density <= 0) this.terrain.delete(key);
        return true;
    }

    onEntityDeath(enemy, manager) {
        this.addNutrient(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, Math.max(1, enemy.xpValue / 20));
        if (enemy.parasiteCount > 0) {
            for (let i = 0; i < Math.min(4, enemy.parasiteCount * 2); i++) {
                manager.spawn(enemy.x + (Math.random() - 0.5) * 3, enemy.y + (Math.random() - 0.5) * 3, 'cell_spore');
            }
        }
    }

    update(manager, player) {
        this.tick++;
        for (let i = this.nutrients.length - 1; i >= 0; i--) {
            if (--this.nutrients[i].life <= 0) this.nutrients.splice(i, 1);
        }
        if (this.tick % 10 !== 0) return;

        const ecosystem = manager.enemies.filter(isCell);
        for (const entity of ecosystem) entity.ecosystemAge = (entity.ecosystemAge || 0) + 10;
        this.attachParasites(manager);
        this.settleSpores(manager);
        this.feedOrganisms(manager);
        this.stepCellularAutomaton(manager);
        this.stepTerrain(manager);
        this.mergeColonies(manager);

        if (this.tick % (45 * 60) === 0 && this.count(manager) < 5) {
            this.seed(manager, 1);
            this.seedTerrain(1, true);
        }
        if (this.tick % (90 * 60) === 0) this.spawnEncounter(manager, player, this.tick / 60);
    }

    attachParasites(manager) {
        const parasites = manager.enemies.filter(enemy => enemy?.type === 'cell_parasite');
        const hosts = manager.enemies.filter(enemy => enemy && NORMAL_ENEMY_TYPES.has(enemy.type) && !ECOSYSTEM_TYPES.has(enemy.type));
        for (const parasite of parasites) {
            let host = null;
            let best = 2.4;
            for (const candidate of hosts) {
                const distance = Math.hypot(candidate.x - parasite.x, candidate.y - parasite.y);
                if (distance < best) { best = distance; host = candidate; }
            }
            if (!host) continue;
            host.parasiteCount = (host.parasiteCount || 0) + 1;
            if (!host.symbioteBoosted) {
                host.symbioteBoosted = true;
                host.hp *= 1.25;
                host.maxHp *= 1.25;
            }
            const index = manager.enemies.indexOf(parasite);
            if (index >= 0) manager.enemies.splice(index, 1);
        }
    }

    settleSpores(manager) {
        const colonies = manager.enemies.filter(enemy => enemy?.type === 'cell_colony');
        const occupied = new Set(colonies.map(enemy => keyFor(enemy.x, enemy.y)));
        for (const spore of manager.enemies.filter(enemy => enemy?.type === 'cell_spore')) {
            const nearby = colonies.find(cell => Math.hypot(cell.x - spore.x, cell.y - spore.y) < 3.2);
            if (!nearby || this.count(manager) >= COMBAT_CONFIG.ecosystemPopulationCap) continue;
            const x = Math.round(spore.x / LATTICE) * LATTICE;
            const y = Math.round(spore.y / LATTICE) * LATTICE;
            const key = keyFor(x, y);
            if (occupied.has(key)) continue;
            spore.type = 'cell_colony';
            spore.x = x; spore.y = y; spore.vx = 0; spore.vy = 0;
            spore.initType();
            occupied.add(key);
        }
    }

    feedOrganisms(manager) {
        for (let ni = this.nutrients.length - 1; ni >= 0; ni--) {
            const nutrient = this.nutrients[ni];
            const feeder = manager.enemies.find(enemy => isCell(enemy) && Math.hypot(enemy.x - nutrient.x, enemy.y - nutrient.y) < 3.5);
            if (!feeder) continue;
            feeder.energy = (feeder.energy || 0) + nutrient.value;
            this.nutrients.splice(ni, 1);
        }
        for (const amalgam of manager.enemies.filter(enemy => enemy?.type === 'cell_amalgam')) {
            const preyIndex = manager.enemies.findIndex(enemy => enemy && enemy !== amalgam && (enemy.type === 'cell_colony' || enemy.type === 'drone') && Math.hypot(enemy.x - amalgam.x, enemy.y - amalgam.y) < 3);
            if (preyIndex >= 0) {
                manager.enemies.splice(preyIndex, 1);
                amalgam.energy = (amalgam.energy || 0) + 1;
            }
            if ((amalgam.energy || 0) >= 5 && this.count(manager) < COMBAT_CONFIG.ecosystemPopulationCap - 2) {
                amalgam.energy = 0;
                manager.spawn(amalgam.x - 2, amalgam.y, 'cell_spore');
                manager.spawn(amalgam.x + amalgam.width + 1, amalgam.y, 'cell_spore');
            }
        }
    }

    stepCellularAutomaton(manager) {
        const colonies = manager.enemies.filter(enemy => enemy?.type === 'cell_colony');
        const grid = new Map(colonies.map(cell => [keyFor(cell.x, cell.y), cell]));
        const candidateCounts = new Map();
        for (const cell of colonies) {
            const gx = Math.round(cell.x / LATTICE);
            const gy = Math.round(cell.y / LATTICE);
            let neighbours = 0;
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                if (!dx && !dy) continue;
                const key = `${gx + dx},${gy + dy}`;
                if (grid.has(key)) neighbours++;
                else candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
            }
            if ((neighbours < 2 || neighbours > 3) && cell.ecosystemAge > 120 && Math.random() < 0.12) {
                const index = manager.enemies.indexOf(cell);
                if (index >= 0) manager.enemies.splice(index, 1);
            }
        }
        for (const [key, neighbours] of candidateCounts) {
            if (neighbours !== 3 || this.count(manager) >= COMBAT_CONFIG.ecosystemPopulationCap || Math.random() > 0.28) continue;
            const [gx, gy] = key.split(',').map(Number);
            manager.spawn(gx * LATTICE, gy * LATTICE, 'cell_colony');
        }
    }

    stepTerrain(manager) {
        for (const colony of manager.enemies.filter(enemy => enemy?.type === 'cell_colony')) {
            if (Math.random() < 0.35) this.addTerrain(colony.x, colony.y, 1);
        }
        for (let index = this.nutrients.length - 1; index >= 0; index--) {
            const nutrient = this.nutrients[index];
            const nearby = [...this.terrain.values()].find(cell => Math.hypot(cell.x - nutrient.x, cell.y - nutrient.y) <= 4);
            if (!nearby) continue;
            nearby.density = Math.min(4, nearby.density + Math.max(1, Math.floor(nutrient.value)));
            nearby.nutrient += nutrient.value;
            this.nutrients.splice(index, 1);
        }
        const cells = [...this.terrain.values()];
        const occupied = new Set(this.terrain.keys());
        const births = new Map();
        for (const cell of cells) {
            cell.age += 10;
            let neighbours = 0;
            for (let dx = -LATTICE; dx <= LATTICE; dx += LATTICE) for (let dy = -LATTICE; dy <= LATTICE; dy += LATTICE) {
                if (!dx && !dy) continue;
                const key = terrainKey(cell.x + dx, cell.y + dy);
                if (occupied.has(key)) neighbours++;
                else births.set(key, (births.get(key) || 0) + 1);
            }
            if ((neighbours < 2 || neighbours > 4) && cell.age > 180 && Math.random() < 0.08) {
                cell.density--;
                if (cell.density <= 0) this.terrain.delete(terrainKey(cell.x, cell.y));
            }
        }
        for (const [key, neighbours] of births) {
            if (neighbours !== 3 || this.terrain.size >= COMBAT_CONFIG.ecosystemTerrainCap || Math.random() > 0.22) continue;
            const [x, y] = key.split(',').map(Number);
            this.addTerrain(x, y, 1);
        }
    }

    mergeColonies(manager) {
        if (this.tick - this.lastMergeTick < 120) return;
        const colonies = manager.enemies.filter(enemy => enemy?.type === 'cell_colony');
        for (const origin of colonies) {
            const cluster = colonies.filter(cell => Math.hypot(cell.x - origin.x, cell.y - origin.y) <= 6).slice(0, 5);
            if (cluster.length < 5) continue;
            for (const cell of cluster) {
                const index = manager.enemies.indexOf(cell);
                if (index >= 0) manager.enemies.splice(index, 1);
            }
            manager.spawn(origin.x - 2, origin.y - 1, 'cell_amalgam');
            this.lastMergeTick = this.tick;
            break;
        }
    }

    spawnEncounter(manager, player, seconds) {
        const cycle = Math.floor(seconds / 90) % 4;
        const types = ['cell_spore', 'cell_parasite', 'cell_colony', 'cell_amalgam'];
        const type = types[cycle];
        const count = type === 'cell_amalgam' ? 1 : 4;
        for (let i = 0; i < count && this.count(manager) < COMBAT_CONFIG.ecosystemPopulationCap; i++) {
            const angle = (i / count) * Math.PI * 2 + seconds;
            manager.spawn(player.x + Math.cos(angle) * 25, player.y + Math.sin(angle) * 25, type);
        }
        if (cycle === 0) this.seedTerrain(3);
        else if (cycle === 1) {
            for (let i = 0; i < 12; i++) this.addTerrain(player.x + 18 + i * 2, player.y + Math.sin(i) * 5, 1, 'STACK');
        } else if (cycle === 2) {
            for (const cell of [...this.terrain.values()].slice(0, 24)) cell.density = Math.min(4, cell.density + 1);
        } else {
            for (const cell of [...this.terrain.values()].filter((_, i) => i % 3 === 0)) this.terrain.delete(terrainKey(cell.x, cell.y));
        }
    }

    stampToGrid(renderer, player = null) {
        for (const cell of this.terrain.values()) {
            const x = cell.x;
            const y = cell.y;
            if (x < 0 || x >= renderer.cols || y < 0 || y >= renderer.rows) continue;
            if (player && Math.hypot(x - (player.x + player.width / 2), y - (player.y + player.height / 2)) < 4) continue;
            const north = this.terrain.has(terrainKey(x, y - LATTICE));
            const south = this.terrain.has(terrainKey(x, y + LATTICE));
            const east = this.terrain.has(terrainKey(x + LATTICE, y));
            const west = this.terrain.has(terrainKey(x - LATTICE, y));
            let glyph = 'o';
            if (cell.mutation === 'STACK') glyph = north || south ? '|' : cell.density >= 3 ? 'H' : '[';
            else if (cell.mutation === 'HEAP') glyph = cell.density >= 3 ? '#' : east || west ? '=' : '%';
            else if (cell.mutation === 'NULL') glyph = cell.density >= 3 ? ':' : (cell.age / 10) % 2 ? '.' : "'";
            else if (cell.mutation === 'KERNEL') glyph = cell.density >= 3 ? 'X' : north && south && east && west ? '+' : 'O';
            renderer.types[x][y] = RENDER_CELL_TYPES.GLITCH;
            renderer.chars[x][y] = glyph;
            renderer.brightness[x][y] = 0.2 + cell.density * 0.09;
            renderer.customColors[x][y] = '#397d4c';
        }
        for (const nutrient of this.nutrients) {
            const x = Math.floor(nutrient.x);
            const y = Math.floor(nutrient.y);
            if (x < 0 || x >= renderer.cols || y < 0 || y >= renderer.rows) continue;
            renderer.types[x][y] = RENDER_CELL_TYPES.GLITCH;
            renderer.chars[x][y] = nutrient.value > 2 ? ':' : '.';
            renderer.brightness[x][y] = 0.35;
            renderer.customColors[x][y] = PALETTE.pickup;
        }
    }
}

export const ecosystem = new EcosystemSystem();
