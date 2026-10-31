export class NetworkFeed {
  private source: EventSource | null = null;
  public onNewData: ((data: string, dataSize: number) => void) | null = null;
  private lastEventTime = 0;

  connect() {
    if (this.source) return;
    this.source = new EventSource('https://stream.wikimedia.org/v2/stream/recentchange');
    this.source.onmessage = (event) => {
      const now = Date.now();
      if (now - this.lastEventTime < 300) return; // Throttle: Max ~3 enemies per second
      
      try {
        const data = JSON.parse(event.data);
        if (data.title && data.user) {
          this.lastEventTime = now;
          const feedString = `[${data.type.toUpperCase()}] ${data.user} -> ${data.title}`;
          if (this.onNewData) {
            this.onNewData(feedString, event.data.length);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
  }

  disconnect() {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }
}

export const networkFeed = new NetworkFeed();
