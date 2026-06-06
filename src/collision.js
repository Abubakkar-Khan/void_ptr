export class CollisionSystem {
    // General check that routes to the correct shape-overlap routine
    checkOverlap(boxA, boxB) {
        if (!boxA || !boxB) return false;

        if (boxA.isMultiBox) {
            return boxA.boxes.some(b => this.checkOverlap(b, boxB));
        }
        if (boxB.isMultiBox) {
            return boxB.boxes.some(b => this.checkOverlap(boxA, b));
        }

        const aCircle = boxA.isCircle;
        const bCircle = boxB.isCircle;
        const aLaser = boxA.isLaser;
        const bLaser = boxB.isLaser;

        if (aLaser) {
            return this.laserVsRect(boxA, boxB);
        }
        if (bLaser) {
            return this.laserVsRect(boxB, boxA);
        }

        if (aCircle && bCircle) {
            return this.circleVsCircle(boxA, boxB);
        } else if (aCircle && !bCircle) {
            return this.circleVsRect(boxA, boxB);
        } else if (!aCircle && bCircle) {
            return this.circleVsRect(boxB, boxA);
        } else {
            return this.rectVsRect(boxA, boxB);
        }
    }

    rectVsRect(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    circleVsCircle(c1, c2) {
        const dx = c1.cx - c2.cx;
        const dy = c1.cy - c2.cy;
        const radiusSum = c1.r + c2.r;
        return (dx * dx + dy * dy) < (radiusSum * radiusSum);
    }

    circleVsRect(circle, rect) {
        const closestX = Math.max(rect.x, Math.min(circle.cx, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.cy, rect.y + rect.height));

        const dx = circle.cx - closestX;
        const dy = circle.cy - closestY;

        return (dx * dx + dy * dy) < (circle.r * circle.r);
    }

    laserVsRect(laser, rect) {
        // Sample points along the laser beam vector to see if they intersect the box
        const steps = 70;
        for (let i = 0; i < steps; i++) {
            const lx = laser.cx + laser.vx * i;
            const ly = laser.cy + laser.vy * i;
            
            if (lx >= rect.x && lx < rect.x + rect.width && ly >= rect.y && ly < rect.y + rect.height) {
                return true;
            }
        }
        return false;
    }

    distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }
}

export const collision = new CollisionSystem();
