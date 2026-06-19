export class FloatingStick {
    constructor(role) { this.role = role; this.reset(); }
    begin(touchId, x, y, radius) { this.touchId = touchId; this.origin = { x, y }; this.current = { x, y }; this.radius = radius; this.active = true; this.vector = { x: 0, y: 0 }; }
    move(x, y) {
        if (!this.active) return;
        let dx = x - this.origin.x, dy = y - this.origin.y;
        const length = Math.hypot(dx, dy);
        if (length > this.radius) { dx *= this.radius / length; dy *= this.radius / length; }
        this.current = { x: this.origin.x + dx, y: this.origin.y + dy };
        const deadzone = 0.12;
        const strength = Math.hypot(dx, dy) / Math.max(1, this.radius);
        this.vector = strength < deadzone ? { x: 0, y: 0 } : { x: dx / this.radius, y: dy / this.radius };
    }
    end(touchId) { if (this.touchId === touchId) this.reset(); }
    reset() { this.touchId = null; this.origin = null; this.current = null; this.vector = { x: 0, y: 0 }; this.radius = 48; this.active = false; }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, isDown: false, justClicked: false };
        this.canvas = null;
        this.touchMove = { x: 0, y: 0 };
        this.touchShoot = { x: 0, y: 0 };
        this.touchRoles = new Map();
        this.moveStick = new FloatingStick('move');
        this.shootStick = new FloatingStick('shoot');
        this.touchDashPressed = false;
        this.touchCapable = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || matchMedia?.('(pointer: coarse)').matches);
        const storage = typeof localStorage !== 'undefined' ? localStorage : null;
        this.mobile = { isTouch: this.touchCapable, isPortrait: false, isFullscreen: false, fullscreenAttempted: false, guideDismissed: storage?.getItem('voidptr_mobile_guide_v1') === 'done', viewportWidth: 0, viewportHeight: 0 };
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
            for (const touch of event.touches) {
                const role = this.touchRoles.get(touch.identifier);
                if (role === 'dash') continue;
                const stick = role === 'move' ? this.moveStick : this.shootStick;
                if (stick.touchId === touch.identifier) stick.move(touch.clientX, touch.clientY);
            }
            this.touchMove = { ...this.moveStick.vector };
            this.touchShoot = { ...this.shootStick.vector };
        };
        canvasElement.addEventListener('touchstart', (event) => {
            this.activateMobileDisplay();
            const rect = this.canvas.getBoundingClientRect();
            for (const touch of event.changedTouches) {
                const nx = (touch.clientX - rect.left) / Math.max(1, rect.width);
                const dash = this.getDashRect(rect);
                const inDash = touch.clientX >= dash.x && touch.clientX <= dash.x + dash.width && touch.clientY >= dash.y && touch.clientY <= dash.y + dash.height;
                const role = inDash ? 'dash' : nx < 0.5 ? 'move' : 'shoot';
                this.touchRoles.set(touch.identifier, role);
                if (role === 'dash') this.touchDashPressed = true;
                else {
                    const stick = role === 'move' ? this.moveStick : this.shootStick;
                    if (!stick.active) stick.begin(touch.identifier, touch.clientX, touch.clientY, Math.max(38, Math.min(64, rect.height * 0.17)));
                }
            }
            updateTouches(event);
        }, { passive: false });
        canvasElement.addEventListener('touchmove', updateTouches, { passive: false });
        canvasElement.addEventListener('touchend', (event) => {
            const active = new Set([...event.touches].map(t => t.identifier));
            for (const id of [...this.touchRoles.keys()]) if (!active.has(id)) { this.moveStick.end(id); this.shootStick.end(id); this.touchRoles.delete(id); }
            updateTouches(event);
        }, { passive: false });
        canvasElement.addEventListener('touchcancel', (event) => {
            for (const touch of event.changedTouches) { this.moveStick.end(touch.identifier); this.shootStick.end(touch.identifier); this.touchRoles.delete(touch.identifier); }
            this.touchMove = { ...this.moveStick.vector }; this.touchShoot = { ...this.shootStick.vector };
        }, { passive: false });

        window.addEventListener('blur', () => {
            this.keys = {};
            this.prevKeys = {};
            this.mouse.isDown = false;
        });
        window.addEventListener('orientationchange', () => this.updateMobileDisplay());
        window.visualViewport?.addEventListener('resize', () => this.updateMobileDisplay());
        document.addEventListener('fullscreenchange', () => this.updateMobileDisplay());
        this.updateMobileDisplay();
    }

    getDashRect(rect = this.canvas?.getBoundingClientRect()) {
        const width = Math.max(72, Math.min(96, (rect?.width || 720) * 0.12));
        const height = Math.max(56, Math.min(72, (rect?.height || 400) * 0.16));
        return { x: (rect?.left || 0) + (rect?.width || 720) * 0.58, y: (rect?.top || 0) + (rect?.height || 400) * 0.58, width, height };
    }

    activateMobileDisplay() {
        if (!this.touchCapable || this.mobile.fullscreenAttempted || this.mobile.isPortrait) return;
        this.mobile.fullscreenAttempted = true;
        const root = document.documentElement;
        const request = root.requestFullscreen?.({ navigationUI: 'hide' }) || root.webkitRequestFullscreen?.();
        Promise.resolve(request).catch(() => undefined).finally(() => this.updateMobileDisplay());
    }

    updateMobileDisplay() {
        if (!this.touchCapable || typeof window === 'undefined') return;
        const viewport = window.visualViewport;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        Object.assign(this.mobile, { isPortrait: height > width, isFullscreen: !!document.fullscreenElement || !!document.webkitFullscreenElement, viewportWidth: width, viewportHeight: height });
    }

    dismissMobileGuide() {
        this.mobile.guideDismissed = true;
        try { localStorage.setItem('voidptr_mobile_guide_v1', 'done'); } catch { /* optional storage */ }
    }

    getTouchPresentation() {
        const rect = this.canvas?.getBoundingClientRect();
        const localize = point => point && rect ? { x: point.x - rect.left, y: point.y - rect.top } : null;
        const dash = this.getDashRect(rect);
        return {
            move: { active: this.moveStick.active, origin: localize(this.moveStick.origin), current: localize(this.moveStick.current), vector: { ...this.moveStick.vector } },
            shoot: { active: this.shootStick.active, origin: localize(this.shootStick.origin), current: localize(this.shootStick.current), vector: { ...this.shootStick.vector } },
            dash: rect ? { x: dash.x - rect.left, y: dash.y - rect.top, width: dash.width, height: dash.height } : dash
        };
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
        this.touchRoles.clear();
        this.moveStick.reset();
        this.shootStick.reset();
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
