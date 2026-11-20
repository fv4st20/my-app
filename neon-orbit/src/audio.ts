import { Vector2 } from './math';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private defaultVolume = 0.32;

  // BGM Elements
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmStarted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.defaultVolume, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  public async init() {
    if (typeof window === 'undefined') return;

    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.defaultVolume;
        this.masterGain.connect(this.ctx.destination);
        this.bgmStarted = false;
      } catch {
        this.ctx = null;
        return;
      }
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    if (!this.bgmStarted) {
      await this.initBGM();
    }
  }

  private async initBGM() {
    if (!this.ctx || !this.masterGain || this.bgmStarted) return;

    try {
      if (!this.bgmBuffer) {
        const bgmUrl = `${import.meta.env.BASE_URL}bgm.mp3`;
        const response = await fetch(bgmUrl);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      }

      if (!this.ctx || !this.masterGain || this.bgmStarted) return;

      this.bgmSource = this.ctx.createBufferSource();
      this.bgmSource.buffer = this.bgmBuffer;
      this.bgmSource.loop = true;

      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 22050;

      const bgmGain = this.ctx.createGain();
      bgmGain.gain.value = 0.35;

      this.bgmSource.connect(this.bgmFilter);
      this.bgmFilter.connect(bgmGain);
      bgmGain.connect(this.masterGain);

      this.bgmSource.start();
      this.bgmStarted = true;
    } catch {
      // Optional BGM may be absent or blocked; continue silently
    }
  }

  public updateBGMFilter(healthPercent: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(healthPercent) ? healthPercent : 1));
    if (this.bgmFilter && this.ctx) {
      const targetFreq = 500 + 21550 * clamped;
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    if (this.bgmSource && this.ctx) {
      const targetRate = 1.0 + (1.0 - clamped) * 0.2;
      this.bgmSource.playbackRate.setTargetAtTime(targetRate, this.ctx.currentTime, 0.1);
    }
  }

  public playShootSound(dir: Vector2) {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const angle = Math.atan2(dir.y, dir.x);
      const rawFreq = 400 + ((angle + Math.PI) / (Math.PI * 2)) * 400;
      const baseFreq = Number.isFinite(rawFreq) ? Math.max(200, Math.min(1200, rawFreq)) : 500;

      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, baseFreq * 0.1), this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  public playImpactSound(force: number, determinant: number, destroyed: boolean) {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const safeDet = Number.isFinite(determinant) ? Math.abs(determinant) : 0.5;
      const freq = Math.max(60, Math.min(4000, 100 + safeDet * 400));
      const safeForce = Number.isFinite(force) ? Math.max(0.02, force) : 0.2;
      const duration = destroyed ? 0.3 : 0.1;

      osc.type = destroyed ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const volume = Math.max(0.005, Math.min(0.35, safeForce * 0.08));
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      if (destroyed) {
        osc.frequency.linearRampToValueAtTime(Math.max(30, freq * 0.2), this.ctx.currentTime + duration);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore transient WebAudio errors
    }
  }

  public playEMPSound() {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.32, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
    } catch {
      // Ignore transient WebAudio errors
    }
  }
}

export const audioEngine = new AudioEngine();
