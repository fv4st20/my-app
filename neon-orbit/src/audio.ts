import { Vector2 } from './math';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // BGM Elements
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;

  public async init() {
    if (this.ctx) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    await this.initBGM();
  }

  private async initBGM() {
    if (!this.ctx || !this.masterGain) return;

    try {
      // Fetch and decode for perfectly seamless looping
      const response = await fetch('bgm.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      this.bgmSource = this.ctx.createBufferSource();
      this.bgmSource.buffer = this.bgmBuffer;
      this.bgmSource.loop = true; // Seamless loop

      // Route BGM through a low-pass filter for gameplay responsiveness
      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 22050; // Max open by default

      // Add volume control for BGM specifically
      const bgmGain = this.ctx.createGain();
      bgmGain.gain.value = 0.4;

      this.bgmSource.connect(this.bgmFilter);
      this.bgmFilter.connect(bgmGain);
      bgmGain.connect(this.masterGain);

      this.bgmSource.start();
    } catch (e) {
      console.warn('Background music could not be loaded or played. Place bgm.mp3 in public/ folder.', e);
    }
  }

  // Make BGM responsive: lower health applies a low-pass muffle effect
  public updateBGMFilter(healthPercent: number) {
    if (this.bgmFilter && this.ctx) {
      // Map health (0.0 to 1.0) to frequency (500Hz to 22050Hz)
      const targetFreq = 500 + (21550 * healthPercent);
      // Smoothly transition filter
      this.bgmFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    // Also increase playback rate slightly based on intensity (inverse of health or based on score?)
    if (this.bgmSource && this.ctx) {
      const targetRate = 1.0 + (1.0 - healthPercent) * 0.2; // Speeds up to 1.2x on low health
      this.bgmSource.playbackRate.setTargetAtTime(targetRate, this.ctx.currentTime, 0.1);
    }
  }

  public playShootSound(dir: Vector2) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency based on vector angle (math-based sound)
    const angle = Math.atan2(dir.y, dir.x);
    const baseFreq = 400 + ((angle + Math.PI) / (Math.PI * 2)) * 400; // 400Hz to 800Hz

    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.1, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playImpactSound(force: number, determinant: number, destroyed: boolean) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Pitch based on matrix structural integrity (determinant)
    // Determinant for 2x2 with values [-1,1] ranges roughly from 0 to 2.
    const freq = 100 + (Math.abs(determinant) * 400);

    osc.type = destroyed ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    // Volume based on physical force of collision
    const volume = Math.min(0.5, force * 0.1);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (destroyed ? 0.3 : 0.1));

    if (destroyed) {
      // Add frequency instability for destruction
      osc.frequency.linearRampToValueAtTime(freq * 0.2, this.ctx.currentTime + 0.3);
    }

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + (destroyed ? 0.3 : 0.1));
  }

  public playEMPSound() {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 1.5);

    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }
}

export const audioEngine = new AudioEngine();
