import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { RENDER_CELL_TYPES } from './renderer.js';

const TITLE_LINES = [
    '╭──────────────────────────────────────────────╮',
    '│                                              │',
    '│   ██╗   ██╗ ██████╗ ██╗██████╗  ██╗         │',
    '│   ██║   ██║██╔═══██╗██║██╔══██╗██╔╝         │',
    '│   ██║   ██║██║   ██║██║██║  ██║██║           │',
    '│   ╚██╗ ██╔╝██║   ██║██║██║  ██║╚██╗         │',
    '│    ╚████╔╝ ╚██████╔╝██║██████╔╝ ╚██╗        │',
    '│     ╚═══╝   ╚═════╝ ╚═╝╚═════╝   ╚═╝        │',
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

const GLYPHS = '01.:;|/\\-_';

class UIManager {
    constructor() {
        this.hoveredItem = null;
        this.colorMode = true;
        this.soundMode = true;
        
        this.currentScreen = null;
        this.transitionProgress = 0.0;
        this.buttons = [];
    }

    updateTransition(screenName) {
        if (this.currentScreen !== screenName) {
            this.currentScreen = screenName;
            this.transitionProgress = 0.0;
        }
        if (this.transitionProgress < 1.0) {
            // Animates faster during games (ship select, paused, upgrades, etc.)
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
                    char = '░';
                    type = RENDER_CELL_TYPES.UI_TEXT;
                    brightness = 0.2;
                }

                char = this.getUIChar(char, t);
                this.stampCell(renderer, mx, my, char, type, brightness);
            }
        }
    }

    stampText(renderer, text, x, y, type, t, align = 'left', parentCc, parentCr) {
        let startX = x;
        if (align === 'center') {
            startX = x - Math.floor(text.length / 2);
        } else if (align === 'right') {
            startX = x - text.length;
        }

        for (let i = 0; i < text.length; i++) {
            const targetX = startX + i;
            const targetY = y;

            const mx = Math.round(parentCc + (targetX - parentCc) * t);
            const my = Math.round(parentCr + (targetY - parentCr) * t);

            const char = this.getUIChar(text[i], t);
            this.stampCell(renderer, mx, my, char, type, 1.0);
        }
    }

    stampButton(renderer, id, label, x, y, w, h, t, mx, my, parentCc, parentCr) {
        const mouseCol = Math.floor(mx / renderer.cellWidth);
        const mouseRow = Math.floor(my / renderer.cellHeight);
        const isHovered = (t >= 1.0 && mouseCol >= x && mouseCol < x + w && mouseRow >= y && mouseRow < y + h);

        if (isHovered) {
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
                    char = '░';
                    type = RENDER_CELL_TYPES.UI_TEXT;
                    brightness = 0.25;
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

        // Smaller title panel since subtitle and description are removed
        const panelW = 54;
        const panelH = 29;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        // Stamp title lines (big banner)
        const titleX = px + Math.floor((panelW - 48) / 2);
        for (let i = 0; i < TITLE_LINES.length; i++) {
            this.stampText(renderer, TITLE_LINES[i], titleX, py + 2 + i, RENDER_CELL_TYPES.UI_TEXT, t, 'left', cc, cr);
        }

        // Buttons (shifted up)
        const playBtnY = py + 20;
        this.stampButton(renderer, 'select_ship_endless', 'Endless Mode', px + 3, playBtnY, 23, 3, t, mx, my, cc, cr);
        this.stampButton(renderer, 'select_ship_10', '10 Minute Run', px + 28, playBtnY, 23, 3, t, mx, my, cc, cr);

        const optBtnY = py + 24;
        this.stampButton(renderer, 'toggle_sound', `Sound: ${this.soundMode ? 'ON' : 'OFF'}`, px + 15, optBtnY, 24, 3, t, mx, my, cc, cr);
    }

    stampShipSelectScreen(renderer, mx, my) {
        this.updateTransition('ship_select');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const panelW = 72;
        const panelH = 30;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ CHOOSE YOUR VEHICLE ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, "Select a hull configuration to initialize", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardW = 20;
        const cardH = 18;
        const cardY = py + 7;
        const startX = px + Math.floor((panelW - (3 * cardW + 6)) / 2);

        const ships = [
            { id: 'ship_normal', title: 'Auto-Blaster', icon: '▲', desc: 'Standard fire. Upgrades: double shot, spread.' },
            { id: 'ship_seeker', title: 'Homing Pods', icon: '◈', desc: 'Fires seeker missiles that automatically target enemies.' },
            { id: 'ship_laser', title: 'Null Laser', icon: '║', desc: 'Concentrated beam of light. Pierces through targets.' }
        ];

        for (let i = 0; i < ships.length; i++) {
            const cardX = startX + i * (cardW + 3);
            const s = ships[i];

            const mouseCol = Math.floor(mx / renderer.cellWidth);
            const mouseRow = Math.floor(my / renderer.cellHeight);
            const isHovered = (t >= 1.0 && mouseCol >= cardX && mouseCol < cardX + cardW && mouseRow >= cardY && mouseRow < cardY + cardH);

            if (isHovered) {
                this.hoveredItem = s.id;
            }

            this.stampCard(renderer, cardX, cardY, cardW, cardH, t, isHovered, cc, cr);

            // Icon
            this.stampText(renderer, s.icon, cardX + Math.floor(cardW/2), cardY + 2, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            
            // Title
            this.stampText(renderer, s.title, cardX + Math.floor(cardW/2), cardY + 4, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Description
            const wrappedDesc = this.wrapText(s.desc, cardW - 4);
            for (let j = 0; j < wrappedDesc.length; j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), cardY + 7 + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }

            this.buttons.push({ id: s.id, col: cardX, row: cardY, w: cardW, h: cardH });
        }
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

    stampUpgradeScreen(renderer, mx, my, cards) {
        this.updateTransition('level_up');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const panelW = 72;
        const panelH = 30;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        this.stampText(renderer, "═ LEVEL UP ═", cc, py + 2, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
        this.stampText(renderer, "Select an upgrade module to install", cc, py + 4, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);

        const cardW = 20;
        const cardH = 20;
        const cardY = py + 7;
        const startX = px + Math.floor((panelW - (cards.length * cardW + (cards.length - 1) * 3)) / 2);

        for (let i = 0; i < cards.length; i++) {
            const cardX = startX + i * (cardW + 3);
            const cardId = `upgrade_${i}`;

            const mouseCol = Math.floor(mx / renderer.cellWidth);
            const mouseRow = Math.floor(my / renderer.cellHeight);
            const isHovered = (t >= 1.0 && mouseCol >= cardX && mouseCol < cardX + cardW && mouseRow >= cardY && mouseRow < cardY + cardH);

            if (isHovered) {
                this.hoveredItem = cardId;
            }

            this.stampCard(renderer, cardX, cardY, cardW, cardH, t, isHovered, cc, cr);

            const c = cards[i];
            
            // Icon
            this.stampText(renderer, c.icon, cardX + Math.floor(cardW/2), cardY + 2, isHovered ? RENDER_CELL_TYPES.UI_TEXT : RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            
            // Title
            this.stampText(renderer, c.title, cardX + Math.floor(cardW/2), cardY + 5, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            
            // Pretext wrapped desc
            const wrappedDesc = this.wrapText(c.description, cardW - 4);
            for (let j = 0; j < wrappedDesc.length; j++) {
                this.stampText(renderer, wrappedDesc[j], cardX + Math.floor(cardW/2), cardY + 8 + j, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }

            this.buttons.push({ id: cardId, col: cardX, row: cardY, w: cardW, h: cardH });
        }
    }

    stampGameOverScreen(renderer, mx, my, isVictory, score) {
        this.updateTransition(isVictory ? 'victory' : 'game_over');
        const t = this.transitionProgress;
        this.buttons = [];
        this.hoveredItem = null;

        const viewCols = renderer.viewCols;
        const viewRows = renderer.viewRows;

        const panelW = 42;
        const panelH = 18;
        const px = Math.floor((viewCols - panelW) / 2);
        const py = Math.floor((viewRows - panelH) / 2);

        const cc = px + Math.floor(panelW / 2);
        const cr = py + Math.floor(panelH / 2);

        this.stampPanel(renderer, px, py, panelW, panelH, t, cc, cr);

        if (isVictory) {
            this.stampText(renderer, "═ SURVIVAL ACHIEVED ═", cc, py + 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            const victoryText = "System successfully cleared all hostile autonomous threads. Memory integrity preserved.";
            const wrapped = this.wrapText(victoryText, panelW - 6);
            for (let i = 0; i < wrapped.length; i++) {
                this.stampText(renderer, wrapped[i], cc, py + 6 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
        } else {
            this.stampText(renderer, "═ SYSTEM CRASH ═", cc, py + 3, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);
            const crashText = "Fatal collision detected. Stack overflow in local buffer. Purging memory sectors...";
            const wrapped = this.wrapText(crashText, panelW - 6);
            for (let i = 0; i < wrapped.length; i++) {
                this.stampText(renderer, wrapped[i], cc, py + 6 + i, RENDER_CELL_TYPES.UI_BORDER, t, 'center', cc, cr);
            }
        }

        this.stampText(renderer, `Total XP Recovered: ${score}`, cc, py + 10, RENDER_CELL_TYPES.UI_TEXT, t, 'center', cc, cr);

        this.stampButton(renderer, 'restart', 'System Reboot', px + 9, py + 13, 24, 3, t, mx, my, cc, cr);
    }

    drawText(ctx, text, x, y, size = 20, color = '#00ff41', align = 'center') {
        ctx.font = `${size}px 'Fira Code', 'JetBrains Mono', monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 255, 65, 0.4)';
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

        if (this.hoveredItem === 'select_ship_endless') onActionCallback('select_ship_endless');
        else if (this.hoveredItem === 'select_ship_10') onActionCallback('select_ship_10');
        else if (this.hoveredItem === 'ship_normal') onActionCallback('ship_normal');
        else if (this.hoveredItem === 'ship_seeker') onActionCallback('ship_seeker');
        else if (this.hoveredItem === 'ship_laser') onActionCallback('ship_laser');
        else if (this.hoveredItem === 'restart') onActionCallback('restart');
        else if (this.hoveredItem === 'resume') onActionCallback('resume');
        else if (this.hoveredItem === 'quit') onActionCallback('quit');
        else if (this.hoveredItem === 'toggle_sound') {
            this.soundMode = !this.soundMode;
            onActionCallback('toggle_sound');
        }
        else if (this.hoveredItem === 'toggle_color') {
            this.colorMode = !this.colorMode;
            onActionCallback('toggle_color');
        }
        else if (this.hoveredItem.startsWith('upgrade_')) {
            const index = parseInt(this.hoveredItem.split('_')[1]);
            if (cards[index]) onActionCallback(cards[index].id);
        }
    }
}
export const ui = new UIManager();
