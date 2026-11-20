/**
 * High-Precision Audio DSP & Procedural Synthesizer for Sonic Soccer
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.fftSize = 1024;
    this.bufferLength = 512;
    this.frequencyData = new Uint8Array(this.bufferLength);
    this.timeData = new Uint8Array(this.bufferLength);

    // Audio bands (0.0 to 1.0)
    this.bands = {
      subBass: 0,
      kick: 0,
      mids: 0,
      highs: 0,
      rawAverage: 0
    };

    // Onset Detection
    this.prevSpectrum = new Float32Array(this.bufferLength);
    this.spectralFlux = 0;
    this.fluxThreshold = 0.25;
    this.fluxHistory = new Array(25).fill(0.15);
    this.isKickBeat = false;
    this.isSnareBeat = false;
    this.lastBeatTime = 0;
    this.beatPulse = 0;
    this.kickPulse = 0;
    this.snarePulse = 0;

    // Track Sequencer State
    this.currentTrack = null;
    this.isPlayingSynth = false;
    this.sequencerInterval = null;
    this.step = 0;
    this.currentBpm = 128;
    this.sidechainDucking = 1.0;

    // Safe Default Audio Levels & Mute Controls
    this.sfxEnabled = true;
    this.muted = false;
    this.volume = 0.45;
  }

  init() {
    if (this.ctx && this.ctx.state !== 'closed') return;
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      this.ctx = new AudioContextCtor();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.bufferLength = this.analyser.frequencyBinCount;
      this.frequencyData = new Uint8Array(this.bufferLength);
      this.timeData = new Uint8Array(this.bufferLength);
      this.prevSpectrum = new Float32Array(this.bufferLength);
    } catch {
      this.ctx = null;
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setVolume(vol) {
    const num = Number(vol);
    this.volume = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0.45;
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  // --- Real-Time Multi-Band Analysis & Spectral Flux ---
  updateAnalysis() {
    if (!this.analyser || !this.ctx || this.ctx.state === 'closed') return;

    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const nyquist = this.ctx.sampleRate / 2;
    const binHz = nyquist / this.bufferLength;

    let subSum = 0;
    let subCount = 0;
    let kickSum = 0;
    let kickCount = 0;
    let midSum = 0;
    let midCount = 0;
    let highSum = 0;
    let highCount = 0;
    let totalSum = 0;
    let flux = 0;

    for (let i = 0; i < this.bufferLength; i++) {
      const val = this.frequencyData[i] / 255.0;
      totalSum += val;
      const freq = i * binHz;

      const diff = val - this.prevSpectrum[i];
      if (diff > 0) flux += diff;
      this.prevSpectrum[i] = val;

      if (freq >= 20 && freq < 70) {
        subSum += val;
        subCount++;
      } else if (freq >= 70 && freq < 260) {
        kickSum += val;
        kickCount++;
      } else if (freq >= 260 && freq < 2600) {
        midSum += val;
        midCount++;
      } else if (freq >= 2600 && freq < 16000) {
        highSum += val;
        highCount++;
      }
    }

    this.bands.subBass = subCount ? subSum / subCount : 0;
    this.bands.kick = kickCount ? kickSum / kickCount : 0;
    this.bands.mids = midCount ? midSum / midCount : 0;
    this.bands.highs = highCount ? highSum / highCount : 0;
    this.bands.rawAverage = this.bufferLength ? totalSum / this.bufferLength : 0;

    this.spectralFlux = flux;
    this.fluxHistory.push(flux);
    this.fluxHistory.shift();
    const avgFlux = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length;
    const fluxVariance = Math.sqrt(
      this.fluxHistory.reduce((acc, val) => acc + (val - avgFlux) ** 2, 0) / this.fluxHistory.length
    );
    const threshold = avgFlux + Math.max(0.08, fluxVariance * 1.5);

    const now = performance.now();
    this.isKickBeat = false;
    this.isSnareBeat = false;

    const minBeatInterval = 60000 / Math.max(60, this.currentBpm * 2);
    if (flux > threshold && now - this.lastBeatTime > minBeatInterval) {
      if (this.bands.kick > 0.45 || this.bands.subBass > 0.5) {
        this.isKickBeat = true;
        this.kickPulse = 1.0;
        this.beatPulse = 1.0;
        this.lastBeatTime = now;
      } else if (this.bands.mids > 0.4) {
        this.isSnareBeat = true;
        this.snarePulse = 1.0;
        this.beatPulse = Math.max(this.beatPulse, 0.75);
      }
    }

    this.beatPulse *= 0.88;
    this.kickPulse *= 0.86;
    this.snarePulse *= 0.84;
    this.sidechainDucking = Math.min(1.0, this.sidechainDucking + 0.12);
  }

  // --- Procedural Synth Tracks ---
  stopTrack() {
    if (this.sequencerInterval) {
      clearInterval(this.sequencerInterval);
      this.sequencerInterval = null;
    }
    this.isPlayingSynth = false;
    this.currentTrack = null;
  }

  playTrack(trackName) {
    this.ensureContext();
    this.stopTrack();
    if (!this.ctx) return;

    const tracks = {
      cyberpunk: { bpm: 128, name: 'Cyber Rush (Electro House)' },
      dnb: { bpm: 156, name: 'Neon Velocity (Drum & Bass)' },
      synthwave: { bpm: 114, name: 'Retrowave Stride (Darksynth)' }
    };

    const selected = tracks[trackName] || tracks.cyberpunk;
    this.currentBpm = selected.bpm;
    this.currentTrack = trackName;
    this.isPlayingSynth = true;
    this.step = 0;

    const stepDurationMs = (60000 / selected.bpm) / 4;
    this.sequencerInterval = setInterval(() => {
      this.tickSequencer(trackName);
    }, stepDurationMs);
  }

  tickSequencer(trackName) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const step = this.step;

    if (trackName === 'cyberpunk') {
      if (step % 4 === 0) {
        this.triggerKick(now, 130, 42, 0.22, 0.85);
        this.sidechainDucking = 0.25;
      }
      if (step % 8 === 4) {
        this.triggerSnare(now, 260, 0.18, 0.6);
      }
      if (step % 2 === 0) {
        this.triggerHiHat(now, step % 4 === 2 ? 0.08 : 0.04, step % 4 === 2 ? 0.3 : 0.18);
      }

      const bassNotes = [36.7, 36.7, 43.6, 36.7, 49.0, 36.7, 43.6, 32.7];
      const noteFreq = bassNotes[(step >> 1) % bassNotes.length];
      if (step % 2 === 0) {
        this.triggerSynthBass(now, noteFreq, 0.14, 0.4 * this.sidechainDucking, 'sawtooth');
      }

      if (step % 2 === 1) {
        const leadArp = [293.66, 349.23, 440.0, 523.25, 440.0, 392.0];
        const leadNote = leadArp[step % leadArp.length];
        this.triggerSynthLead(now, leadNote, 0.12, 0.2, 'triangle');
      }
    } else if (trackName === 'dnb') {
      const isKickStep = step % 16 === 0 || step % 16 === 10;
      const isSnareStep = step % 16 === 4 || step % 16 === 12;

      if (isKickStep) {
        this.triggerKick(now, 160, 48, 0.18, 0.85);
        this.sidechainDucking = 0.3;
      }
      if (isSnareStep) {
        this.triggerSnare(now, 320, 0.16, 0.7);
      }
      this.triggerHiHat(now, 0.035, 0.2);

      if (step % 4 === 0) {
        const dnbBass = [41.2, 41.2, 36.7, 49.0];
        const bFreq = dnbBass[(step >> 2) % dnbBass.length];
        this.triggerSynthBass(now, bFreq, 0.26, 0.42 * this.sidechainDucking, 'sawtooth');
      }
    } else if (trackName === 'synthwave') {
      if (step % 8 === 0) {
        this.triggerKick(now, 120, 40, 0.25, 0.85);
        this.sidechainDucking = 0.3;
      }
      if (step % 8 === 4) {
        this.triggerSnare(now, 220, 0.28, 0.75, true);
      }
      if (step % 2 === 0) {
        this.triggerHiHat(now, 0.06, 0.2);
      }

      const retroRoots = [43.65, 43.65, 38.89, 48.99];
      const root = retroRoots[(step >> 3) % retroRoots.length];
      const freq = step % 4 === 0 ? root : root * 2;
      this.triggerSynthBass(now, freq, 0.12, 0.38 * this.sidechainDucking, 'square');

      if (step % 4 === 2) {
        const chords = [349.23, 440.0, 523.25, 659.25];
        this.triggerSynthLead(now, chords[(step >> 2) % chords.length], 0.22, 0.18, 'sawtooth');
      }
    }

    this.step = (this.step + 1) % 64;
  }

  // --- Drum & Synth Voice Generators ---
  triggerKick(time, startFreq, endFreq, duration, volume) {
    if (!this.ctx || !this.analyser || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);

      gain.gain.setValueAtTime(Math.max(0.002, volume), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start(time);
      osc.stop(time + duration);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  triggerSnare(time, freq, duration, volume, isGated = false) {
    if (!this.ctx || !this.analyser || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + duration);
      oscGain.gain.setValueAtTime(Math.max(0.002, volume * 0.7), time);
      oscGain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      osc.connect(oscGain);
      oscGain.connect(this.analyser);
      oscGain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        oscGain.disconnect();
      };
      osc.start(time);
      osc.stop(time + duration);

      const noiseDur = isGated ? 0.25 : 0.12;
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * noiseDur));
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(Math.max(0.002, volume * 0.8), time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + (isGated ? 0.22 : 0.12));

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.analyser);
      noiseGain.connect(this.masterGain);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        noiseGain.disconnect();
      };

      noise.start(time);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  triggerHiHat(time, duration, volume) {
    if (!this.ctx || !this.analyser || !this.masterGain) return;
    try {
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.002, volume), time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.masterGain);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      noise.start(time);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  triggerSynthBass(time, freq, duration, volume, type = 'sawtooth') {
    if (!this.ctx || !this.analyser || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 4.5, time);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);
      filter.Q.value = 4.0;

      gain.gain.setValueAtTime(Math.max(0.002, volume), time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };

      osc.start(time);
      osc.stop(time + duration);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  triggerSynthLead(time, freq, duration, volume, type = 'sawtooth') {
    if (!this.ctx || !this.analyser || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.01, time);
      gain.gain.linearRampToValueAtTime(Math.max(0.01, volume), time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.analyser);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start(time);
      osc.stop(time + duration);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  // --- Procedural Game Sound Effects ---
  playKickSound(power = 1.0) {
    if (this.muted || !this.sfxEnabled || !this.ctx || !this.masterGain) return;
    this.ensureContext();
    if (this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const safePower = Number.isFinite(power) ? Math.max(0.2, Math.min(1.5, power)) : 1.0;
      osc.frequency.setValueAtTime(180 + safePower * 40, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

      gain.gain.setValueAtTime(0.3 * safePower, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore WebAudio error
    }
  }

  playSonicStrikeSound() {
    if (this.muted || !this.sfxEnabled || !this.ctx || !this.masterGain) return;
    this.ensureContext();
    if (this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.38);

      this.triggerKick(now, 180, 25, 0.45, 0.7);
    } catch {
      // Ignore WebAudio error
    }
  }

  playGoalBlast(isBlueTeam = true) {
    if (this.muted || !this.sfxEnabled || !this.ctx || !this.masterGain) return;
    this.ensureContext();
    if (this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const chord = isBlueTeam ? [261.63, 329.63, 392.0, 523.25] : [220.0, 277.18, 329.63, 440.0];
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.14, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now + idx * 0.05);
        osc.stop(now + 0.85);
      });

      this.triggerKick(now, 160, 20, 0.8, 0.75);
    } catch {
      // Ignore WebAudio error
    }
  }

  playBounceSound() {
    if (this.muted || !this.sfxEnabled || !this.ctx || !this.masterGain) return;
    this.ensureContext();
    if (this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Ignore WebAudio error
    }
  }
}
