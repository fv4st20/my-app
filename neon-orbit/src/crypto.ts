export class CryptoEngine {
  public rsaKeyPair: CryptoKeyPair | null = null;
  public aesKey: CryptoKey | null = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      this.initialized = true;
      return;
    }

    try {
      this.rsaKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.aesKey = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      // Fallback gracefully when WebCrypto is restricted (e.g. non-HTTPS LAN)
      this.rsaKeyPair = null;
      this.aesKey = null;
    }
    this.initialized = true;
  }

  async encryptDataAES(text: string): Promise<{ ciphertext: string; iv: string }> {
    if (!this.aesKey || typeof window === 'undefined' || !window.crypto?.subtle) {
      return {
        ciphertext: this.fallbackHex(text, 32),
        iv: this.fallbackHex(text + ':iv', 12)
      };
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.aesKey,
        data
      );
      return {
        ciphertext: this.bufferToHex(encryptedBuffer),
        iv: this.bufferToHex(iv.buffer)
      };
    } catch {
      return {
        ciphertext: this.fallbackHex(text, 32),
        iv: this.fallbackHex(text + ':iv', 12)
      };
    }
  }

  async hashSHA256(text: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return this.bufferToHex(hashBuffer);
      } catch {
        // Use fallback digest below
      }
    }
    return this.fallbackHex(text, 32);
  }

  private fallbackHex(input: string, byteLen: number): string {
    let h1 = 0xdeadbeef ^ input.length;
    let h2 = 0x41c6ce57 ^ input.length;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    const bytes: string[] = [];
    for (let i = 0; i < byteLen; i++) {
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      bytes.push(((h1 >>> ((i % 4) * 8)) & 0xff).toString(16).padStart(2, '0'));
    }
    return bytes.join('');
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const cryptoEngine = new CryptoEngine();
