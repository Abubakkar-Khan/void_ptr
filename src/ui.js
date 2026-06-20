import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { RENDER_CELL_TYPES } from './renderer.js';
import { audio } from './audio.js';
import { ENEMY_DEFS, HULL_DEFS, WEAPON_DEFS } from './config.js';
import { createBiology, renderCreatureBody } from './biology.js';

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

const REFINED_TITLE_LINES = [
    'V   V  OOO  I DDDD       *      PPPP  TTTTT RRRR ',
    'V   V O   O I D   D             P   P   T   R   R',
    ' V V  O   O I D   D      *      PPPP    T   RRRR ',
    ' V V  O   O I D   D             P       T   R R  ',
    '  V    OOO  I DDDD       *      P       T   R  RR'
];

export const ENEMY_ARCHIVE = Object.freeze([
    { type: 'drone', name: 'SKITTER', family: 'PACK SCOUT', glyphs: "' ~ -", behavior: 'Marks prey, then attacks in alternating lateral lunges.', weakness: 'Break locomotion tissue to ruin its flank rhythm.' },
    { type: 'shooter', name: 'BLOOMCASTER', family: 'SEED ARTILLERY', glyphs: '* : %', behavior: 'Shelters behind Carapaces and swells before firing seed fans.', weakness: 'Rupture the bright firing sac to cancel its volley.' },
    { type: 'worm', name: 'RIBBON', family: 'HERDING CURRENT', glyphs: '~ = .', behavior: 'Curves around escape lanes and commits to visible side sweeps.', weakness: 'Sever locomotion tissue to unthread the chain.' },
    { type: 'virus', name: 'PRISM', family: 'DIVIDING AUTOMATON', glyphs: '+ : x', behavior: 'Phase-steps, mirrors shots, and grows a second organism.', weakness: 'Attack while its division tissue is reorganizing.' },
    { type: 'brute', name: 'CARAPACE', family: 'LIVING BULWARK', glyphs: '# % ;', behavior: 'Faces armor toward fire and protects nearby Bloomcasters.', weakness: 'Circle around its plates and expose the porous core.' },
    { type: 'kamikaze', name: 'BURST SAC', family: 'VOLATILE ORGAN', glyphs: '! * :', behavior: 'Contracts into a dense core before directional rupture.', weakness: 'Knock it into a formation or destroy it from range.' },
    { type: 'shield_projector', name: 'ROOTWEAVER', family: 'TERRAIN SUPPORT', glyphs: '| : Y', behavior: 'Roots into territory and pulses protection into allies.', weakness: 'Destroy support tissue before engaging its nest.' },
    { type: 'cell_spore', name: 'SPORE', family: 'ECOSYSTEM SEED', glyphs: ". ' *", behavior: 'Wanders toward nutrients and developing colonies.', weakness: 'Fragile, but dangerous when allowed to settle.' },
    { type: 'cell_colony', name: 'COLONY CELL', family: 'CELLULAR TERRAIN', glyphs: 'o : +', behavior: 'Lives by local cellular rules and forms dense growth.', weakness: 'Dash through dense terrain before it matures.' },
    { type: 'cell_parasite', name: 'PARASITE', family: 'HOST CORRUPTION', glyphs: '~ : ^', behavior: 'Seeks wounded hosts and crawls across their visible tissue.', weakness: 'Kill it during travel or its host-escape animation.' },
    { type: 'cell_amalgam', name: 'AMALGAM', family: 'FUSED PREDATOR', glyphs: '% ~ : #', behavior: 'Inherits patterns and abilities from consumed organisms.', weakness: 'Destroy its dominant inherited organ first.' },
    { type: 'boss_snake', name: 'NULL SERPENT', family: 'BOSS // LIVING CURRENT', glyphs: '~ = : %', behavior: 'Charges, sweeps the arena, sheds spores, and migrates weak organs.', weakness: 'Follow the travelling bright tissue along its body.' },
    { type: 'boss_eye', name: 'THE WATCHER', family: 'BOSS // SENSORY COLONY', glyphs: ': o * +', behavior: 'Uses gaze lanes, iris gaps, and delayed echo-lobe volleys.', weakness: 'Ruptured sensory lobes create genuine blind sectors.' },
    { type: 'boss_carrier', name: 'HEAP CARRIER', family: 'BOSS // BROOD ECOSYSTEM', glyphs: '# % : Y', behavior: 'Alternates broods, broadsides, heartbursts, feeding, and repair.', weakness: 'Break gestation bays, then chase the relocating heart.' }
]);

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
        this.archiveBodies = new Map();
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

    measureUpgradeCard(card, width) {
        const description = this.wrapText(card.shortDescription || card.description || '', width - 4);
        const evolution = this.wrapText(card.evolutionText || '', width - 4);
        return { description, evolution, requiredHeight: 10 + description.length + evolution.length };
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

    stampLivingBand(renderer, y, left, right, tick, brightness = 0.65) {
        tick = Number.isFinite(tick) ? tick : 0;
        const glyphs = ['.', ':', 'o', '+', 'Y', '+', 'o', ':'];
        for (let x = left; x <= right; x++) {
            const wave = Math.sin(x * 0.41 + tick * 0.09) + Math.sin(x * 0.17 - tick * 0.05);
            if (wave < -0.72) continue;
            const index = Math.abs(Math.floor(x * 3 + tick / 5 + wave * 4)) % glyphs.length;
            this.stampCell(renderer, x, y + (wave > 1.25 ? -1 : wave < 0 ? 1 : 0), glyphs[index], RENDER_CELL_TYPES.UI_BORDER, brightness + Math.max(0, wave) * 0.1);
        }
    }

    stampBootScreen(renderer, bootTicks) {
        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const messages = [
            '> VOID KERNEL // GERMINATION SEQUENCE',
            '> INPUT ........ MANUAL FIRE LINKED',
            '> MEMORY ....... CELLULAR LIFE DETECTED',
            '> COLONY ....... B3/S23 MUTATION STABLE',
            '> VOID_PTR.EXE . HUNGRY // READY'
        ];

        let visibleCount = 0;
        if (bootTicks > 8) visibleCount = 1;
        if (bootTicks > 28) visibleCount = 2;
        if (bootTicks > 50) visibleCount = 3;
        if (bootTicks > 74) visibleCount = 4;
        if (bootTicks > 100) visibleCount = 5;

        const startY = Math.floor(viewRows / 2) - 7;
        const startX = Math.max(2, Math.floor(viewCols / 2) - 23);

        this.stampText(renderer, ':: SYNTHETIC BIOS INITIALIZATION ::', Math.floor(viewCols / 2), startY - 3, RENDER_CELL_TYPES.UI_TEXT, 1, 'center', startX, startY);
        this.stampLivingBand(renderer, startY - 1, Math.max(1, startX - 2), Math.min(viewCols - 2, startX + 47), bootTicks, 0.48);

        for (let i = 0; i < visibleCount; i++) {
            this.stampText(renderer, messages[i], startX, startY + i * 2, RENDER_CELL_TYPES.UI_TEXT, 1.0, 'left', startX, startY);
        }

        // Blinking terminal cursor
        const cursorBlink = Math.floor(Date.now() / 250) % 2 === 0;
        if (cursorBlink && bootTicks < 125) {
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
        const progress = Math.max(0, Math.min(24, Math.floor(bootTicks / 5.5)));
        this.stampText(renderer, `[${'='.repeat(progress)}${'.'.repeat(24 - progress)}]`, Math.floor(viewCols / 2), startY + 11, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', startX, startY);
        this.stampLivingBand(renderer, startY + 13, Math.max(1, startX - 2), Math.min(viewCols - 2, startX + 47), bootTicks + 41, 0.42);
        this.stampText(renderer, 'ANY INPUT: SKIP BIOS', Math.floor(viewCols / 2), startY + 15, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', startX, startY);
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

        const mobileLandscape = renderer.isTouchLayout && renderer.width >= renderer.height;
        const compact = !mobileLandscape && (viewCols < 58 || viewRows < 35);
        const panelW = compact ? Math.max(30, viewCols - 2) : Math.min(64, viewCols - 2);
        const panelH = compact ? Math.min(31, viewRows - 2) : Math.min(30, viewRows - 2);
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        if (compact) {
            this.stampGlitchyText(renderer, 'VOID * PTR', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampText(renderer, 'LIVING TERMINAL BIOLOGY', cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            this.stampLivingBand(renderer, py + 5, px + 2, px + panelW - 3, renderer.animationTime, 0.4);
            const buttonX = px + 3;
            const buttonW = panelW - 6;
            this.stampButton(renderer, 'select_ship_10', 'START 10-MIN RUN', buttonX, py + 7, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'ENDLESS PROCESS', buttonX, py + 11, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'bestiary', 'ORGANISM WIKI', buttonX, py + 15, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'controls', 'HOW TO PLAY', buttonX, py + 19, buttonW, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'settings', 'SETTINGS', buttonX, py + 23, buttonW, 3, t, mx, my, cc, cr);
        } else {
            const titleX = cc - Math.floor(REFINED_TITLE_LINES[0].length / 2);
            for (let i = 0; i < REFINED_TITLE_LINES.length; i++) {
                this.stampGlitchyText(renderer, REFINED_TITLE_LINES[i], titleX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            }
            this.stampLivingBand(renderer, py + 8, px + 3, px + panelW - 4, renderer.animationTime, 0.45);
            this.stampText(renderer, 'MANUAL FIRE // LIVING ENEMIES // NO SAFE BUILD', cc, py + 9, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            const leftX = px + 3;
            const rightX = px + panelW - 26;
            this.stampButton(renderer, 'select_ship_10', 'START 10-MIN RUN', leftX, py + 11, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'select_ship_endless', 'ENDLESS PROCESS', rightX, py + 11, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'bestiary', 'Organism Wiki', leftX, py + 15, 23, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'controls', 'How To Play', rightX, py + 15, 23, 3, t, mx, my, cc, cr);
            if (mobileLandscape) {
                this.stampButton(renderer, 'settings', 'Settings', leftX, py + 19, 23, 3, t, mx, my, cc, cr);
                const fullscreen = typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement);
                if (fullscreen) this.stampText(renderer, 'FULLSCREEN ACTIVE', rightX + 11, py + 20, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
                else this.stampButton(renderer, 'fullscreen', 'ENTER FULLSCREEN', rightX, py + 19, 23, 3, t, mx, my, cc, cr);
            } else {
                this.stampButton(renderer, 'settings', 'Settings', cc - 11, py + 19, 23, 3, t, mx, my, cc, cr);
            }
            this.stampText(renderer, 'WASD MOVE | HOLD AIM TO FIRE | SPACE DASH', cc, py + 24, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            this.stampLivingBand(renderer, py + 26, px + 4, px + panelW - 5, renderer.animationTime + 73, 0.32);
        }
    }

    getArchiveCreature(entry) {
        if (this.archiveBodies.has(entry.type)) return this.archiveBodies.get(entry.type);
        const def = ENEMY_DEFS[entry.type];
        const biology = createBiology(entry.type, 0xB105 + this.archiveBodies.size * 97, def.width, def.height, []);
        const creature = {
            type: entry.type,
            width: def.width,
            height: def.height,
            genome: biology.genome,
            bodyPlan: biology.bodyPlan,
            organs: biology.bodyPlan.organs,
            attackState: 'idle'
        };
        this.archiveBodies.set(entry.type, creature);
        return creature;
    }

    stampBestiaryScreen(renderer, mx, my) {
        this.updateTransition('bestiary');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;
        this.pageCount = ENEMY_ARCHIVE.length;
        this.page = (this.page + this.pageCount) % this.pageCount;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;
        const panelW = Math.min(82, Math.max(34, viewCols - 2));
        const panelH = Math.min(38, Math.max(18, viewRows - 2));
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);
        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);
        const compact = panelW < 62 || panelH < 30;
        const entry = ENEMY_ARCHIVE[this.page];
        const creature = this.getArchiveCreature(entry);
        const rows = renderCreatureBody(creature, renderer.animationTime || 0) || [':'];

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        this.stampText(renderer, 'ORGANISM WIKI // LIVING SPECIMEN ARCHIVE', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, `${String(this.page + 1).padStart(2, '0')}/${this.pageCount}  ${entry.name}`, cc, py + 4, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, `${entry.family}  //  GLYPHS ${entry.glyphs}`, cc, py + 5, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        if (compact) {
            const maxArtRows = Math.max(2, Math.min(rows.length, panelH - 16));
            for (let i = 0; i < maxArtRows; i++) this.stampText(renderer, rows[i], cc, py + 7 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            const textY = py + 8 + maxArtRows;
            const description = this.wrapText(entry.behavior, panelW - 8).slice(0, 2);
            description.forEach((line, i) => this.stampText(renderer, line, cc, textY + i, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr));
            const weakness = this.wrapText(`BREAK: ${entry.weakness}`, panelW - 8).slice(0, 2);
            weakness.forEach((line, i) => this.stampText(renderer, line, cc, textY + description.length + i, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr));
        } else {
            const dividerX = px + 31;
            for (let y = py + 7; y < py + panelH - 6; y++) this.stampCell(renderer, dividerX, y, ':', RENDER_CELL_TYPES.UI_BORDER, 0.45);
            const artCenterX = px + 16;
            const artStartY = py + 9 + Math.max(0, Math.floor((panelH - 18 - rows.length) / 2));
            rows.forEach((row, i) => this.stampText(renderer, row, artCenterX, artStartY + i, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr));
            this.stampText(renderer, 'BEHAVIOR', dividerX + 3, py + 9, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            this.wrapText(entry.behavior, panelW - 39).slice(0, 5).forEach((line, i) => this.stampText(renderer, line, dividerX + 3, py + 11 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'left', cc, cr));
            this.stampText(renderer, 'DISRUPTION', dividerX + 3, py + 18, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
            this.wrapText(entry.weakness, panelW - 39).slice(0, 5).forEach((line, i) => this.stampText(renderer, line, dividerX + 3, py + 20 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'left', cc, cr));
        }

        const buttonY = py + panelH - 4;
        this.stampButton(renderer, 'page_prev', '< PREV', px + 3, buttonY, 14, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'back', 'BACK', cc - 7, buttonY, 14, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'page_next', 'NEXT >', px + panelW - 17, buttonY, 14, 3, t, mx, my, cc, cr);
    }

    stampShipSelectScreen(renderer, mx, my) {
        this.updateTransition('ship_select');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const compact = viewCols < 88 || (renderer.isTouchLayout && viewRows < 42);
        const panelW = compact ? Math.max(38, Math.min(viewCols - 2, 56)) : 84;
        const panelH = Math.min(viewRows - 2, 36);
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ CHOOSE YOUR VEHICLE ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, "Select a hull configuration to initialize", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardW = compact ? panelW - 6 : 25;
        const cardH = compact ? Math.max(12, Math.min(18, panelH - 13)) : 22;
        const cardY = py + 6;
        const startX = compact ? px + 3 : px + Math.floor((panelW - (3 * cardW + 6)) / 2);

        // Rearranged starting cards: Seeker Left, Blaster Middle, Laser Right
        const ships = [
            { id: 'ship_seeker', title: HULL_DEFS.daemon.name, icon: '◈', desc: `${HULL_DEFS.daemon.description} ${WEAPON_DEFS.seeker_rockets.baseDamage} direct damage.` },
            { id: 'ship_normal', title: HULL_DEFS.runner.name, icon: '▲', desc: `${HULL_DEFS.runner.description} ${WEAPON_DEFS.auto_blaster.baseDamage} damage.` },
            { id: 'ship_laser', title: HULL_DEFS.cutter.name, icon: '║', desc: `${HULL_DEFS.cutter.description} ${WEAPON_DEFS.null_laser.baseDamage} piercing damage.` }
        ];
        this.pageCount = ships.length;
        if (this.page >= ships.length) this.page = 0;
        const visibleShips = compact ? [ships[this.page]] : ships;

        for (let i = 0; i < visibleShips.length; i++) {
            const cardX = compact ? startX : startX + i * (cardW + 3);
            const currentCardY = cardY;
            const s = visibleShips[i];

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
            this.stampText(renderer, s.title, cardX + Math.floor(cardW/2), currentCardY + (compact ? 3 : 4), RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Description
            const wrappedDesc = this.wrapText(s.desc, cardW - 4);
            for (let j = 0; j < wrappedDesc.length && currentCardY + (compact ? 5 : 7) + j < currentCardY + cardH - 1; j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), currentCardY + (compact ? 5 : 7) + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }

            this.buttons.push({ id: s.id, col: cardX, row: currentCardY, w: cardW, h: cardH });
        }
        if (compact) {
            this.stampButton(renderer, 'page_prev', '<', px + 3, py + panelH - 4, 7, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'back', `BACK ${this.page + 1}/${ships.length}`, cc - 6, py + panelH - 4, 12, 3, t, mx, my, cc, cr);
            this.stampButton(renderer, 'page_next', '>', px + panelW - 10, py + panelH - 4, 7, 3, t, mx, my, cc, cr);
        } else this.stampButton(renderer, 'back', 'Back [Esc]', px + Math.floor((panelW - 20) / 2), py + panelH - 4, 20, 3, t, mx, my, cc, cr);
    }

    stampPauseScreen(renderer, mx, my) {
        this.updateTransition('paused');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const panelW = 32;
        const panelH = 18;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ PAUSED ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);

        this.stampButton(renderer, 'resume', 'Resume Game', px + 4, py + 5, 24, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'controls', 'Touch Controls', px + 4, py + 9, 24, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'quit', 'Quit to Menu', px + 4, py + 13, 24, 3, t, mx, my, cc, cr);
    }

    stampSettingsScreen(renderer, mx, my) {
        this.updateTransition('settings');
        const t = this.transitionProgress;
        this.buttons = []; this.hoveredItem = null;
        const panelW = Math.min(46, renderer.viewCols - 2), panelH = Math.min(26, renderer.viewRows - 2);
        const px = Math.floor((renderer.viewCols - panelW) / 2), py = Math.floor((renderer.viewRows - panelH) / 2);
        const cc = px + Math.floor(panelW / 2), cr = py + Math.floor(panelH / 2);
        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        this.stampText(renderer, '== SETTINGS ==', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        const x = px + 4, w = panelW - 8;
        this.stampButton(renderer, 'toggle_music', `Music ${audio.musicEnabled ? 'ON' : 'OFF'}`, x, py + 5, w, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'toggle_sfx', `Sounds ${audio.sfxEnabled ? 'ON' : 'OFF'}`, x, py + 9, w, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'toggle_fx', `Motion ${this.reducedMotion ? 'SAFE' : 'FULL'}`, x, py + 13, w, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'toggle_color', `Palette ${this.colorMode ? 'COLOR' : 'MONO'}`, x, py + 17, w, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'back', 'Back', cc - 10, py + panelH - 4, 20, 3, t, mx, my, cc, cr);
    }

    stampMobileGuide(renderer, mx, my) {
        this.updateTransition('mobile_guide');
        const t = this.transitionProgress;
        this.buttons = []; this.hoveredItem = null;
        const panelW = Math.min(66, renderer.viewCols - 2), panelH = Math.min(27, renderer.viewRows - 2);
        const px = Math.floor((renderer.viewCols - panelW) / 2), py = Math.floor((renderer.viewRows - panelH) / 2);
        const cc = px + Math.floor(panelW / 2), cr = py + Math.floor(panelH / 2);
        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        const touch = renderer.isTouchLayout;
        this.stampText(renderer, touch ? '== TOUCH CONTROL GUIDE ==' : '== OPERATOR GUIDE ==', cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        const left = px + 4, right = cc + 2;
        this.stampText(renderer, 'MOVE', left + 8, py + 5, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, touch ? "   ^   " : '   W   ', left + 8, py + 7, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, touch ? '<  @  >' : ' A S D ', left + 8, py + 8, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, touch ? '   v   ' : 'LEFT STICK', left + 8, py + 9, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, touch ? 'Touch anywhere on the left' : 'WASD or gamepad left stick', left, py + 11, RENDER_CELL_TYPES.UI_BORDER, t, 'left', cc, cr);
        this.stampText(renderer, 'AIM + FIRE', right + 10, py + 5, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, touch ? "   ^   " : '  MOUSE  ', right + 10, py + 7, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, touch ? '<  *  >' : '< ARROWS >', right + 10, py + 8, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, touch ? '   v   ' : 'RIGHT STICK', right + 10, py + 9, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, touch ? 'Hold and drag on the right' : 'Hold input to fire manually', right, py + 11, RENDER_CELL_TYPES.UI_BORDER, t, 'left', cc, cr);
        this.stampText(renderer, touch ? '[ DASH ] sits beside FIRE | XP fills the bottom bar' : 'SPACE / PAD A = DASH | P / ESC = PAUSE', cc, py + 15, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, 'Upgrade cards pause combat. Tap a card to install it.', cc, py + 17, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampButton(renderer, 'guide_close', 'GOT IT', cc - 10, py + panelH - 4, 20, 3, t, mx, my, cc, cr);
    }

    stampRotateScreen(renderer) {
        this.updateTransition('rotate');
        // This is a safety/input gate, so it must be legible on its first frame.
        this.transitionProgress = 1;
        const t = 1;
        this.buttons = []; this.hoveredItem = null;
        const panelW = Math.min(42, renderer.viewCols - 4), panelH = Math.min(18, renderer.viewRows - 4);
        const px = Math.floor((renderer.viewCols - panelW) / 2), py = Math.floor((renderer.viewRows - panelH) / 2);
        const cc = px + Math.floor(panelW / 2), cr = py + Math.floor(panelH / 2);
        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        this.stampText(renderer, '== ROTATE DEVICE ==', cc, py + 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, 'LANDSCAPE MODE REQUIRED', cc, py + 6, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, 'phone  ->  [==========]', cc, py + 9, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, 'Gameplay is paused', cc, py + 12, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
    }

    stampUpgradeScreen(renderer, mx, my, cards, rerolls = 1) {
        this.updateTransition('level_up');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const paged = viewCols < 58 || viewRows < 38 || (renderer.isTouchLayout && viewRows < 42);
        this.pageCount = cards.length;
        if (this.page >= cards.length) this.page = 0;
        const displayedCards = paged ? [{ card: cards[this.page], index: this.page }] : cards.map((card, index) => ({ card, index }));
        const layoutCols = paged ? 1 : (viewCols >= (cards.length === 4 ? 118 : 86) ? cards.length : 2);
        const rows = Math.ceil(displayedCards.length / layoutCols);
        const cardW = layoutCols === 1 ? Math.max(28, Math.min(38, viewCols - 6)) : 25;
        const measurements = displayedCards.map(entry => this.measureUpgradeCard(entry.card, cardW));
        const requiredCardH = Math.max(...measurements.map(measure => measure.requiredHeight));
        const cardH = paged ? Math.max(14, Math.min(requiredCardH, viewRows - 14)) : rows === 1 ? Math.max(22, requiredCardH) : Math.max(15, requiredCardH);
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
            const wrappedDesc = measurements[i].description;
            for (let j = 0; j < wrappedDesc.length && currentCardY + (rows === 1 ? 8 : 7) + j < currentCardY + cardH - 2 - measurements[i].evolution.length; j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), currentCardY + (rows === 1 ? 8 : 7) + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
            measurements[i].evolution.forEach((line, lineIndex) => this.stampText(renderer, line, cardX + Math.floor(cardW / 2), currentCardY + cardH - 2 - measurements[i].evolution.length + lineIndex, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr));

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

    stampResultsScreen(renderer, mx, my, victory, values) {
        this.updateTransition(victory ? 'victory' : 'game_over');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;
        const time = `${Math.floor(values.survivalSeconds / 60)}:${Math.floor(values.survivalSeconds % 60).toString().padStart(2, '0')}`;
        const vw = renderer.viewCols;
        const vh = renderer.viewRows;
        const wide = vw >= 70 && vh >= 29;
        const panelW = Math.max(36, Math.min(vw - 2, wide ? 70 : 48));
        const panelH = Math.max(20, Math.min(vh - 2, wide ? 28 : 22));
        const px = Math.floor((vw - panelW) / 2);
        const py = Math.floor((vh - panelH) / 2);
        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);
        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);
        const banner = victory ? VICTORY_LINES : GAME_OVER_LINES;
        if (wide) {
            const shown = victory ? banner.slice(0, 6) : banner;
            for (let i = 0; i < shown.length; i++) this.stampGlitchyText(renderer, shown[i], cc, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        } else {
            this.stampText(renderer, victory ? '=== VICTORY ===' : '!!! GAME OVER !!!', cc, py + 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        }
        const statsRow = wide ? py + panelH - 9 : py + 8;
        this.stampText(renderer, victory ? 'FINAL ORGANISM PURGED' : 'PROCESS TERMINATED', cc, statsRow, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, `TIME ${time}   KILLS ${values.kills}   LEVEL ${(values.levelsGained || 0) + 1}`, cc, statsRow + 2, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
        this.stampText(renderer, `SCORE ${values.score}`, cc, statsRow + 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        const bw = Math.min(18, Math.floor((panelW - 7) / 2));
        this.stampButton(renderer, 'restart', 'RUN AGAIN', cc - bw - 1, py + panelH - 4, bw, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'back', 'MAIN MENU', cc + 1, py + panelH - 4, bw, 3, t, mx, my, cc, cr);
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
            this.stampText(renderer, bossLine, Math.floor(w / 2), 5, RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
        }
        const weapon = `${data.weapon}${data.heat === null ? '' : ` HEAT:${data.heat}%${data.overheated ? '!LOCK' : ''}`} | DASH:${data.dash}`;
        this.stampText(renderer, weapon, 1, data.touch ? 5 : h - 5, RENDER_CELL_TYPES.UI_TEXT, 1, 'left', 0, 0);
        if (data.controller && !data.touch) this.stampText(renderer, 'PAD: L MOVE | R AIM/FIRE | A DASH | START PAUSE', w - 2, h - 5, RENDER_CELL_TYPES.UI_BORDER, 0.75, 'right', 0, 0);
        if (data.touch) this.stampTouchControls(renderer, data.touch);
        if (data.hint) this.stampText(renderer, data.hint, Math.floor(w / 2), Math.floor(h * 0.72), RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
        if (data.debug) this.stampText(renderer, data.debug, 1, data.boss ? 5 : 3, RENDER_CELL_TYPES.UI_BORDER, 1, 'left', 0, 0);
        const xpLen = Math.max(8, w - 19);
        this.stampText(renderer, `XP ${data.xp}/${data.xpMax} [${bar(data.xp, data.xpMax, xpLen, '=', '.')}]`, Math.floor(w / 2), h - 3, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
    }

    stampTouchControls(renderer, touch) {
        const w = renderer.viewCols;
        const h = renderer.viewRows;
        const renderStick = (stick, fallbackX, label, knob) => {
            const origin = stick.origin || { x: fallbackX * renderer.cellWidth, y: (h - 8) * renderer.cellHeight };
            const current = stick.current || origin;
            const col = Math.max(4, Math.min(w - 5, Math.round(origin.x / renderer.cellWidth)));
            const row = Math.max(8, Math.min(h - 6, Math.round(origin.y / renderer.cellHeight)));
            const knobCol = Math.max(col - 4, Math.min(col + 4, Math.round(current.x / renderer.cellWidth)));
            const knobRow = Math.max(row - 2, Math.min(row + 2, Math.round(current.y / renderer.cellHeight)));
            this.stampText(renderer, '   ^   ', col, row - 2, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
            this.stampText(renderer, '<  +  >', col, row, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
            this.stampText(renderer, '   v   ', col, row + 2, RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
            this.stampText(renderer, knob, knobCol, knobRow, RENDER_CELL_TYPES.UI_TEXT, 1, 'center', 0, 0);
            this.stampText(renderer, label, col, row + 3, stick.active ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
        };
        renderStick(touch.move, 12, 'MOVE', '@');
        renderStick(touch.shoot, w - 12, 'AIM + FIRE', '*');
        const dashCol = Math.round((touch.dash.x + touch.dash.width / 2) / renderer.cellWidth);
        const dashRow = Math.round((touch.dash.y + touch.dash.height / 2) / renderer.cellHeight);
        const dashLabel = touch.dashReady ? '[ DASH ]' : touch.dashSeconds > 0 ? `[ DASH ${touch.dashSeconds} ]` : '[ LOCK ]';
        this.stampText(renderer, dashLabel, dashCol, dashRow, touch.dashReady ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, 1, 'center', 0, 0);
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
        } else if (key === 'Escape' && ['ship_select', 'settings', 'bestiary'].includes(this.currentScreen)) {
            onActionCallback('back');
        } else if (key === 'Escape' && this.currentScreen === 'mobile_guide') {
            onActionCallback('guide_close');
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
