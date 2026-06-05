import { enemies } from './enemies.js';
import { effects } from './effects.js';

class Director {
    constructor() {
        this.timeElapsed = 0; // in ticks (60 per second)
        this.modeTimeLimit = 10 * 60 * 60; // 10 minutes default
        this.inProgress = false;
        
        this.spawnTimer = 0;
        this.baseSpawnRate = 60; // spawn every 1 second initially (60 ticks)
    }

    reset(minutes = 10) {
        this.timeElapsed = 0;
        this.modeTimeLimit = minutes * 60 * 60; // 60 ticks per second
        this.inProgress = false;
        this.spawnTimer = 0;
        this.baseSpawnRate = 60;
    }

    startGame() {
        this.inProgress = true;
    }

    update(rendererInstance, worldCols, worldRows) {
        if (!this.inProgress) return;
        
        this.timeElapsed++;
        this.spawnTimer--;

        // Periodically spawn boss (boss_snake at 1.5-min intervals, eye + carrier at 3-min marks)
        if (this.timeElapsed > 0) {
            if (this.timeElapsed % 10800 === 0) {
                // 3, 6, 9 mins
                this.spawnBoss(worldCols, worldRows, 'boss_eye');
                this.spawnBoss(worldCols, worldRows, 'boss_carrier');
            } else if ((this.timeElapsed - 5400) % 10800 === 0) {
                // 1.5, 4.5, 7.5 mins
                this.spawnBoss(worldCols, worldRows, 'boss_snake');
            }
        }

        // Difficulty ramping based on time passed
        const progressRatio = this.timeElapsed / this.modeTimeLimit;
        
        // As time progresses, spawn faster
        const currentSpawnRate = Math.max(6, this.baseSpawnRate - (progressRatio * 50));

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

    spawnBoss(cols, rows, type = 'boss_snake') {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        const padding = 10;
        if (edge === 0) { x = cols / 2; y = -padding; }
        else if (edge === 1) { x = cols / 2; y = rows + padding; }
        else if (edge === 2) { x = -padding; y = rows / 2; }
        else { x = cols + padding; y = rows / 2; }
        
        enemies.spawn(x, y, type);
        effects.triggerFlash();
    }

    getTimeRemainingFormatted() {
        const remainingTicks = Math.max(0, this.modeTimeLimit - this.timeElapsed);
        const seconds = Math.floor((remainingTicks / 60) % 60);
        const minutes = Math.floor((remainingTicks / 60) / 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    isVictory() {
        return this.inProgress && this.timeElapsed >= this.modeTimeLimit;
    }
}

export const waves = new Director();
