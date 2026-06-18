class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, isDown: false, justClicked: false };
        this.canvas = null;
        this.touchMove = { x: 0, y: 0 };
        this.touchShoot = { x: 0, y: 0 };
        this.touchOrigins = new Map();
        this.touchDashPressed = false;
        this.prevGamepadButtons = [];
        this.prevGamepadAxes = [0, 0, 0, 0];
    }

    getGamepad() {
        return typeof navigator !== 'undefined' ? navigator.getGamepads?.()[0] : null;
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

        const updateTouches = (event) => {
            event.preventDefault();
            this.touchMove = { x: 0, y: 0 };
            this.touchShoot = { x: 0, y: 0 };
            const rect = this.canvas.getBoundingClientRect();
            for (const touch of event.touches) {
                if (!this.touchOrigins.has(touch.identifier)) {
                    this.touchOrigins.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
                }
                const origin = this.touchOrigins.get(touch.identifier);
                const vector = { x: (touch.clientX - origin.x) / 45, y: (touch.clientY - origin.y) / 45 };
                const length = Math.hypot(vector.x, vector.y);
                if (length > 1) { vector.x /= length; vector.y /= length; }
                if (origin.x - rect.left < rect.width / 2) this.touchMove = vector;
                else this.touchShoot = vector;
            }
        };
        canvasElement.addEventListener('touchstart', (event) => {
            if (event.touches.length >= 2) this.touchDashPressed = true;
            updateTouches(event);
        }, { passive: false });
        canvasElement.addEventListener('touchmove', updateTouches, { passive: false });
        canvasElement.addEventListener('touchend', (event) => {
            const active = new Set([...event.touches].map(t => t.identifier));
            for (const id of this.touchOrigins.keys()) if (!active.has(id)) this.touchOrigins.delete(id);
            updateTouches(event);
        }, { passive: false });

        window.addEventListener('blur', () => {
            this.keys = {};
            this.prevKeys = {};
            this.mouse.isDown = false;
        });
    }

    updateMousePos(e) {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const logicalWidth = this.canvas.__logicalWidth || rect.width;
            const logicalHeight = this.canvas.__logicalHeight || rect.height;
            const mx = ((e.clientX - rect.left) / rect.width) * logicalWidth;
            const my = ((e.clientY - rect.top) / rect.height) * logicalHeight;
            if (!isNaN(mx) && !isNaN(my)) {
                this.mouse.x = mx;
                this.mouse.y = my;
            }
        }
    }

    tick() {
        this.prevKeys = { ...this.keys };
        this.mouse.justClicked = false;
        const gamepad = this.getGamepad();
        if (gamepad) {
            this.prevGamepadButtons = gamepad.buttons.map(button => button.pressed);
            this.prevGamepadAxes = [...gamepad.axes];
        }
    }

    resetTransient() {
        this.keys = {};
        this.prevKeys = {};
        this.touchMove = { x: 0, y: 0 };
        this.touchShoot = { x: 0, y: 0 };
        this.touchDashPressed = false;
        const gamepad = this.getGamepad();
        if (gamepad) this.prevGamepadButtons = gamepad.buttons.map(button => button.pressed);
    }

    isDown(key) { return !!this.keys[key]; }
    justPressed(key) { return !!this.keys[key] && !this.prevKeys[key]; }

    getMovementVector() {
        let dx = 0; let dy = 0;
        if (this.isDown('a')) dx -= 1;
        if (this.isDown('d')) dx += 1;
        if (this.isDown('w')) dy -= 1;
        if (this.isDown('s')) dy += 1;
        dx += this.touchMove.x;
        dy += this.touchMove.y;
        const gamepad = this.getGamepad();
        if (gamepad) {
            if (Math.abs(gamepad.axes[0] || 0) > 0.2) dx += gamepad.axes[0];
            if (Math.abs(gamepad.axes[1] || 0) > 0.2) dy += gamepad.axes[1];
        }
        
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
        dx += this.touchShoot.x;
        dy += this.touchShoot.y;
        const gamepad = this.getGamepad();
        if (gamepad) {
            if (Math.abs(gamepad.axes[2] || 0) > 0.25) dx += gamepad.axes[2];
            if (Math.abs(gamepad.axes[3] || 0) > 0.25) dy += gamepad.axes[3];
        }
        
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
        const gamepad = this.getGamepad();
        const touchDash = this.touchDashPressed;
        this.touchDashPressed = false;
        const gamepadDash = !!gamepad?.buttons?.[0]?.pressed && !this.prevGamepadButtons[0];
        return this.justPressed(' ') || this.justPressed('space') || gamepadDash || touchDash;
    }

    getMenuKey() {
        const gamepad = this.getGamepad();
        if (!gamepad) return null;
        const pressed = (index) => !!gamepad.buttons[index]?.pressed && !this.prevGamepadButtons[index];
        if (pressed(0)) return 'Enter';
        if (pressed(1)) return 'Escape';
        if (pressed(12) || ((gamepad.axes[1] || 0) < -0.65 && (this.prevGamepadAxes[1] || 0) >= -0.65)) return 'ArrowUp';
        if (pressed(13) || ((gamepad.axes[1] || 0) > 0.65 && (this.prevGamepadAxes[1] || 0) <= 0.65)) return 'ArrowDown';
        if (pressed(14) || ((gamepad.axes[0] || 0) < -0.65 && (this.prevGamepadAxes[0] || 0) >= -0.65)) return 'ArrowLeft';
        if (pressed(15) || ((gamepad.axes[0] || 0) > 0.65 && (this.prevGamepadAxes[0] || 0) <= 0.65)) return 'ArrowRight';
        return null;
    }

    justPressedPause() {
        const gamepad = this.getGamepad();
        return !!gamepad?.buttons?.[9]?.pressed && !this.prevGamepadButtons[9];
    }
}
export const input = new InputManager();
