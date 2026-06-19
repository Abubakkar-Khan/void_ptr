import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { RENDER_CELL_TYPES } from './renderer.js';
import { audio } from './audio.js';
import { HULL_DEFS, WEAPON_DEFS } from './config.js';

const TITLE_LINES = [
    '╭──────────────────────────────────────────────╮',
    '│                                              │',
    '│   ██╗   ██╗ ██████╗ ██╗██████╗               │',
    '│   ██║   ██║██╔═══██╗██║██╔══██╗              │',
    '│   ██║   ██║██║   ██║██║██║  ██║              │',
    '│   ╚██╗ ██╔╝██║   ██║██║██║  ██║              │',
    '│    ╚████╔╝ ╚██████╔╝██║██████╔╝              │',
    '│     ╚═══╝   ╚═════╝ ╚═╝╚═════╝               │',
    '│                                              │',
    '│              ██████╗ ████████╗██████╗         │',
    '│              ██╔══██╗╚══██╔══╝██╔══██╗        │',
    '│              ██████╔╝   ██║   ██████╔╝        │',
    '│              ██╔═══╝    ██║   ██╔══██╗        │',
    '│              ██║        ██║   ██║  ██║        │',
    '│              ╚═╝        ╚═╝   ╚═╝  ╚═╝        │',
    '│                                              │',
    '╰──────────────────────────────────────────────╯'
];

const GAME_OVER_LINES = [
    '   ██████╗  █████╗ ███╗   ███╗███████╗',
    '  ██╔════╝ ██╔══██╗████╗ ████║██╔════╝',
    '  ██║  ███╗███████║██╔████╔██║█████╗  ',
    '  ██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ',
    '  ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗',
    '   ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝',
    '                                      ',
    '  ██████╗ ██╗   ██╗███████╗██████╗    ',
    ' ██╔═══██╗██║   ██║██╔════╝██╔══██╗   ',
    ' ██║   ██║██║   ██║█████╗  ██████╔╝   ',
    ' ██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ',
    ' ╚██████╔╝ ╚████╔╝ ███████╗██║  ██║   ',
    '  ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝   '
];

const VICTORY_LINES = [
    ' ██╗   ██╗██╗  ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗',
    ' ██║   ██║██║ ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝ ',
    ' ██║   ██║██║ ██║        ██║   ██║   ██║██████╔╝ ╚████╔╝  ',
    ' ╚██╗ ██╔╝██║ ██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝   ',
    '  ╚████╔╝ ██║ ╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║    ',
    '   ╚═══╝  ╚═╝  ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝    '
];

const GLYPHS = '01.:;|/\\-_';

export class UIManager {
    constructor() {
        this.hoveredItem = null;
        const storage = typeof localStorage !== 'undefined' ? localStorage : null;
        this.colorMode = storage?.getItem('voidptr_color_mode') !== 'mono';
        this.reducedMotion = storage?.getItem('voidptr_reduced_motion') === 'true';
        
        this.currentScreen = null;
        this.transitionProgress = 0.0;
        this.buttons = [];
        this.focusIndex = -1;
        this.page = 0;
        this.pageCount = 0;
    }

    updateTransition(screenName) {
        if (this.currentScreen !== screenName) {
            this.currentScreen = screenName;
            this.transitionProgress = 0.0;
            this.focusIndex = -1;
            this.page = 0;
        }
        if (this.transitionProgress < 1.0) {
            const speed = (screenName === 'menu') ? 0.07 : 0.15;
            this.transitionProgress += speed;
            if (this.transitionProgress > 1.0) {
                this.transitionProgress = 1.0;
            }
        }
    }

    wrapText(text, maxChars) {
        if (!text) return [];
        try {
            const font = "14px 'Fira Code', monospace";
            const prepared = prepareWithSegments(text, font);
            const { lines } = layoutWithLines(prepared, maxChars * 8, 14);
            return lines.map(l => l.text);
        } catch (e) {
            const words = text.split(' ');
            const lines = [];
            let current = '';
            for (const w of words) {
                if ((current + ' ' + w).length > maxChars) {
                    lines.push(current);
                    current = w;
                } else {
                    current = current ? current + ' ' + w : w;
                }
            }
            if (current) lines.push(current);
            return lines;
        }
    }

    stampCell(renderer, x, y, char, type, brightness) {
        const wx = Math.floor(renderer.camX) + x;
        const wy = Math.floor(renderer.camY) + y;
        if (wx >= 0 && wx < renderer.worldCols && wy >= 0 && wy < renderer.worldRows) {
            renderer.chars[wx][wy] = char;
            renderer.types[wx][wy] = type;
            renderer.brightness[wx][wy] = brightness;
        }
    }

