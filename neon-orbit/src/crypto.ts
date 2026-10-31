export class CryptoEngine {
  public rsaKeyPair: CryptoKeyPair | null = null;
  public aesKey: CryptoKey | null = null;

  async init() {
    // Generate RSA keys (Proof of advanced crypto processing)
    this.rsaKeyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    // Generate AES key for fast symmetric encryption of internet data
    this.aesKey = await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async encryptDataAES(text: string): Promise<{ ciphertext: string, iv: string }> {
    if (!this.aesKey) return { ciphertext: "UNINITIALIZED", iv: "0" };
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.aesKey,
      data
    );
    return {
      ciphertext: this.bufferToHex(encryptedBuffer),
      iv: this.bufferToHex(iv.buffer)
    };
  }

  async hashSHA256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return this.bufferToHex(hashBuffer);
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const cryptoEngine = new CryptoEngine();
