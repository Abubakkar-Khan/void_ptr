class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, isDown: false, justClicked: false };
        this.canvas = null;
    }

    init(canvasElement) {
        if (!canvasElement) return;
        this.canvas = canvasElement;

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.key] = true;
            if (['Space', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.key] = false;
        });

        window.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            this.mouse.justClicked = true;
            this.updateMousePos(e);
        });

        window.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
        });

        window.addEventListener('mousemove', (e) => {
            this.updateMousePos(e);
        });
    }

    updateMousePos(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
        this.mouse.y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    }

    tick() {
        this.prevKeys = { ...this.keys };
        this.mouse.justClicked = false;
    }

    isDown(key) { return !!this.keys[key]; }
    justPressed(key) { return !!this.keys[key] && !this.prevKeys[key]; }

    getMovementVector() {
        let dx = 0; let dy = 0;
        if (this.isDown('a') || this.isDown('ArrowLeft')) dx -= 1;
        if (this.isDown('d') || this.isDown('ArrowRight')) dx += 1;
        if (this.isDown('w') || this.isDown('ArrowUp')) dy -= 1;
        if (this.isDown('s') || this.isDown('ArrowDown')) dy += 1;
        
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length;
            dy /= length;
        }
        return { x: dx, y: dy };
    }

    isFiring() {
        return this.mouse.isDown;
    }

    justPressedDash() {
        return this.justPressed(' ') || this.justPressed('space');
    }
}
export const input = new InputManager();
