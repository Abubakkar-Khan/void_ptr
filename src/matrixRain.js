const GLYPHS = '01.:;|/\\-_';
const cellKey = (x, y) => `${x},${y}`;
export const BACKGROUND_WORD_CONFIG = Object.freeze({
    version: 1,
    ordinary: ['memory', 'signal', 'kernel', 'spawn', 'cell', 'grow', 'sleep', 'wake', 'ghost', 'error', 'void', 'null', 'ptr', 'fatal', 'lost', 'alone', 'decay', 'broken', 'corrupt', 'empty', 'panic', 'warn', 'thread', 'stack', 'heap', 'root', 'divide', 'mutate', 'watch', 'carrier'],
    kinship: ['father', 'papa', 'abu', 'dad', 'baba', 'abba', 'padre', 'pater', 'apa', 'tata'],
    ordinaryCount: [90, 120],
    kinshipCount: [24, 32],
    ordinaryBrightness: [0.045, 0.095],
    kinshipBrightness: [0.075, 0.125]
});

export class MatrixRain {
    constructor() {
        this.cols = 0;
        this.rows = 0;
        this.grid = [];
        this.obstacles = [];
        this.obstacleHP = [];
        this.activeCells = new Set();
        this.easterEggs = [];
        this.backgroundWords = [];
        this.seed = 0;
    }

    resize(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.obstacles = Array(cols).fill(null).map(() => Array(rows).fill(false));
        this.obstacleHP = Array(cols).fill(null).map(() => Array(rows).fill(0));
        this.activeCells = new Set();
        this.easterEggs = [];
        this.backgroundWords = [];
        this.seed++;

        // Create background code rain grid
        for (let x = 0; x < cols; x++) {
            const column = [];
            for (let y = 0; y < rows; y++) {
                const sector = this.getSectorName(x, y, cols, rows);
                const sectorGlyphs = sector === 'STACK' ? '|:;[]' : sector === 'HEAP' ? '01{}#@' : sector === 'NULL' ? '... 01' : GLYPHS;
                const baseBrightness = (sector === 'NULL' ? 0.07 : 0.12) + Math.random() * 0.14;
                column.push({
                    char: sectorGlyphs[Math.floor(Math.random() * sectorGlyphs.length)],
                    brightness: baseBrightness,
                    baseBrightness: baseBrightness
                });
            }
            this.grid.push(column);
        }

        const occupiedWordCells = new Set();
        const placeWords = (pool, countRange, brightnessRange, target) => {
            const count = countRange[0] + Math.floor(Math.random() * (countRange[1] - countRange[0] + 1));
            for (let w = 0; w < count; w++) {
                const word = pool[Math.floor(Math.random() * pool.length)];
                let placement = null;
                for (let attempt = 0; attempt < 12 && !placement; attempt++) {
                    const vertical = Math.random() < 0.45;
                    const maxX = Math.max(1, cols - (vertical ? 2 : word.length + 1));
                    const maxY = Math.max(1, rows - (vertical ? word.length + 1 : 2));
                    const x = 1 + Math.floor(Math.random() * maxX), y = 1 + Math.floor(Math.random() * maxY);
                    const cells = Array.from({ length: word.length }, (_, index) => cellKey(vertical ? x : x + index, vertical ? y + index : y));
                    if (cells.every(key => !occupiedWordCells.has(key))) placement = { x, y, vertical, cells };
                }
                if (!placement) continue;
                placement.cells.forEach(key => occupiedWordCells.add(key));
                const brightness = brightnessRange[0] + Math.random() * (brightnessRange[1] - brightnessRange[0]);
                const record = { word, x: placement.x, y: placement.y, vertical: placement.vertical, brightness };
                target.push(record);
                for (let i = 0; i < word.length; i++) {
                    const x = placement.vertical ? placement.x : placement.x + i, y = placement.vertical ? placement.y + i : placement.y;
                    this.grid[x][y].char = word[i]; this.grid[x][y].brightness = brightness; this.grid[x][y].baseBrightness = brightness;
                }
            }
        };
        placeWords(BACKGROUND_WORD_CONFIG.ordinary, BACKGROUND_WORD_CONFIG.ordinaryCount, BACKGROUND_WORD_CONFIG.ordinaryBrightness, this.backgroundWords);
        placeWords(BACKGROUND_WORD_CONFIG.kinship, BACKGROUND_WORD_CONFIG.kinshipCount, BACKGROUND_WORD_CONFIG.kinshipBrightness, this.easterEggs);

        // Seed breakable static code barriers (pillars/debris) in the large world
        const numObstacles = 20;
        for (let i = 0; i < numObstacles; i++) {
            const ox = Math.floor(20 + Math.random() * (cols - 40));
            const oy = Math.floor(20 + Math.random() * (rows - 40));
            const ow = 3 + Math.floor(Math.random() * 4);
            const oh = 3 + Math.floor(Math.random() * 3);
            for (let x = ox; x < ox + ow; x++) {
                for (let y = oy; y < oy + oh; y++) {
                    if (x >= 0 && x < cols && y >= 0 && y < rows) {
                        this.obstacles[x][y] = true;
                        this.obstacleHP[x][y] = 4; // 4 hits to break
                    }
                }
            }
        }
    }

    reset() {
        this.resize(this.cols, this.rows);
    }

    getSectorName(x, y, cols = this.cols, rows = this.rows) {
        const left = x < cols / 2;
        const top = y < rows / 2;
        if (left && top) return 'STACK';
        if (!left && top) return 'HEAP';
        if (left && !top) return 'NULL';
        return 'KERNEL';
    }

    damageObstacle(x, y, damage = 1) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows && this.obstacles[x][y]) {
            this.obstacleHP[x][y] -= damage;
            if (this.obstacleHP[x][y] <= 0) {
                this.obstacles[x][y] = false;
                this.scrambleArea(x, y, 2.5, 0.9);
                return true; // Destroyed
            }
        }
        return false;
    }

    update() {
        // Only update recently scrambled cells instead of scanning the full world.
        for (const key of [...this.activeCells]) {
            const [x, y] = key.split(',').map(Number);
            const cell = this.grid[x]?.[y];
            if (!cell) {
                this.activeCells.delete(key);
                continue;
            }
            cell.brightness -= 0.015;
            if (cell.brightness <= cell.baseBrightness + 0.05) {
                cell.brightness = cell.baseBrightness;
                this.activeCells.delete(key);
            }
        }
    }

    scrambleArea(cx, cy, radius, intensity = 0.8) {
        const startX = Math.max(0, Math.floor(cx - radius));
        const endX = Math.min(this.cols - 1, Math.floor(cx + radius));
        const startY = Math.max(0, Math.floor(cy - radius));
        const endY = Math.min(this.rows - 1, Math.floor(cy + radius));

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= radius * radius) {
                    if (Math.random() < intensity) {
                        this.grid[x][y].char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                        this.grid[x][y].brightness = 0.6 + Math.random() * 0.4;
                        this.activeCells.add(`${x},${y}`);
                    }
                }
            }
        }
    }
}

export const matrixRain = new MatrixRain();
