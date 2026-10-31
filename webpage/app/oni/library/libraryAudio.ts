/*
 * El sonido de la biblioteca, sintetizado como el del ordenador: el zumbido de la tele que se
 * enciende, el silbido de la carta, el cristal, los libros contra el suelo, el corte seco del
 * tiempo parado con su tono grave que sube, el rayo y el pitido de error.
 */
export class LibraryAudio {
  readonly ctx: AudioContext;
  private out: GainNode;
  private humN?: { o: OscillatorNode; g: GainNode };
  private droneN?: { o: OscillatorNode[]; g: GainNode; f: BiquadFilterNode };

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(this.ctx.destination);
  }

  private noise(dur: number, f: number, q: number, g: number, t0 = 0, type: BiquadFilterType = 'bandpass', f2?: number) {
    const c = this.ctx, t = c.currentTime + t0;
    const b = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
    s.buffer = b;
    bp.type = type;
    bp.frequency.setValueAtTime(f, t);
    if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    bp.Q.value = q;
    gn.gain.value = g;
    s.connect(bp).connect(gn).connect(this.out);
    s.start(t);
  }

  private tone(f: number, dur: number, g = 0.05, type: OscillatorType = 'sine', t0 = 0, f2?: number) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** El silbido agudo de la tele encendida. */
  hum(on: boolean) {
    const c = this.ctx;
    if (on && !this.humN) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 15734 / 2; // la mitad de la frecuencia de línea de un tubo, lo que llega a oírse
      g.gain.value = 0;
      g.gain.setTargetAtTime(0.004, c.currentTime, 0.3);
      o.connect(g).connect(this.out);
      o.start();
      this.humN = { o, g };
    } else if (!on && this.humN) {
      const { o, g } = this.humN;
      g.gain.setTargetAtTime(0, c.currentTime, 0.05);
      o.stop(c.currentTime + 0.3);
      this.humN = undefined;
    }
  }

  /** La carta cortando el aire. */
  whoosh = () => this.noise(0.4, 900, 2.5, 0.8, 0, 'bandpass', 4200);
  /** El cristal de la cámara: el golpe, el crujido y los trocitos. */
  glass = () => {
    this.noise(0.08, 2400, 0.6, 1.4);
    this.noise(0.5, 5200, 3, 0.5, 0.02);
    for (let i = 0; i < 7; i++) this.tone(3000 + Math.random() * 4000, 0.12, 0.012, 'sine', 0.05 + Math.random() * 0.35);
  };
  /** `n` libros contra el suelo de madera, desordenados. */
  books = (n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i * 0.08 + Math.random() * 0.1;
      this.noise(0.12, 180 + Math.random() * 120, 0.8, 1.2, t, 'lowpass');
      this.noise(0.05, 1400, 1.5, 0.35, t);
    }
  };
  /** El tiempo se para: un golpe sordo y, debajo, el tono grave sostenido. */
  stopTime() {
    this.hum(false);
    this.tone(70, 1.4, 0.25, 'sine', 0, 32);
    this.noise(0.25, 120, 0.7, 0.9, 0, 'lowpass');
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.06, c.currentTime + 0.4, 0.6);
    const o = [41, 41.6, 82.3].map((hz) => {
      const x = c.createOscillator();
      x.type = 'sawtooth';
      x.frequency.value = hz;
      x.connect(f);
      x.start();
      return x;
    });
    f.connect(g).connect(this.out);
    this.droneN?.o.forEach((x) => x.stop());
    this.droneN = { o, g, f };
  }
  /** El tono grave sube con el indicador (0 a 1). */
  drone(level: number) {
    const d = this.droneN;
    if (!d) return;
    const t = this.ctx.currentTime;
    d.f.frequency.setTargetAtTime(160 + level * 1400, t, 0.08);
    d.g.gain.setTargetAtTime(0.06 + level * 0.1, t, 0.08);
    d.o.forEach((x, i) => x.detune.setTargetAtTime(level * 700 + i * level * 30, t, 0.1));
  }
  /** El rayo: un chasquido eléctrico, el trueno corto y se corta el tono. */
  bolt = () => {
    const d = this.droneN;
    if (d) {
      d.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      d.o.forEach((x) => x.stop(this.ctx.currentTime + 0.2));
      this.droneN = undefined;
    }
    this.noise(0.06, 6000, 0.4, 1.5);
    this.tone(1800, 0.25, 0.05, 'sawtooth', 0, 60);
    this.noise(1.4, 90, 0.5, 1.4, 0.05, 'lowpass');
  };
  error = () => {
    this.tone(196, 0.16, 0.05, 'square');
    this.tone(196, 0.16, 0.05, 'square', 0.2);
  };

  dispose() {
    this.hum(false);
    this.droneN?.o.forEach((x) => x.stop());
    this.out.disconnect();
  }
}
