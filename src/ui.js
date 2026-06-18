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
    }

    updateTransition(screenName) {
        if (this.currentScreen !== screenName) {
            this.currentScreen = screenName;
            this.transitionProgress = 0.0;
            this.focusIndex = -1;
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

        const textX = x + Math.floor((w - label.length) / 2);
        const textY = y + Math.floor(h / 2);
        this.stampText(renderer, label, textX, textY, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'left', parentCc, parentCr);
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
        const panelH = compact ? Math.min(32, viewRows - 2) : 33;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        if (compact) {
            this.stampGlitchyText(renderer, 'VOID* PTR', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampText(renderer, 'MAINFRAME THREAT EVASION', cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            const buttonX = px + 3;
            const buttonW = panelW - 6;
            this.stampButton(renderer, 'select_ship_10', '10 Minute Run', buttonX, py + 6, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'Endless Mode', buttonX, py + 10, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_music', `Music: ${audio.musicEnabled ? 'ON' : 'OFF'}`, buttonX, py + 14, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_sfx', `Sounds: ${audio.sfxEnabled ? 'ON' : 'OFF'}`, buttonX, py + 18, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_fx', `Motion: ${this.reducedMotion ? 'SAFE' : 'FULL'}`, buttonX, py + 22, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_color', `Palette: ${this.colorMode ? 'COLOR' : 'MONO'}`, buttonX, py + 26, buttonW, 3, t, mx, my, cc, cr);
        } else {
            const titleX = px + Math.floor((panelW - 48) / 2);
            for (let i = 0; i < TITLE_LINES.length; i++) {
                this.stampGlitchyText(renderer, TITLE_LINES[i], titleX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            }
            const playBtnY = py + 20;
            this.stampButton(renderer, 'select_ship_10', '10 Minute Run', px + 3, playBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'Endless Mode', px + 28, playBtnY, 23, 3, t, mx, my, cc, cr);
            const optBtnY = py + 24;
            this.stampButton(renderer, 'toggle_music', `Music: ${audio.musicEnabled ? 'ON' : 'OFF'}`, px + 3, optBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_sfx', `Sounds: ${audio.sfxEnabled ? 'ON' : 'OFF'}`, px + 28, optBtnY, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_fx', `Motion: ${this.reducedMotion ? 'SAFE' : 'FULL'}`, px + 3, py + 28, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'toggle_color', `Palette: ${this.colorMode ? 'COLOR' : 'MONO'}`, px + 28, py + 28, 23, 3, t, mx, my, cc, cr);
            this.stampText(renderer, 'WASD MOVE | ARROWS FIRE | SPACE DASH | P PAUSE', cc, py + 31, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
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

        const layoutCols = viewCols >= (cards.length === 4 ? 118 : 86) ? cards.length : (viewCols >= 58 ? 2 : 1);
        const rows = Math.ceil(cards.length / layoutCols);
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
        this.stampText(renderer, "Select an upgrade module to install", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardY = py + 7;
        const startX = px + Math.floor((panelW - (layoutCols * cardW + (layoutCols - 1) * 3)) / 2);

        for (let i = 0; i < cards.length; i++) {
            const col = i % layoutCols;
            const row = Math.floor(i / layoutCols);
            const cardX = startX + col * (cardW + 3);
            const currentCardY = cardY + row * (cardH + 1);
            const cardId = `upgrade_${i}`;

            const mouseCol = Math.floor(mx / renderer.cellWidth);
            const mouseRow = Math.floor(my / renderer.cellHeight);
            const isMouseHovered = (t >= 1.0 && mouseCol >= cardX && mouseCol < cardX + cardW && mouseRow >= currentCardY && mouseRow < currentCardY + cardH);
            const isHovered = isMouseHovered || (t >= 1.0 && this.buttons.length === this.focusIndex);

            if (isMouseHovered) {
                this.hoveredItem = cardId;
            }

            this.stampCard(renderer, cardX, currentCardY, cardW, cardH, t, isHovered, cc, cr);

            const c = cards[i];
            
            // Icon
            this.stampText(renderer, c.icon, cardX + Math.floor(cardW/2), currentCardY + 1, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            
            // Title
            this.stampText(renderer, `[${c.tag}] ${c.title} L${c.level}`, cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 5 : 3), RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Description
            const wrappedDesc = this.wrapText(c.description, cardW - 4);
            for (let j = 0; j < Math.min(wrappedDesc.length, rows === 1 ? 12 : 8); j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 8 : 5) + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }

            this.buttons.push({ id: cardId, col: cardX, row: currentCardY, w: cardW, h: cardH });
        }
        if (rerolls > 0) {
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

    drawText(ctx, text, x, y, size = 20, color = '#00ff41', align = 'center') {
        ctx.font = `${size}px 'Fira Code', 'JetBrains Mono', monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
    }

    drawCrosshair(renderer, mx, my) {
        const ctx = renderer.ctx;
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 255, 65, 0.9)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(0, 255, 65, 0.2)';
        
        ctx.beginPath();
        ctx.moveTo(mx, my - 6);
        ctx.lineTo(mx - 5, my + 4);
        ctx.lineTo(mx + 5, my + 4);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    handleClicks(onActionCallback, cards = []) {
        if (!this.hoveredItem) return;
        
        if (this.hoveredItem.startsWith('upgrade_')) {
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
