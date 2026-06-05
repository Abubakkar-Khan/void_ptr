import { enemies } from './enemies.js';

class Director {
    constructor() {
        this.timeElapsed = 0; // in ticks (30 per second)
        this.modeTimeLimit = 10 * 60 * 30; // 10 minutes default
        this.inProgress = false;
        
        this.spawnTimer = 0;
        this.baseSpawnRate = 30; // spawn every 1 second initially (30 ticks)
    }

    reset(minutes = 10) {
        this.timeElapsed = 0;
        this.modeTimeLimit = minutes * 60 * 30; // 30 ticks per second
        this.inProgress = false;
        this.spawnTimer = 0;
        this.baseSpawnRate = 30;
    }

    startGame() {
        this.inProgress = true;
    }

    update(rendererInstance, worldCols, worldRows) {
        if (!this.inProgress) return;
        
        this.timeElapsed++;
        this.spawnTimer--;

        // Difficulty ramping based on time passed
        const progressRatio = this.timeElapsed / this.modeTimeLimit;
        
        // As time progresses, spawn faster
        const currentSpawnRate = Math.max(3, this.baseSpawnRate - (progressRatio * 25));

        if (this.spawnTimer <= 0) {
            this.spawnEnemy(worldCols, worldRows, progressRatio);
            this.spawnTimer = currentSpawnRate;
        }
    }

    spawnEnemy(cols, rows, progress) {
        // Spawn around the edges of the screen
        let x, y;
        const edge = Math.floor(Math.random() * 4);
        const padding = 5;
        
        if (edge === 0) { x = Math.random() * cols; y = -padding; } // Top
        else if (edge === 1) { x = Math.random() * cols; y = rows + padding; } // Bottom
        else if (edge === 2) { x = -padding; y = Math.random() * rows; } // Left
        else { x = cols + padding; y = Math.random() * rows; } // Right

        // Determine type based on progress
        let type = 'drone';
        const roll = Math.random();
        
        if (progress > 0.05) {
            if (roll < 0.25) type = 'drone';
            else if (roll < 0.50) type = 'shooter';
            else if (roll < 0.65) type = 'worm';
            else if (roll < 0.80) type = 'virus';
            else type = 'brute';
        }

        // Bullet hell cluster spawning
        const clusterSize = 1 + Math.floor(progress * 4) + (Math.random() < 0.2 ? 2 : 0);
        for (let i = 0; i < clusterSize; i++) {
            const rx = x + (Math.random() - 0.5) * 4;
            const ry = y + (Math.random() - 0.5) * 4;
            enemies.spawn(rx, ry, type);
        }
    }

    getTimeRemainingFormatted() {
        const remainingTicks = Math.max(0, this.modeTimeLimit - this.timeElapsed);
        const seconds = Math.floor((remainingTicks / 30) % 60);
        const minutes = Math.floor((remainingTicks / 30) / 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    isVictory() {
        return this.inProgress && this.timeElapsed >= this.modeTimeLimit;
    }
}

export const waves = new Director();
