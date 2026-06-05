class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.drone = null;
        this.musicInterval = null;
        this.musicStep = 0;
    }

    init() {
        if (this.ctx) return;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            this.startBackgroundDrone();
            this.startMusic();
        } catch (e) {
            console.warn("Web Audio API not supported or blocked: ", e);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        
        if (this.ctx) {
            if (!this.enabled) {
                this.ctx.suspend();
            } else {
                this.ctx.resume();
                if (!this.drone) {
                    this.startBackgroundDrone();
                }
                this.startMusic();
            }
        }
        return this.enabled;
    }

    // A low-frequency humming cyberpunk background drone
    startBackgroundDrone() {
        if (!this.ctx || !this.enabled) return;

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
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();

            // Store references
            this.drone = { osc1, osc2, filter, gain };
            
            // Slow modulation of filter frequency to make it "breathe"
            const modulateFilter = () => {
                if (!this.drone || !this.enabled || ctx.state === 'suspended') return;
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
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'laser' || type === 'null_laser') {
            // High frequency buzz sweep
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.18);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
            
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'cannon') {
            // Massive deep boom sweep
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
            
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
            
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'wave') {
            // Rising sweep
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.25);
            
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
            
            osc.start(now);
            osc.stop(now + 0.25);
        } else {
            // Standard small blip
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
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        
        // Short white noise burst
        const bufferSize = ctx.sampleRate * 0.05; // 50ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();
    }

    playEnemyDeath() {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;

        const now = ctx.currentTime;
        
        // Low distorted crunch noise
        const bufferSize = ctx.sampleRate * 0.15; // 150ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start();

        // Also add a low square pitch sweep
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.12);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.18, now);
        oscGain.gain.linearRampToValueAtTime(0.001, now + 0.12);
        
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playPlayerDamage() {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Bass rumble
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
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    playUpgradeSelect() {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Cyber chime arpeggio
        const playChime = (freq, delay, dur) => {
            const osc = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            osc2.type = 'sine';
            osc2.frequency.value = freq * 1.5; // harmonics

            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

            osc.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

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
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Long warm synth chord sweep
        const notes = [130.81, 164.81, 196.00, 261.63]; // C3, E3, G3, C4
        
        notes.forEach((freq) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 1.2); // slight detune sweep

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 1.2);
        });
    }

    playDash() {
        if (!this.ctx || !this.enabled) return;
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
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    startMusic() {
        if (!this.ctx || !this.enabled) return;
        if (this.musicInterval) return;

        const tempo = 120; // BPM
        const stepTime = 60 / tempo / 2; // 8th notes (0.25 seconds per step)

        // Melodic loop in A minor / Pentatonic (retro space vibe)
        const bassLine = [
            55.00, 55.00, 65.41, 65.41, 73.42, 73.42, 98.00, 82.41, // A1, A1, C2, C2, D2, D2, G2, E2
            55.00, 55.00, 65.41, 65.41, 73.42, 73.42, 98.00, 110.00 // A1, A1, C2, C2, D2, D2, G2, A2
        ];

        const melodyLine = [
            220.00, 0,      261.63, 293.66, 329.63, 0,      293.66, 220.00, // A3, -, C4, D4, E4, -, D4, A3
            220.00, 0,      261.63, 293.66, 392.00, 329.63, 293.66, 0,      // A3, -, C4, D4, G4, E4, D4, -
            220.00, 0,      261.63, 293.66, 329.63, 392.00, 440.00, 0,      // A3, -, C4, D4, E4, G4, A4, -
            392.00, 329.63, 293.66, 261.63, 293.66, 0,      220.00, 0       // G4, E4, D4, C4, D4, -, A3, -
        ];

        let lastScheduledTime = this.ctx.currentTime;

        const scheduleNextNotes = () => {
            const lookAhead = 0.4; // schedule notes 400ms ahead
            const now = this.ctx.currentTime;

            while (lastScheduledTime < now + lookAhead) {
                const bassFreq = bassLine[this.musicStep % bassLine.length];
                const melodyFreq = melodyLine[this.musicStep % melodyLine.length];

                // Play Bass (Square wave, low pass filtered, quiet background)
                if (bassFreq > 0) {
                    this.playSynthNote(bassFreq, lastScheduledTime, stepTime * 0.9, 'square', 0.04);
                }

                // Play Melody (Triangle or pulse wave, slight echo)
                if (melodyFreq > 0) {
                    this.playSynthNote(melodyFreq, lastScheduledTime, stepTime * 0.6, 'triangle', 0.035);
                    // Add a quiet echo step
                    this.playSynthNote(melodyFreq, lastScheduledTime + stepTime * 0.5, stepTime * 0.3, 'sine', 0.015);
                }

                lastScheduledTime += stepTime;
                this.musicStep++;
            }
        };

        this.musicInterval = setInterval(scheduleNextNotes, 200);
    }

    playSynthNote(freq, startTime, duration, type = 'square', volume = 0.05) {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}

export const audio = new AudioManager();
