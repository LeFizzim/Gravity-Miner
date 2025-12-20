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
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
    this.playSound(800, 'pop');
  }

  playBounce(velocity: number = 1) {
      if (this.muteBounce) return;
      // Scale frequency slightly with velocity?
      // Base freq lower than pop, maybe 300-400Hz
      this.playSound(300, 'bounce', Math.min(velocity, 1.5));
  }

  private playSound(freq: number, type: 'pop' | 'bounce', intensity: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    if (type === 'pop') {
        // --- Crumble Sound (Filtered Noise) ---
        // Create noise buffer
        const duration = 0.2;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Lowpass filter for "earthy" texture
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t); 
        filter.frequency.exponentialRampToValueAtTime(100, t + duration); // Sweep down

        const noiseGain = ctx.createGain();
        
        // Softer attack than a pop, but still quick
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(this.volume * 0.5, t + 0.02);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        noise.start(t);
        noise.stop(t + duration);
    } else {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Bounce - "Tick" sound
        oscillator.type = 'sine';
        
        // Higher frequency for a "tick"
        const baseFreq = freq * 4; // 300 * 4 = 1200Hz
        oscillator.frequency.setValueAtTime(baseFreq, t);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.03);

        // Volume scales with intensity (bounce speed)
        const vol = this.volume * 0.15 * Math.min(intensity, 1.0);
        
        gainNode.gain.setValueAtTime(vol, t);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.03);
        
        oscillator.start(t);
        oscillator.stop(t + 0.03);
    }
  }
}

export default new SoundManager();
