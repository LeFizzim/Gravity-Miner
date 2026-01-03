class SoundManager {
  private audioCtx: AudioContext | null = null;
  
  public volume: number = 0.5;
  public muteBlocks: boolean = false;
  public muteBounce: boolean = false;

  constructor() {
    // AudioContext is initialized lazily or on user interaction
  }

  private getContext(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      } catch (e) {
        console.error("Web Audio API not supported", e);
      }
    }
    return this.audioCtx;
  }

  // Call this on a user interaction event (like clicking Start)
  resume() {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  playPop() {
    if (this.muteBlocks) return;
    this.playSound('pop');
  }

  playBounce(velocity: number = 1) {
      if (this.muteBounce) return;
      // Scale frequency slightly with velocity?
      this.playSound('bounce', Math.min(velocity, 1.5));
  }

  private playSound(type: 'pop' | 'bounce', intensity: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    if (type === 'pop') {
        // --- Mouth Pop (Resonant Noise Sweep) ---
        const bufferSize = ctx.sampleRate * 0.1; // 100ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter with high resonance (Q)
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 10; // High resonance for "tonal" pop
        
        // Sweep frequency down to simulate mouth shape change
        // Start around 1000Hz (formant) and drop
        filter.frequency.setValueAtTime(1200, t); 
        filter.frequency.exponentialRampToValueAtTime(300, t + 0.05);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(this.volume * 1.5, t + 0.002); // Fast attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.08); // Short decay

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + 0.1);
    } else {
        // --- Mouse Click Sound (Bounce) ---
        const duration = 0.02; // 20ms
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500; // Focused click frequency
        filter.Q.value = 1;

        const gainNode = ctx.createGain();
        const vol = this.volume * 0.1 * Math.min(intensity, 1.5); // Reduced volume
        
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(vol, t + 0.002); // Slightly slower attack
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + duration);
    }
  }
}

export default new SoundManager();