    getUIChar(targetChar, t) {
        if (t < 1.0 && Math.random() > t) {
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        return targetChar;
    }

    stampPanel(renderer, px, py, w, h, t, parentCc, parentCr) {
        // Draw shadow first (shifted by 2 cells horizontally, 1 cell vertically)
        if (t >= 0.8) {
            for (let dy = 1; dy < h + 1; dy++) {
                for (let dx = 2; dx < w + 2; dx++) {
                    if (dx >= 2 && dx < w && dy >= 1 && dy < h) continue;
                    
                    const targetX = px + dx;
                    const targetY = py + dy;
                    const mx = Math.round(parentCc + (targetX - parentCc) * t);
                    const my = Math.round(parentCr + (targetY - parentCr) * t);
                    
                    this.stampCell(renderer, mx, my, '░', RENDER_CELL_TYPES.UI_BORDER, 0.15);
                }
            }
        }

        // Draw panel content
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const targetX = px + dx;
                const targetY = py + dy;

                const mx = Math.round(parentCc + (targetX - parentCc) * t);
                const my = Math.round(parentCr + (targetY - parentCr) * t);

                let isBorder = (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1);
                let char = ' ';
                let type = RENDER_CELL_TYPES.UI_VOID;
                let brightness = 1.0;

                if (isBorder) {
                    type = RENDER_CELL_TYPES.UI_BORDER;
                    if (dx === 0 && dy === 0) char = '╔';
                    else if (dx === w - 1 && dy === 0) char = '╗';
                    else if (dx === 0 && dy === h - 1) char = '╚';
                    else if (dx === w - 1 && dy === h - 1) char = '╝';
                    else if (dx === 0 || dx === w - 1) char = '║';
                    else char = '═';
                }

                char = this.getUIChar(char, t);
                this.stampCell(renderer, mx, my, char, type, brightness);
            }
        }
    }

    stampCard(renderer, px, py, w, h, t, isHovered, parentCc, parentCr) {
        // Draw card shadow first (shifted by 2 cells horizontally, 1 cell vertically)
        if (t >= 0.8) {
            for (let dy = 1; dy < h + 1; dy++) {
                for (let dx = 2; dx < w + 2; dx++) {
                    if (dx >= 2 && dx < w && dy >= 1 && dy < h) continue;
                    
                    const targetX = px + dx;
                    const targetY = py + dy;
                    const mx = Math.round(parentCc + (targetX - parentCc) * t);
                    const my = Math.round(parentCr + (targetY - parentCr) * t);
                    
                    this.stampCell(renderer, mx, my, '░', RENDER_CELL_TYPES.UI_BORDER, 0.12);
                }
            }
        }

        // Draw card content
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const targetX = px + dx;
                const targetY = py + dy;

                const mx = Math.round(parentCc + (targetX - parentCc) * t);
                const my = Math.round(parentCr + (targetY - parentCr) * t);

                let isBorder = (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1);
                let char = ' ';
                let type = RENDER_CELL_TYPES.UI_VOID;
                let brightness = 1.0;

                if (isBorder) {
                    type = RENDER_CELL_TYPES.UI_BORDER;
                    if (isHovered) {
                        if (dx === 0 && dy === 0) char = '╔';
                        else if (dx === w - 1 && dy === 0) char = '╗';
                        else if (dx === 0 && dy === h - 1) char = '╚';
                        else if (dx === w - 1 && dy === h - 1) char = '╝';
                        else if (dx === 0 || dx === w - 1) char = '║';
                        else char = '═';
                    } else {
                        if (dx === 0 && dy === 0) char = '┌';
                        else if (dx === w - 1 && dy === 0) char = '┐';
                        else if (dx === 0 && dy === h - 1) char = '└';
                        else if (dx === w - 1 && dy === h - 1) char = '┘';
                        else if (dx === 0 || dx === w - 1) char = '│';
                        else char = '─';
                    }
                } else if (isHovered) {
                    char = '·';
                    type = RENDER_CELL_TYPES.UI_BORDER;
                    brightness = 0.45;
                }

                char = this.getUIChar(char, t);
                this.stampCell(renderer, mx, my, char, type, brightness);
            }
        }
    }

    stampText(renderer, text, x, y, type, t, align = 'left', parentCc, parentCr) {
        const characters = Array.from(text);
        let startX = x;
        if (align === 'center') {
            startX = x - Math.floor(characters.length / 2);
        } else if (align === 'right') {
            startX = x - characters.length;
        }

        for (let i = 0; i < characters.length; i++) {
            const targetX = startX + i;
            const targetY = y;

            const mx = Math.round(parentCc + (targetX - parentCc) * t);
            const my = Math.round(parentCr + (targetY - parentCr) * t);

            const char = this.getUIChar(characters[i], t);
            this.stampCell(renderer, mx, my, char, type, 1.0);
        }
    }

    stampGlitchyText(renderer, text, x, y, type, t, align = 'left', parentCc, parentCr) {
        const characters = Array.from(text);
        let startX = x;
        if (align === 'center') {
            startX = x - Math.floor(characters.length / 2);
        } else if (align === 'right') {
            startX = x - characters.length;
        }

        // Creepy glitch effects
        const timeFactor = Date.now() * 0.01;
        
        // Random line-level horizontal displacement (screen glitch) - reduced glitching!
        let lineShift = 0;
        if (Math.random() < 0.02) {
            lineShift = Math.floor(Math.sin(timeFactor) * 1.0);
        }
        
        // Random character corruption rate - reduced glitching!
        const corruptionChance = 0.005 + Math.sin(timeFactor * 0.5) * 0.003;

        for (let i = 0; i < characters.length; i++) {
            const targetX = startX + i + lineShift;
            const targetY = y;

            const mx = Math.round(parentCc + (targetX - parentCc) * t);
            const my = Math.round(parentCr + (targetY - parentCr) * t);

            let char = characters[i];
            
            // Randomly corrupt the character with creepy glitch symbols
            if (t >= 1.0 && Math.random() < corruptionChance && char !== ' ' && char !== '│' && char !== '╰' && char !== '╯' && char !== '╭' && char !== '╮') {
                const GLITCH_GLYPHS = '01☠☣✖†‡§¶?*@#%&';
                char = GLITCH_GLYPHS[Math.floor(Math.random() * GLITCH_GLYPHS.length)];
            } else {
                char = this.getUIChar(char, t);
            }

            this.stampCell(renderer, mx, my, char, type, 1.0);
        }
    }

    stampBootScreen(renderer, bootTicks) {
        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        // Render boot lines step-by-step
        const messages = [
            "> INITIALIZING SYSTEM BOOT...",
            "> MOUNTING CORE STORAGE [/dev/null]... SUCCESS.",
            "> CONNECTING TO NEURAL PTR NETWORK... ERROR: HE IS WATCHING.",
            "> RE-ESTABLISHING SECURE STACK SYSTEM... FAILED.",
            "> WARNING: CORRUPTED MEMORY ADDRESS DETECTED.",
            "> FORCE INJECTING VOID_PTR.EXE... GO."
        ];

        let visibleCount = 0;
        if (bootTicks > 20) visibleCount = 1;
        if (bootTicks > 50) visibleCount = 2;
        if (bootTicks > 85) visibleCount = 3;
        if (bootTicks > 115) visibleCount = 4;
        if (bootTicks > 145) visibleCount = 5;
        if (bootTicks > 175) visibleCount = 6;

        const startY = Math.floor(viewRows / 2) - 5;
        const startX = Math.floor(viewCols / 2) - 30;

        for (let i = 0; i < visibleCount; i++) {
            this.stampText(renderer, messages[i], startX, startY + i * 2, RENDER_CELL_TYPES.UI_TEXT, 1.0, 'left', startX, startY);
        }

        // Blinking terminal cursor
        const cursorBlink = Math.floor(Date.now() / 250) % 2 === 0;
        if (cursorBlink && bootTicks < 180) {
            let cursorX = startX;
            let cursorY = startY;
            if (visibleCount > 0 && visibleCount <= messages.length) {
                cursorX = startX + messages[visibleCount - 1].length;
                cursorY = startY + (visibleCount - 1) * 2;
            }
            if (cursorX >= 0 && cursorX < viewCols && cursorY >= 0 && cursorY < viewRows) {
                renderer.types[cursorX][cursorY] = RENDER_CELL_TYPES.UI_TEXT;
                renderer.chars[cursorX][cursorY] = '█';
                renderer.brightness[cursorX][cursorY] = 1.0;
            }
        }
    }

    stampButton(renderer, id, label, x, y, w, h, t, mx, my, parentCc, parentCr) {
        const mouseCol = Math.floor(mx / renderer.cellWidth);
        const mouseRow = Math.floor(my / renderer.cellHeight);
        const isMouseHovered = (t >= 1.0 && mouseCol >= x && mouseCol < x + w && mouseRow >= y && mouseRow < y + h);
        const isHovered = isMouseHovered || (t >= 1.0 && this.buttons.length === this.focusIndex);

        if (isMouseHovered) {
            this.hoveredItem = id;
        }

        this.buttons.push({ id, col: x, row: y, w, h });

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const targetX = x + dx;
                const targetY = y + dy;

                const bx = Math.round(parentCc + (targetX - parentCc) * t);
                const by = Math.round(parentCr + (targetY - parentCr) * t);

                let isBorder = (dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1);
                let char = ' ';
                let type = RENDER_CELL_TYPES.UI_VOID;
                let brightness = 1.0;

                if (isBorder) {
                    type = RENDER_CELL_TYPES.UI_BORDER;
                    if (isHovered) {
                        if (dx === 0 && dy === 0) char = '╔';
                        else if (dx === w - 1 && dy === 0) char = '╗';
                        else if (dx === 0 && dy === h - 1) char = '╚';
                        else if (dx === w - 1 && dy === h - 1) char = '╝';
                        else if (dx === 0 || dx === w - 1) char = '║';
                        else char = '═';
                    } else {
                        if (dx === 0 && dy === 0) char = '┌';
                        else if (dx === w - 1 && dy === 0) char = '┐';
                        else if (dx === 0 && dy === h - 1) char = '└';
                        else if (dx === w - 1 && dy === h - 1) char = '┘';
                        else if (dx === 0 || dx === w - 1) char = '│';
                        else char = '─';
                    }
                } else if (isHovered) {
                    char = ' ';
                    type = RENDER_CELL_TYPES.UI_BORDER;
                    brightness = 0.6;
                }

                char = this.getUIChar(char, t);
                this.stampCell(renderer, bx, by, char, type, brightness);
            }
        }

        const displayLabel = isHovered && label.length + 4 <= w - 2 ? `> ${label} <` : label;
        const textX = x + Math.floor((w - displayLabel.length) / 2);
        const textY = y + Math.floor(h / 2);
        this.stampText(renderer, displayLabel, textX, textY, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'left', parentCc, parentCr);
    }

    stampTitleScreen(renderer, mx, my) {
        this.updateTransition('menu');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const compact = viewCols < 58 || viewRows < 35;
        const panelW = compact ? Math.max(30, viewCols - 2) : 54;
        const panelH = compact ? Math.min(36, viewRows - 2) : 38;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        if (compact) {
            const short = viewRows < 35;
            this.stampGlitchyText(renderer, 'VOID* PTR', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampText(renderer, 'MAINFRAME THREAT EVASION', cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            const buttonX = px + 3;
            const buttonW = panelW - 6;
            this.stampButton(renderer, 'select_ship_10', '10 Minute Run', buttonX, py + 6, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'Endless Mode', buttonX, py + 10, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'records', 'Lifetime Records', buttonX, py + 14, buttonW, 3, t, mx, my, cc, cr);
            if (short) {
                const optionW = Math.floor((buttonW - 1) / 2);
                this.stampButton(renderer, 'toggle_music', `Music ${audio.musicEnabled ? 'ON' : 'OFF'}`, buttonX, py + 18, optionW, 3, t, mx, my, cc, cr);
                this.stampButton(renderer, 'toggle_sfx', `SFX ${audio.sfxEnabled ? 'ON' : 'OFF'}`, buttonX + optionW + 1, py + 18, optionW, 3, t, mx, my, cc, cr);
            } else {
                this.stampButton(renderer, 'toggle_music', `Music: ${audio.musicEnabled ? 'ON' : 'OFF'}`, buttonX, py + 18, buttonW, 3, t, mx, my, cc, cr);
                this.stampButton(renderer, 'toggle_sfx', `Sounds: ${audio.sfxEnabled ? 'ON' : 'OFF'}`, buttonX, py + 22, buttonW, 3, t, mx, my, cc, cr);
                this.stampButton(renderer, 'toggle_fx', `Motion: ${this.reducedMotion ? 'SAFE' : 'FULL'}`, buttonX, py + 26, buttonW, 3, t, mx, my, cc, cr);
                this.stampButton(renderer, 'toggle_color', `Palette: ${this.colorMode ? 'COLOR' : 'MONO'}`, buttonX, py + 30, buttonW, 3, t, mx, my, cc, cr);
            }
        } else {
            const titleX = px + Math.floor((panelW - 48) / 2);
            for (let i = 0; i < TITLE_LINES.length; i++) {
                this.stampGlitchyText(renderer, TITLE_LINES[i], titleX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            }
            const playBtnY = py + 19;
            this.stampButton(renderer, 'select_ship_10', '10 Minute Run', px + 3, playBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'Endless Mode', px + 28, playBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'records', 'Lifetime Records', px + 15, py + 23, 24, 3, t, mx, my, cc, cr);
            const optBtnY = py + 27;
            this.stampButton(renderer, 'toggle_music', `Music: ${audio.musicEnabled ? 'ON' : 'OFF'}`, px + 3, optBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_sfx', `Sounds: ${audio.sfxEnabled ? 'ON' : 'OFF'}`, px + 28, optBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_fx', `Motion: ${this.reducedMotion ? 'SAFE' : 'FULL'}`, px + 3, py + 31, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_color', `Palette: ${this.colorMode ? 'COLOR' : 'MONO'}`, px + 28, py + 31, 23, 3, t, mx, my, cc, cr);
            this.stampText(renderer, 'WASD MOVE | ARROWS FIRE | SPACE DASH | P PAUSE', cc, py + 35, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        }
    }

    stampShipSelectScreen(renderer, mx, my) {
        this.updateTransition('ship_select');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const compact = viewCols < 88;
        const panelW = compact ? Math.max(38, Math.min(viewCols - 2, 52)) : 84;
        const panelH = compact ? Math.min(viewRows - 2, 36) : 36;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ CHOOSE YOUR VEHICLE ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, "Select a hull configuration to initialize", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardW = compact ? panelW - 6 : 25;
        const cardH = compact ? 8 : 22;
        const cardY = py + 7;
        const startX = compact ? px + 3 : px + Math.floor((panelW - (3 * cardW + 6)) / 2);

        // Rearranged starting cards: Seeker Left, Blaster Middle, Laser Right
        const ships = [
            { id: 'ship_seeker', title: HULL_DEFS.daemon.name, icon: '◈', desc: `${HULL_DEFS.daemon.description} ${WEAPON_DEFS.seeker_rockets.baseDamage} direct damage.` },
            { id: 'ship_normal', title: HULL_DEFS.runner.name, icon: '▲', desc: `${HULL_DEFS.runner.description} ${WEAPON_DEFS.auto_blaster.baseDamage} damage.` },
            { id: 'ship_laser', title: HULL_DEFS.cutter.name, icon: '║', desc: `${HULL_DEFS.cutter.description} ${WEAPON_DEFS.null_laser.baseDamage} piercing damage.` }
        ];

        for (let i = 0; i < ships.length; i++) {
            const cardX = compact ? startX : startX + i * (cardW + 3);
            const currentCardY = compact ? cardY + i * (cardH + 1) : cardY;
            const s = ships[i];

            const mouseCol = Math.floor(mx / renderer.cellWidth);
            const mouseRow = Math.floor(my / renderer.cellHeight);
            const isMouseHovered = (t >= 1.0 && mouseCol >= cardX && mouseCol < cardX + cardW && mouseRow >= currentCardY && mouseRow < currentCardY + cardH);
            const isHovered = isMouseHovered || (t >= 1.0 && this.buttons.length === this.focusIndex);

            if (isMouseHovered) {
                this.hoveredItem = s.id;
            }

            this.stampCard(renderer, cardX, currentCardY, cardW, cardH, t, isHovered, cc, cr);

            // Icon
            this.stampText(renderer, s.icon, cardX + Math.floor(cardW/2), currentCardY + 1, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            
            // Title
            this.stampText(renderer, s.title, cardX + Math.floor(cardW/2), currentCardY + (compact ? 2 : 4), RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Description
            const wrappedDesc = this.wrapText(s.desc, cardW - 4);
            for (let j = 0; j < Math.min(wrappedDesc.length, compact ? 3 : 12); j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), currentCardY + (compact ? 4 : 7) + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }

            this.buttons.push({ id: s.id, col: cardX, row: currentCardY, w: cardW, h: cardH });
        }
        this.stampButton(renderer, 'back', 'Back [Esc]', px + Math.floor((panelW - 20) / 2), py + panelH - 4, 20, 3, t, mx, my, cc, cr);
    }

    stampPauseScreen(renderer, mx, my) {
        this.updateTransition('paused');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const panelW = 32;
        const panelH = 14;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ PAUSED ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);

        this.stampButton(renderer, 'resume', 'Resume Game', px + 4, py + 5, 24, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'quit', 'Quit to Menu', px + 4, py + 9, 24, 3, t, mx, my, cc, cr);
    }

    stampUpgradeScreen(renderer, mx, my, cards, rerolls = 1) {
        this.updateTransition('level_up');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const paged = viewCols < 58;
        this.pageCount = cards.length;
        if (this.page >= cards.length) this.page = 0;
        const displayedCards = paged ? [{ card: cards[this.page], index: this.page }] : cards.map((card, index) => ({ card, index }));
        const layoutCols = paged ? 1 : (viewCols >= (cards.length === 4 ? 118 : 86) ? cards.length : 2);
        const rows = Math.ceil(displayedCards.length / layoutCols);
        const cardW = layoutCols === 1 ? Math.max(28, Math.min(38, viewCols - 6)) : 25;
        const cardH = rows === 1 ? 22 : 15;
        const panelW = Math.min(viewCols - 2, layoutCols * cardW + (layoutCols - 1) * 3 + 6);
        const panelH = Math.min(viewRows - 2, 12 + rows * (cardH + 1));
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ LEVEL UP ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, paged ? `Select module [${this.page + 1}/${cards.length}]` : "Select an upgrade module to install", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardY = py + 7;
        const startX = px + Math.floor((panelW - (layoutCols * cardW + (layoutCols - 1) * 3)) / 2);

        for (let i = 0; i < displayedCards.length; i++) {
            const col = i % layoutCols;
            const row = Math.floor(i / layoutCols);
            const cardX = startX + col * (cardW + 3);
            const currentCardY = cardY + row * (cardH + 1);
            const cardId = `upgrade_${displayedCards[i].index}`;

            const mouseCol = Math.floor(mx / renderer.cellWidth);
            const mouseRow = Math.floor(my / renderer.cellHeight);
            const isMouseHovered = (t >= 1.0 && mouseCol >= cardX && mouseCol < cardX + cardW && mouseRow >= currentCardY && mouseRow < currentCardY + cardH);
            const isHovered = isMouseHovered || (t >= 1.0 && this.buttons.length === this.focusIndex);

            if (isMouseHovered) {
                this.hoveredItem = cardId;
            }

            this.stampCard(renderer, cardX, currentCardY, cardW, cardH, t, isHovered, cc, cr);

            const c = displayedCards[i].card;
            
            // Icon
            this.stampText(renderer, c.icon, cardX + Math.floor(cardW/2), currentCardY + 1, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            
            // Title
            this.stampText(renderer, `[${c.tag}] ${c.title} L${c.level}`, cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 4 : 3), RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);

            const values = `${c.currentValue || '-'} -> ${c.nextValue || '-'}`;
            this.stampText(renderer, values, cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 6 : 5), RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Description
            const wrappedDesc = this.wrapText(c.shortDescription || c.description, cardW - 4);
            for (let j = 0; j < Math.min(wrappedDesc.length, rows === 1 ? 7 : 3); j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 8 : 7) + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
            if (c.evolutionText && rows === 1) this.stampText(renderer, c.evolutionText, cardX + Math.floor(cardW/2), currentCardY + cardH - 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);

            this.buttons.push({ id: cardId, col: cardX, row: currentCardY, w: cardW, h: cardH });
        }
        if (paged) {
            this.stampButton(renderer, 'page_prev', '<', px + 3, py + panelH - 4, 7, 3, t, mx, my, cc, cr);
            if (rerolls > 0) this.stampButton(renderer, 'reroll_upgrades', `REROLL ${rerolls}`, cc - 8, py + panelH - 4, 16, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'page_next', '>', px + panelW - 10, py + panelH - 4, 7, 3, t, mx, my, cc, cr);
        } else if (rerolls > 0) {
            this.stampButton(renderer, 'reroll_upgrades', `REROLL [${rerolls}]`, cc - 10, py + panelH - 4, 20, 3, t, mx, my, cc, cr);
        }
    }

    stampGameOverScreen(renderer, mx, my, isVictory, score, summary = '') {
        this.updateTransition(isVictory ? 'victory' : 'game_over');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        // Expanded screen width to fit the beautiful block ASCII banners
        const panelW = 64;
        const panelH = 26;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        if (isVictory) {
            // Draw victory block ASCII art
            const victoryX = px + Math.floor((panelW - 57) / 2);
            for (let i = 0; i < VICTORY_LINES.length; i++) {
                this.stampGlitchyText(renderer, VICTORY_LINES[i], victoryX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            }
            
            const victoryText = "System successfully cleared all hostile autonomous threads. Memory integrity preserved.";
            const wrapped = this.wrapText(victoryText, panelW - 8);
            for (let i = 0; i < wrapped.length; i++) {
                this.stampText(renderer, wrapped[i], cc, py + 9 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
            
            this.stampText(renderer, `Execution Score: ${score}`, cc, py + 13, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampText(renderer, summary, cc, py + 14, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            this.stampButton(renderer, 'restart', 'System Reboot', px + Math.floor((panelW - 24) / 2), py + 16, 24, 3, t, mx, my, cc, cr);
        } else {
            // Draw game over block ASCII art
            const gameOverX = px + Math.floor((panelW - 42) / 2);
            for (let i = 0; i < GAME_OVER_LINES.length; i++) {
                this.stampGlitchyText(renderer, GAME_OVER_LINES[i], gameOverX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            }

            const crashText = "Fatal collision detected. Stack overflow in local buffer. Purging memory sectors...";
            const wrapped = this.wrapText(crashText, panelW - 8);
            for (let i = 0; i < wrapped.length; i++) {
                this.stampText(renderer, wrapped[i], cc, py + 16 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
            
            this.stampText(renderer, `Execution Score: ${score}`, cc, py + 19, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampText(renderer, summary, cc, py + 20, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            this.stampButton(renderer, 'restart', 'System Reboot', px + Math.floor((panelW - 24) / 2), py + 22, 24, 3, t, mx, my, cc, cr);
        }
    }

    stampDataScreen(renderer, mx, my, screenName, title, subtitle, sections, resultActions = false) {
        this.updateTransition(screenName);
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;
        const vw = renderer.viewCols;
        const vh = renderer.viewRows;
        const panelW = Math.max(36, Math.min(vw - 2, 92));
        const columns = panelW >= 72 ? 2 : 1;
        const buckets = Array.from({ length: columns }, () => []);
        sections.forEach((section, index) => buckets[index % columns].push(section));
        const requiredRows = Math.max(...buckets.map(bucket => bucket.reduce((sum, section) => sum + section.rows.length + 2, 0)));
        const panelH = Math.max(18, Math.min(vh - 2, requiredRows + 10));
        const px = Math.floor((vw - panelW) / 2);
        const py = Math.floor((vh - panelH) / 2);
        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);
        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        this.stampText(renderer, `== ${title} ==`, cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, subtitle, cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        const colW = Math.floor((panelW - 6) / columns);
        buckets.forEach((bucket, column) => {
            let row = py + 6;
            const left = px + 3 + column * colW;
            for (const section of bucket) {
                this.stampText(renderer, `[${section.title}]`, left, row++, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
                for (const [label, value] of section.rows) {
                    if (row >= py + panelH - 5) break;
                    const valueText = String(value ?? 0);
                    const line = `${label}`.padEnd(Math.max(4, colW - valueText.length - 1), '.') + valueText;
                    this.stampText(renderer, line.slice(0, colW - 1), left, row++, RENDER_CELL_TYPES.UI_BORDER, t, 'left', cc, cr);
                }
                row++;
            }
        });
        if (resultActions) {
            const bw = Math.min(20, Math.floor((panelW - 8) / 2));
            this.stampButton(renderer, 'restart', 'Run Again', cc - bw - 1, py + panelH - 4, bw, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'back', 'Main Menu', cc + 1, py + panelH - 4, bw, 3, t, mx, my, cc, cr);
        } else {
            this.stampButton(renderer, 'back', 'Back [Esc]', cc - 10, py + panelH - 4, 20, 3, t, mx, my, cc, cr);
        }
    }

    stampRecordsScreen(renderer, mx, my, lifetime) {
        const time = Math.floor((lifetime.totalPlaytime || 0) / 60);
        this.stampDataScreen(renderer, mx, my, 'records', 'LIFETIME RECORDS', 'LOCAL ARCHIVE // voidptr_stats_v1', [
            { title: 'TOTALS', rows: [['Runs', lifetime.runs], ['Wins', lifetime.wins], ['Kills', lifetime.totalKills], ['Bosses', lifetime.bossesDefeated], ['Damage', lifetime.totalDamage], ['Playtime', `${time}m`]] },
            { title: 'RECORDS', rows: [['High score', lifetime.highestScore], ['Best level', lifetime.highestLevel], ['Longest', `${Math.floor((lifetime.longestSurvival || 0) / 60)}m`], ['Max combo', lifetime.largestCombo]] },
            { title: 'HULL BESTS', rows: [['Runner', lifetime.perHullBest?.runner || 0], ['Daemon', lifetime.perHullBest?.daemon || 0], ['Cutter', lifetime.perHullBest?.cutter || 0]] }
        ]);
    }

    stampResultsScreen(renderer, mx, my, victory, values) {
        const time = `${Math.floor(values.survivalSeconds / 60)}:${Math.floor(values.survivalSeconds % 60).toString().padStart(2, '0')}`;
        this.stampDataScreen(renderer, mx, my, victory ? 'victory' : 'game_over', victory ? 'PROCESS SURVIVED' : 'PROCESS TERMINATED', victory ? 'FINAL THREAT PURGED' : 'RECOMPILE // ADAPT // RETURN', [
            { title: 'COMBAT', rows: [['Kills', values.kills], ['Bosses', values.bossKills], ['Dealt', values.damageDealt], ['Taken', values.damageTaken], ['Shots/hits', `${values.shotsFired}/${values.hitEvents}`], ['Combo', values.maxCombo]] },
            { title: 'PROGRESSION', rows: [['XP', values.xpCollected], ['Levels', values.levelsGained], ['Upgrades', values.upgradesSelected?.length || 0], ['Score', values.score]] },
            { title: 'MOVEMENT', rows: [['Dashes', values.dashes], ['Distance', `${values.distanceTravelled}`], ['Survival', time]] },
            { title: 'ECOSYSTEM', rows: [['Colonies', values.coloniesDestroyed], ['Parasites', values.parasitesRemoved], ['Amalgams', values.amalgamsKilled]] }
        ], true);
    }

    stampHUD(renderer, data) {
        const w = renderer.viewCols;
        const h = renderer.viewRows;
        const bar = (value, max, length, full = '#', empty = '.') => full.repeat(Math.max(0, Math.min(length, Math.round(length * value / Math.max(1, max))))) + empty.repeat(Math.max(0, length - Math.round(length * value / Math.max(1, max))));
        const hpLen = Math.max(8, Math.min(18, Math.floor(w / 5)));
        const hp = `HP[${bar(data.hp, data.maxHp, hpLen)}] ${Math.ceil(data.hp)}/${data.maxHp}`;
        this.stampText(renderer, hp, 1, 1, RENDER_CELL_TYPES.UI_TEXT, 1, 'left', 0, 0);
        this.stampText(renderer, data.timer, Math.floor(w / 2), 1, RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
        this.stampText(renderer, `LV${data.level} ${data.threat}`, w - 2, 1, RENDER_CELL_TYPES.UI_TEXT, 1, 'right', 0, 0);
        if (data.boss) {
            const names = { boss_snake: 'NULL SERPENT', boss_eye: 'THE WATCHER', boss_carrier: 'HEAP CARRIER' };
            const bossLen = Math.max(12, Math.min(42, w - 34));
            const bossLine = `${names[data.boss.type] || 'BOSS'} P${data.boss.phase} [${bar(data.boss.hp, data.boss.maxHp, bossLen, '=', '.')}]`;
            this.stampText(renderer, bossLine, Math.floor(w / 2), 3, RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
        }
        const weapon = `${data.weapon}${data.heat === null ? '' : ` HEAT:${data.heat}%${data.overheated ? '!LOCK' : ''}`} | DASH:${data.dash}`;
        this.stampText(renderer, weapon, 1, h - 3, RENDER_CELL_TYPES.UI_TEXT, 1, 'left', 0, 0);
        const xpLen = Math.max(12, w - 12);
        this.stampText(renderer, `XP[${bar(data.xp, data.xpMax, xpLen, '=', '.')}]`, Math.floor(w / 2), h - 1, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
        if (data.hint) this.stampText(renderer, data.hint, Math.floor(w / 2), Math.floor(h * 0.72), RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
        if (data.debug) this.stampText(renderer, data.debug, 1, data.boss ? 5 : 3, RENDER_CELL_TYPES.UI_BORDER, 1, 'left', 0, 0);
    }

    drawText(ctx, text, x, y, size = 20, color = '#00ff41', align = 'center') {
        ctx.font = `500 ${size}px 'JetBrains Mono', Consolas, monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
    }

    drawCrosshair(renderer, mx, my) {
        const ctx = renderer.ctx;
        if (!ctx) return;
        ctx.save();
        ctx.fillStyle = '#00ff41';
        ctx.font = `500 ${renderer.cellHeight}px 'JetBrains Mono', Consolas, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 255, 65, 0.9)';
        ctx.shadowBlur = 3;
        ctx.fillText('+', Math.floor(mx / renderer.cellWidth) * renderer.cellWidth, Math.floor(my / renderer.cellHeight) * renderer.cellHeight);
        ctx.restore();
    }

    handleClicks(onActionCallback, cards = []) {
        if (!this.hoveredItem) return;
        if (this.hoveredItem === 'page_prev' || this.hoveredItem === 'page_next') {
            const direction = this.hoveredItem === 'page_next' ? 1 : -1;
            this.page = (this.page + direction + this.pageCount) % this.pageCount;
            this.focusIndex = -1;
            this.hoveredItem = null;
        } else if (this.hoveredItem.startsWith('upgrade_')) {
            const index = parseInt(this.hoveredItem.split('_')[1]);
            if (cards[index]) {
                onActionCallback(cards[index].id);
            }
        } else {
            onActionCallback(this.hoveredItem);
        }
    }

    handlePointer(mx, my, renderer, onActionCallback, cards = []) {
        const col = Math.floor(mx / renderer.cellWidth);
        const row = Math.floor(my / renderer.cellHeight);
        const target = this.buttons.find(button => col >= button.col && col < button.col + button.w && row >= button.row && row < button.row + button.h);
        if (!target) return;
        this.hoveredItem = target.id;
        this.handleClicks(onActionCallback, cards);
    }

    handleKeyPress(key, onActionCallback, cards = []) {
        if (!this.buttons.length) return;
        if (key === 'ArrowRight' || key === 'ArrowDown' || key.toLowerCase() === 'd' || key.toLowerCase() === 's') {
            this.focusIndex = this.focusIndex < 0 ? 0 : (this.focusIndex + 1) % this.buttons.length;
            this.hoveredItem = null;
        } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key.toLowerCase() === 'a' || key.toLowerCase() === 'w') {
            this.focusIndex = this.focusIndex < 0 ? this.buttons.length - 1 : (this.focusIndex - 1 + this.buttons.length) % this.buttons.length;
            this.hoveredItem = null;
        } else if (key === 'Enter' || key === ' ') {
            this.hoveredItem = this.buttons[this.focusIndex]?.id || null;
            this.handleClicks(onActionCallback, cards);
        } else if (key === 'Escape' && this.currentScreen === 'ship_select') {
            onActionCallback('back');
        }
    }

    toggleReducedMotion() {
        this.reducedMotion = !this.reducedMotion;
        if (typeof localStorage !== 'undefined') localStorage.setItem('voidptr_reduced_motion', String(this.reducedMotion));
        document.body.classList.toggle('reduced-motion', this.reducedMotion);
    }

    toggleColorMode() {
        this.colorMode = !this.colorMode;
        if (typeof localStorage !== 'undefined') localStorage.setItem('voidptr_color_mode', this.colorMode ? 'color' : 'mono');
    }
}

export const ui = new UIManager();
