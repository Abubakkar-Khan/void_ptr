class AudioManager {
    constructor() {
        const storage = typeof localStorage !== 'undefined' ? localStorage : null;
        this.ctx = null;
        this.enabled = true;
        this.musicEnabled = storage?.getItem('voidptr_music') !== 'off';
        this.sfxEnabled = storage?.getItem('voidptr_sfx') !== 'off';
        this.drone = null;
        this.noiseBuffer = null;
        this.lastHitTime = 0;
        this.lastDeathTime = 0;
        this.bgmBuffer = null;
        this.bgmSource = null;
        this.bgmGain = null;
        this.output = null;
    }

    init() {
        if (this.ctx) return;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            const compressor = this.ctx.createDynamicsCompressor();
            compressor.threshold.value = -14;
            compressor.knee.value = 12;
            compressor.ratio.value = 6;
            const master = this.ctx.createGain();
            master.gain.value = 0.82;
            compressor.connect(master);
            master.connect(this.ctx.destination);
            this.output = compressor;
            
            // Pre-allocate 1-second of white noise to avoid garbage collection/lag spikes during gameplay
            const sampleRate = this.ctx.sampleRate;
            this.noiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < sampleRate; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            this.startBackgroundDrone();
            this.loadBGM();
        } catch (e) {
            console.warn("Web Audio API not supported or blocked: ", e);
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        localStorage.setItem('voidptr_music', this.musicEnabled ? 'on' : 'off');
        if (!this.musicEnabled) {
            this.stopMusic();
            if (this.drone && this.drone.gain) {
                this.drone.gain.gain.setValueAtTime(0, this.ctx.currentTime);
            }
        } else {
            this.init();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.drone && this.drone.gain) {
                this.drone.gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            }
            this.startMusic();
        }
        return this.musicEnabled;
    }

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        localStorage.setItem('voidptr_sfx', this.sfxEnabled ? 'on' : 'off');
        return this.sfxEnabled;
    }

    // A low-frequency humming cyberpunk background drone
    startBackgroundDrone() {
        if (!this.ctx || !this.musicEnabled) return;

        try {
            const ctx = this.ctx;
            
            // Oscillator 1 (Low C fundamental)
            const osc1 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.value = 55; // 55 Hz (A1)
            
            // Oscillator 2 (Slightly detuned)
            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.value = 55.4;

            // Lowpass Filter
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 120;
            filter.Q.value = 3;

            // Gain node
            const gain = ctx.createGain();
            gain.gain.value = 0.08; // quiet background

            // Connect
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.output || ctx.destination);

            osc1.start();
            osc2.start();

            // Store references
            this.drone = { osc1, osc2, filter, gain };
            
            // Slow modulation of filter frequency to make it "breathe"
            const modulateFilter = () => {
                if (!this.drone || !this.musicEnabled || ctx.state === 'suspended') return;
                const time = ctx.currentTime;
                // Swing between 80Hz and 180Hz over 5 seconds
                filter.frequency.setValueAtTime(filter.frequency.value, time);
                filter.frequency.exponentialRampToValueAtTime(90 + Math.sin(time * 0.8) * 40, time + 2);
                setTimeout(modulateFilter, 2000);
            };
            modulateFilter();

        } catch (e) {
            console.error("Failed to start background drone", e);
        }
    }

    playShoot(type = 'bullet') {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.output || ctx.destination);

        const now = ctx.currentTime;

        if (type === 'laser' || type === 'null_laser') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
            
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'seeker_rockets' || type === 'rocket') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
            gain.gain.setValueAtTime(0.11, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
            osc.start(now);
            osc.stop(now + 0.16);
        } else if (type === 'cannon') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
            
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
            
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'wave') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);
            
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
            
            osc.start(now);
            osc.stop(now + 0.25);
        } else {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
    }

    playHit() {
        if (!this.ctx || !this.sfxEnabled || !this.noiseBuffer) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        if (now - this.lastHitTime < 0.05) return;
        this.lastHitTime = now;
        
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.output || ctx.destination);

        const offset = Math.random() * 0.9;
        noise.start(0, offset, 0.05);
    }

    playEnemyDeath() {
        if (!this.ctx || !this.sfxEnabled || !this.noiseBuffer) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        if (now - this.lastDeathTime < 0.05) return;
        this.lastDeathTime = now;
        
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.output || ctx.destination);

        const offset = Math.random() * 0.8;
        noise.start(0, offset, 0.15);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.12);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.18, now);
        oscGain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        
        osc.connect(oscGain);
        oscGain.connect(this.output || ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playPlayerDamage() {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(10, now + 0.4);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
        if (this.bgmGain) {
            this.bgmGain.gain.cancelScheduledValues(now);
            this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
            this.bgmGain.gain.linearRampToValueAtTime(0.08, now + 0.03);
            this.bgmGain.gain.linearRampToValueAtTime(0.25, now + 0.5);
        }
    }

    playUpgradeSelect() {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const playChime = (freq, delay, dur) => {
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            osc2.type = 'sine';
            osc2.frequency.value = freq * 1.5;

            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

            osc.connect(gain);
            osc2.connect(gain);
            gain.connect(this.output || ctx.destination);

            osc.start(now + delay);
            osc2.start(now + delay);
            osc.stop(now + delay + dur);
            osc2.stop(now + delay + dur);
        };

        playChime(261.63, 0.0, 0.15); // C4
        playChime(329.63, 0.08, 0.15); // E4
        playChime(392.00, 0.16, 0.15); // G4
        playChime(523.25, 0.24, 0.3); // C5
    }

    playWaveClear() {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [130.81, 164.81, 196.00, 261.63];
        
        notes.forEach((freq) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 1.2);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(this.output || ctx.destination);

            osc.start(now);
            osc.stop(now + 1.2);
        });
    }

    playDash() {
        if (!this.ctx || !this.sfxEnabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.output || ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    async loadBGM() {
        if (!this.ctx) return;
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}audio/bgm.mp3`);
            const arrayBuffer = await response.arrayBuffer();
            this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            if (this.musicEnabled) {
                this.startMusic();
            }
        } catch (e) {
            console.error("Failed to load/decode BGM file: ", e);
        }
    }

    startMusic() {
        if (!this.ctx || !this.musicEnabled || !this.bgmBuffer) return;
        if (this.bgmSource) return;

        try {
            this.bgmSource = this.ctx.createBufferSource();
            this.bgmSource.buffer = this.bgmBuffer;
            this.bgmSource.loop = true;

            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.25, this.ctx.currentTime); // 25% volume for ambient/bgm

            this.bgmSource.connect(this.bgmGain);
            this.bgmGain.connect(this.output || this.ctx.destination);
            
            this.bgmSource.start(0);
        } catch (e) {
            console.error("Failed to play BGM source: ", e);
        }
    }

    stopMusic() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
            } catch (e) {}
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
        if (this.bgmGain) {
            this.bgmGain.disconnect();
            this.bgmGain = null;
        }
    }

    playExplosion() {
        this.playShoot('cannon');
    }

    setIntensity(threatTier = 1, bossActive = false) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (this.bgmGain) {
            const target = Math.min(0.38, 0.2 + threatTier * 0.012 + (bossActive ? 0.06 : 0));
            this.bgmGain.gain.cancelScheduledValues(now);
            this.bgmGain.gain.linearRampToValueAtTime(target, now + 1.5);
        }
        if (this.drone?.filter) {
            const targetHz = Math.min(260, 100 + threatTier * 10 + (bossActive ? 50 : 0));
            this.drone.filter.frequency.linearRampToValueAtTime(targetHz, now + 1.5);
        }
    }
}

export const audio = new AudioManager();
