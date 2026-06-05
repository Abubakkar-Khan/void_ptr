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
        if (rect.width > 0 && rect.height > 0) {
            const mx = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
            const my = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
            if (!isNaN(mx) && !isNaN(my)) {
                this.mouse.x = mx;
                this.mouse.y = my;
            }
        }
    }

    tick() {
        this.prevKeys = { ...this.keys };
        this.mouse.justClicked = false;
    }

    isDown(key) { return !!this.keys[key]; }
    justPressed(key) { return !!this.keys[key] && !this.prevKeys[key]; }

    getMovementVector() {
        let dx = 0; let dy = 0;
        if (this.isDown('a')) dx -= 1;
        if (this.isDown('d')) dx += 1;
        if (this.isDown('w')) dy -= 1;
        if (this.isDown('s')) dy += 1;
        
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length;
            dy /= length;
        }
        return { x: dx, y: dy };
    }

    getShootingVector() {
        let dx = 0; let dy = 0;
        if (this.isDown('ArrowLeft')) dx -= 1;
        if (this.isDown('ArrowRight')) dx += 1;
        if (this.isDown('ArrowUp')) dy -= 1;
        if (this.isDown('ArrowDown')) dy += 1;
        
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx*dx + dy*dy);
            dx /= length;
            dy /= length;
            return { x: dx, y: dy };
        }
        return null;
    }

    isFiring() {
        return this.isDown('ArrowLeft') || this.isDown('ArrowRight') || this.isDown('ArrowUp') || this.isDown('ArrowDown');
    }

    justPressedDash() {
        return this.justPressed(' ') || this.justPressed('space');
    }
}
export const input = new InputManager();
