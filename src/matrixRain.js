const GLYPHS = '01.:;|/\\-_';

export class MatrixRain {
    constructor() {
        this.cols = 0;
        this.rows = 0;
        this.grid = [];
        this.obstacles = [];
        this.obstacleHP = [];
    }

    resize(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.obstacles = Array(cols).fill(null).map(() => Array(rows).fill(false));
        this.obstacleHP = Array(cols).fill(null).map(() => Array(rows).fill(0));

        // Create background code rain grid
        for (let x = 0; x < cols; x++) {
            const column = [];
            for (let y = 0; y < rows; y++) {
                const baseBrightness = 0.15 + Math.random() * 0.15;
                column.push({
                    char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
                    brightness: baseBrightness,
                    baseBrightness: baseBrightness
                });
            }
            this.grid.push(column);
        }

        // Seed father-themed words randomly in the background static ASCII grid
        const fatherWords = ['abu', 'father', 'papa', 'dad', 'pop', 'pater', 'baba', 'dada', 'abba', 'parent'];
        const numWords = 150;
        for (let w = 0; w < numWords; w++) {
            const word = fatherWords[Math.floor(Math.random() * fatherWords.length)];
            const isHorizontal = Math.random() < 0.5;
            const startX = Math.floor(Math.random() * (cols - word.length - 2)) + 1;
            const startY = Math.floor(Math.random() * (rows - word.length - 2)) + 1;
            
            for (let i = 0; i < word.length; i++) {
                const x = isHorizontal ? startX + i : startX;
                const y = isHorizontal ? startY : startY + i;
                if (x >= 0 && x < cols && y >= 0 && y < rows) {
                    this.grid[x][y].char = word[i];
                }
            }
        }

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
        // Only fade scrambled cells back to their base brightness
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const cell = this.grid[x][y];
                if (cell.brightness > cell.baseBrightness + 0.05) {
                    cell.brightness -= 0.015;
                    if (cell.brightness < cell.baseBrightness) {
                        cell.brightness = cell.baseBrightness;
                    }
                }
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
                    }
                }
            }
        }
    }
}

export const matrixRain = new MatrixRain();
