import { matrixRain } from './matrixRain.js';
import { PALETTE } from './config.js';

const GLYPHS = '01.:;|/\\-_';

export const CELL_TYPES = {
    RAIN: 0,
    PLAYER_VOID: 1,
    ENEMY_VOID: 2,
    BULLET_VOID: 3,
    GLITCH: 4,
    UI_VOID: 5,
    UI_TEXT: 6,
    UI_BORDER: 7,
    ENEMY_GLITCH: 8
};

class GridRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        
        // Cell sizing - good readability
        this.cellWidth = 9;
        this.cellHeight = 15;

        // World grid dimensions (large)
        this.worldCols = 300;
        this.worldRows = 200;

        // View dimensions (how many cells fit on screen)
        this.viewCols = 0;
        this.viewRows = 0;

        // Camera position (top-left corner in grid units)
        this.camX = 0;
        this.camY = 0;

        // 2D grid states — WORLD-sized
        this.chars = [];
        this.brightness = [];
        this.types = [];
        this.customColors = [];

        // Displacement fields — WORLD-sized
        this.dispX = [];
        this.dispY = [];

        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        this.maskCache = new Map();
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        const storage = typeof localStorage !== 'undefined' ? localStorage : null;
        this.reducedMotion = storage?.getItem('voidptr_reduced_motion') === 'true';
        this.monochrome = storage?.getItem('voidptr_color_mode') === 'mono';
        this.animationTime = 0;
    }

    // Backward compat: renderer.cols / renderer.rows return world size
    get cols() { return this.worldCols; }
    get rows() { return this.worldRows; }

    init(canvasElement) {
        if (!canvasElement) {
            console.error("Renderer Error: game-canvas element not resolved!");
            return;
        }
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this._initWorldGrid();
        this.resize();
    }

    _initWorldGrid() {
        const wc = this.worldCols;
        const wr = this.worldRows;

        this.chars = Array(wc).fill(null).map(() => Array(wr).fill(' '));
        this.brightness = Array(wc).fill(null).map(() => Array(wr).fill(0));
        this.types = Array(wc).fill(null).map(() => Array(wr).fill(CELL_TYPES.RAIN));
        this.customColors = Array(wc).fill(null).map(() => Array(wr).fill(null));
        this.dispX = Array(wc).fill(null).map(() => Array(wr).fill(0));
        this.dispY = Array(wc).fill(null).map(() => Array(wr).fill(0));

        // Initialize matrixRain with world size
        matrixRain.resize(wc, wr);
    }

    resize() {
        if (!this.canvas) return;

        const viewport = window.visualViewport;
        const container = this.canvas.parentElement;
        const containerStyle = container ? getComputedStyle(container) : null;
        const horizontalInset = containerStyle ? parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight) : 0;
        const verticalInset = containerStyle ? parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom) : 0;
        const width = Math.max(1, (viewport?.width || window.innerWidth) - horizontalInset);
        const height = Math.max(1, (viewport?.height || window.innerHeight) - verticalInset);
        const touchLayout = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
        this.isTouchLayout = touchLayout;
        this.cellWidth = touchLayout ? (width > height ? 7 : 6) : 9;
        this.cellHeight = touchLayout ? (width > height ? 11 : 10) : 15;
        this.width = width;
        this.height = height;
        this.dpr = Math.min(2, window.devicePixelRatio || 1);

        this.canvas.width = Math.floor(width * this.dpr);
        this.canvas.height = Math.floor(height * this.dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.__logicalWidth = width;
        this.canvas.__logicalHeight = height;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this.viewCols = Math.floor(width / this.cellWidth) + 2;
        this.viewRows = Math.floor(height / this.cellHeight) + 2;

        // World grid and matrixRain stay the same size — no re-init
    }

    clearGrid(brightnessFactor = 1.0, playerInstance = null) {
        // Only copy from matrixRain for the visible portion (with a small margin)
        const startX = Math.max(0, Math.floor(this.camX) - 1);
        const endX = Math.min(this.worldCols - 1, Math.floor(this.camX) + this.viewCols + 1);
        const startY = Math.max(0, Math.floor(this.camY) - 1);
        const endY = Math.min(this.worldRows - 1, Math.floor(this.camY) + this.viewRows + 1);

        let pcx = 0;
        let pcy = 0;
        if (playerInstance) {
            pcx = playerInstance.x + 1.5;
            pcy = playerInstance.y + 1.5;
        }

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                if (brightnessFactor <= 0) {
                    this.chars[x][y] = ' ';
                    this.brightness[x][y] = 0;
                    this.types[x][y] = CELL_TYPES.RAIN;
                    this.customColors[x][y] = null;
                    this.dispX[x][y] = 0;
                    this.dispY[x][y] = 0;
                    continue;
                }

                // Legibility Culling: Clear cells near the player's ship
                if (playerInstance && Math.sqrt((x - pcx) * (x - pcx) + (y - pcy) * (y - pcy)) < 4.0) {
                    this.chars[x][y] = ' ';
                    this.brightness[x][y] = 0;
                    this.types[x][y] = CELL_TYPES.RAIN;
                    this.customColors[x][y] = null;
                    this.dispX[x][y] = 0;
                    this.dispY[x][y] = 0;
                    continue;
                }

                if (matrixRain.obstacles && matrixRain.obstacles[x][y]) {
                    this.chars[x][y] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
                    this.brightness[x][y] = (0.5 + Math.random() * 0.5) * brightnessFactor;
                    this.types[x][y] = CELL_TYPES.GLITCH;
                    this.customColors[x][y] = null;
                    this.dispX[x][y] = 0;
                    this.dispY[x][y] = 0;
                    continue;
                }

                const rainCell = matrixRain.grid[x][y];

                this.chars[x][y] = rainCell.char;
                this.brightness[x][y] = rainCell.brightness * brightnessFactor;
                this.types[x][y] = CELL_TYPES.RAIN;
                this.customColors[x][y] = null;

                this.dispX[x][y] = 0;
                this.dispY[x][y] = 0;
            }
        }
    }

    updateCamera(playerX, playerY) {
        // Target: center the player on screen
        const targetX = playerX - this.viewCols / 2;
        const targetY = playerY - this.viewRows / 2;

        // Smooth lerp
        this.camX += (targetX - this.camX) * 0.08;
        this.camY += (targetY - this.camY) * 0.08;

        // Clamp camera to world bounds
        this.camX = Math.max(0, Math.min(this.camX, this.worldCols - this.viewCols));
        this.camY = Math.max(0, Math.min(this.camY, this.worldRows - this.viewRows));
    }

    snapCamera(playerX, playerY) {
        this.camX = Math.max(0, Math.min(playerX - this.viewCols / 2, Math.max(0, this.worldCols - this.viewCols)));
        this.camY = Math.max(0, Math.min(playerY - this.viewRows / 2, Math.max(0, this.worldRows - this.viewRows)));
    }

    applyBoxDisplacement(bx, by, w, h, pushR, strength, voidType, color = null) {
        const startX = Math.max(0, Math.floor(bx - pushR - 1));
        const endX = Math.min(this.worldCols - 1, Math.ceil(bx + w + pushR + 1));
        const startY = Math.max(0, Math.floor(by - pushR - 1));
        const endY = Math.min(this.worldRows - 1, Math.ceil(by + h + pushR + 1));

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                if (x >= bx && x < bx + w && y >= by && y < by + h) {
                    this.types[x][y] = voidType;
                    if (color) this.customColors[x][y] = color;
                    continue;
                }

                const closestX = Math.max(bx, Math.min(x, bx + w - 1));
                const closestY = Math.max(by, Math.min(y, by + h - 1));

                const dx = x - closestX;
                const dy = y - closestY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < pushR) {
                    const force = (pushR - dist) / pushR;
                    const angle = Math.atan2(dy, dx);

                    this.dispX[x][y] += Math.cos(angle) * force * strength;
                    this.dispY[x][y] += Math.sin(angle) * force * strength;

                    if (this.types[x][y] === CELL_TYPES.RAIN) {
                        this.types[x][y] = CELL_TYPES.GLITCH;
                        this.customColors[x][y] = color;
                    }
                }
            }
        }
    }

    getTextMask(text, fontSizeStr = "48px", scaleX = 1, scaleY = 1) {
        const cacheKey = `${text}_${fontSizeStr}_${scaleX}_${scaleY}`;
        if (this.maskCache.has(cacheKey)) {
            return this.maskCache.get(cacheKey);
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.font = `bold ${fontSizeStr} 'VT323', monospace`;
        const metrics = tempCtx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = parseInt(fontSizeStr);

        tempCanvas.width = textWidth + 12;
        tempCanvas.height = textHeight + 12;

        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = `bold ${fontSizeStr} 'VT323', monospace`;
        tempCtx.textBaseline = 'top';
        tempCtx.fillText(text, 6, 6);

        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imgData.data;

        const maskCols = Math.ceil(tempCanvas.width / scaleX);
        const maskRows = Math.ceil(tempCanvas.height / scaleY);

        const mask = Array(maskRows).fill(null).map(() => Array(maskCols).fill(false));

        for (let my = 0; my < maskRows; my++) {
            for (let mx = 0; mx < maskCols; mx++) {
                let filled = false;
                for (let dy = 0; dy < scaleY; dy++) {
                    for (let dx = 0; dx < scaleX; dx++) {
                        const px = Math.floor(mx * scaleX + dx);
                        const py = Math.floor(my * scaleY + dy);
                        if (px < tempCanvas.width && py < tempCanvas.height) {
                            const idx = (py * tempCanvas.width + px) * 4;
                            if (pixels[idx] > 128) {
                                filled = true;
                                break;
                            }
                        }
                    }
                    if (filled) break;
                }
                mask[my][mx] = filled;
            }
        }

        const result = { width: maskCols, height: maskRows, grid: mask };
        this.maskCache.set(cacheKey, result);
        return result;
    }

    triggerShake(duration = 10, intensity = 5) {
        if (this.reducedMotion) return;
        this.shakeTimer = Math.max(this.shakeTimer, duration);
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    update() {
        this.animationTime++;
        if (this.shakeTimer > 0) this.shakeTimer--;
    }

    draw() {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;

        let sdx = 0; let sdy = 0;
        if (this.shakeTimer > 0) {
            sdx = (Math.random() - 0.5) * this.shakeIntensity;
            sdy = (Math.random() - 0.5) * this.shakeIntensity;
        }

        ctx.save();
        ctx.translate(sdx, sdy);

        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.font = `500 ${this.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
        ctx.textBaseline = 'top';

        const batches = new Map();

        // Only iterate over visible cells
        const camFloorX = Math.floor(this.camX);
        const camFloorY = Math.floor(this.camY);
        const xStart = Math.max(0, camFloorX);
        const yStart = Math.max(0, camFloorY);
        const xEnd = Math.min(this.worldCols - 1, camFloorX + this.viewCols + 1);
        const yEnd = Math.min(this.worldRows - 1, camFloorY + this.viewRows + 1);

        for (let x = xStart; x <= xEnd; x++) {
            for (let y = yStart; y <= yEnd; y++) {
                const type = this.types[x][y];

                const char = this.chars[x][y];

                // Draw a faint period '.' for any empty space, void, or missing character cell
                if (type === CELL_TYPES.PLAYER_VOID || type === CELL_TYPES.ENEMY_VOID) {
                    continue;
                }

                if (type === CELL_TYPES.UI_VOID || !char || char === ' ') {
                    const drawX = (x - this.camX) * this.cellWidth;
                    const drawY = (y - this.camY) * this.cellHeight;
                    const batchKey = 'dull_dot';
                    if (!batches.has(batchKey)) {
                        batches.set(batchKey, {
                            color: 'rgba(0, 255, 65, 0.12)',
                            shadow: 'transparent',
                            shadowBlur: 0,
                            cells: []
                        });
                    }
                    batches.get(batchKey).cells.push({ drawX, drawY, char: '.' });
                    continue;
                }

                // UI_TEXT and UI_BORDER — draw characters fixed to screen
                if (type === CELL_TYPES.UI_TEXT || type === CELL_TYPES.UI_BORDER) {
                    const drawX = (x - Math.floor(this.camX)) * this.cellWidth;
                    const drawY = (y - Math.floor(this.camY)) * this.cellHeight;
                    const batchKey = type === CELL_TYPES.UI_TEXT ? 'ui_text' : 'ui_border';
                    if (!batches.has(batchKey)) {
                        batches.set(batchKey, {
                            color: type === CELL_TYPES.UI_TEXT ? '#ffffff' : '#00ff41',
                            shadow: type === CELL_TYPES.UI_TEXT ? 'transparent' : 'rgba(0, 255, 65, 0.45)',
                            shadowBlur: type === CELL_TYPES.UI_TEXT ? 0 : 2,
                            cells: []
                        });
                    }
                    batches.get(batchKey).cells.push({ drawX, drawY, char });
                    continue;
                }

                // ENEMY_GLITCH — draw enemy chars as bright red glitches
                if (type === CELL_TYPES.ENEMY_GLITCH) {
                    const drawX = (x - this.camX) * this.cellWidth;
                    const drawY = (y - this.camY) * this.cellHeight;
                    const chosenColor = this.monochrome ? PALETTE.environment : (this.customColors[x][y] || PALETTE.enemy);
                    const batchKey = `enemy_glitch_${chosenColor}`;
                    if (!batches.has(batchKey)) {
                        batches.set(batchKey, {
                            color: chosenColor,
                            shadow: chosenColor,
                            shadowBlur: 6,
                            cells: []
                        });
                    }
                    batches.get(batchKey).cells.push({ drawX, drawY, char });
                    continue;
                }

                // ENEMY_VOID and BULLET_VOID — draw their chars as bright green entities
                if (type === CELL_TYPES.ENEMY_VOID || type === CELL_TYPES.BULLET_VOID) {
                    const ch = this.chars[x][y];
                    if (ch && ch !== ' ') {
                        const drawX = (x - this.camX + this.dispX[x][y]) * this.cellWidth;
                        const drawY = (y - this.camY + this.dispY[x][y]) * this.cellHeight;
                        const chosenColor = this.monochrome ? PALETTE.environment : (this.customColors[x][y] || PALETTE.playerShot);
                        const batchKey = `${type === CELL_TYPES.ENEMY_VOID ? 'enemy_entity' : 'bullet_entity'}_${chosenColor}`;
                        if (!batches.has(batchKey)) {
                            batches.set(batchKey, {
                                color: chosenColor,
                                shadow: chosenColor,
                                shadowBlur: type === CELL_TYPES.BULLET_VOID ? 6 : 4,
                                cells: []
                            });
                        }
                        batches.get(batchKey).cells.push({ drawX, drawY, char: ch });
                    }
                    continue;
                }
                const brt = this.brightness[x][y];

                // Offset by camera for screen position
                const drawX = (x - this.camX + this.dispX[x][y]) * this.cellWidth;
                const drawY = (y - this.camY + this.dispY[x][y]) * this.cellHeight;

                let colorKey = '';

                if (type === CELL_TYPES.GLITCH) {
                    const chosenColor = this.monochrome ? PALETTE.environment : (this.customColors[x][y] || PALETTE.environment);
                    colorKey = `glitch_${chosenColor}`;

                    if (!batches.has(colorKey)) {
                        batches.set(colorKey, {
                            color: chosenColor,
                            shadow: chosenColor,
                            shadowBlur: 8,
                            cells: []
                        });
                    }
                    batches.get(colorKey).cells.push({ drawX, drawY, char });
                } else {
                    // RAIN cell — GREEN
                    const bVal = Math.round(brt * 20) / 20;
                    colorKey = `rain_${bVal}`;

                    if (!batches.has(colorKey)) {
                        let color;
                        let shadow = null;
                        let shadowBlur = 0;

                        // Background rain cells: dark, subtle green for high contrast
                        color = `rgba(0, 255, 65, ${0.06 + bVal * 0.14})`;
                        shadow = 'transparent';
                        shadowBlur = 0;

                        batches.set(colorKey, {
                            color: color,
                            shadow: shadow,
                            shadowBlur: shadowBlur,
                            cells: []
                        });
                    }
                    batches.get(colorKey).cells.push({ drawX, drawY, char });
                }
            }
        }

        for (const [key, batch] of batches.entries()) {
            ctx.fillStyle = batch.color;
            if (batch.shadow) {
                ctx.shadowColor = batch.shadow;
                ctx.shadowBlur = batch.shadowBlur;
            } else {
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            for (const cell of batch.cells) {
                ctx.fillText(cell.char, cell.drawX, cell.drawY);
            }
        }

        ctx.restore();
    }
}

export const renderer = new GridRenderer();
export { CELL_TYPES as RENDER_CELL_TYPES };
