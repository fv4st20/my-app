const SYNTHETIC_TOPICS = [
  'Quantum_entanglement',
  'Linear_algebra',
  'Eigenvalues_and_eigenvectors',
  'Gradient_descent',
  'Advanced_Encryption_Standard',
  'SHA-2',
  'Fourier_transform',
  'Rutherford_scattering',
  'Photoelectric_effect',
  'Shannon_entropy',
  'Neural_network',
  'Lattice-based_cryptography'
];

const SYNTHETIC_ACTORS = [
  'CipherBot',
  'VectorNode',
  'EigenCurator',
  'QuantumArchivist',
  'TensorDaemon',
  'EntropyMonitor'
];

export class NetworkFeed {
  private source: EventSource | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  public onNewData: ((data: string, dataSize: number) => void) | null = null;
  private lastEventTime = 0;
  private active = false;

  connect() {
    this.disconnect();
    this.active = true;
    this.lastEventTime = 0;

    // Start fallback simulator if live stream is blocked by CSP, offline, or silent
    this.watchdogTimer = setTimeout(() => {
      if (this.active && this.lastEventTime === 0) {
        this.startFallbackStream();
      }
    }, 2500);

    if (typeof EventSource === 'undefined') {
      this.startFallbackStream();
      return;
    }

    try {
      this.source = new EventSource('https://stream.wikimedia.org/v2/stream/recentchange');
      this.source.onmessage = (event) => {
        if (!this.active) return;
        const now = Date.now();
        if (now - this.lastEventTime < 300) return;

        try {
          const data = JSON.parse(event.data);
          if (data && typeof data.title === 'string' && typeof data.user === 'string') {
            this.lastEventTime = now;
            this.stopFallbackStream();
            const rawType = typeof data.type === 'string' ? data.type.toUpperCase() : 'EDIT';
            const safeUser = data.user.slice(0, 32);
            const safeTitle = data.title.slice(0, 64);
            const feedString = `[${rawType}] ${safeUser} -> ${safeTitle}`;
            if (this.onNewData) {
              this.onNewData(feedString, Math.max(100, event.data.length));
            }
          }
        } catch {
          // Ignore malformed event payloads
        }
      };

      this.source.onerror = () => {
        if (!this.active) return;
        if (this.source) {
          this.source.close();
          this.source = null;
        }
        this.startFallbackStream();
      };
    } catch {
      this.source = null;
      this.startFallbackStream();
    }
  }

  private startFallbackStream() {
    if (this.fallbackTimer || !this.active) return;
    this.fallbackTimer = setInterval(() => {
      if (!this.active || !this.onNewData) return;
      const actor = SYNTHETIC_ACTORS[Math.floor(Math.random() * SYNTHETIC_ACTORS.length)];
      const topic = SYNTHETIC_TOPICS[Math.floor(Math.random() * SYNTHETIC_TOPICS.length)];
      const syntheticSize = Math.floor(250 + Math.random() * 1400);
      this.lastEventTime = Date.now();
      this.onNewData(`[SYNTH] ${actor} -> ${topic}`, syntheticSize);
    }, 650);
  }

  private stopFallbackStream() {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  disconnect() {
    this.active = false;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.stopFallbackStream();
    if (this.source) {
      try {
        this.source.close();
      } catch {
        // Ignore close errors
      }
      this.source = null;
    }
  }
}

export const networkFeed = new NetworkFeed();
