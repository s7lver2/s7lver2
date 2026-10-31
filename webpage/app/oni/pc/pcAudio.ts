/*
 * El sonido del ordenador de los 90, todo sintetizado: ventilador de fondo, disco duro que
 * rasca a ratos, clics, pitidos de abrir y cerrar, el error, el POST y el desgaussado.
 */

export class PcAudio {
  readonly ctx: AudioContext;
  private out: GainNode;
  private fan?: AudioBufferSourceNode;
  private seekT = 0;
  private stuck?: { o: OscillatorNode; g: GainNode; id: number };
  private laughBuf?: Promise<AudioBuffer | null>;
  private laughAn?: AnalyserNode;
  private laughData = new Float32Array(512);
  muted = false;

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(this.ctx.destination);
  }

  /** Ventilador y zumbido de fondo, y el disco que se pone a leer de vez en cuando. */
  start() {
    const c = this.ctx;
    if (c.state === 'suspended') c.resume();
    if (this.fan) return;
    const len = c.sampleRate * 4;
    const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) d[i] = last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // ruido marrón
    this.fan = c.createBufferSource();
    this.fan.buffer = b;
    this.fan.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = c.createGain();
    g.gain.value = 0.5;
    this.fan.connect(lp).connect(g).connect(this.out);
    this.fan.start();
    const hum = c.createOscillator();
    hum.frequency.value = 50;
    const hg = c.createGain();
    hg.gain.value = 0.006;
    hum.connect(hg).connect(this.out);
    hum.start();
    const seek = () => {
      this.hdd(3 + ((Math.random() * 6) | 0));
      this.seekT = window.setTimeout(seek, 6000 + Math.random() * 12000);
    };
    this.seekT = window.setTimeout(seek, 4000);
  }

  private noise(dur: number, f: number, q: number, g: number, t0 = 0) {
    if (this.muted) return;
    const c = this.ctx, t = c.currentTime + t0;
    const b = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
    s.buffer = b;
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    gn.gain.value = g;
    s.connect(bp).connect(gn).connect(this.out);
    s.start(t);
  }

  private tone(f: number, dur: number, g = 0.05, type: OscillatorType = 'square', t0 = 0, f2?: number) {
    if (this.muted) return;
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

  click = () => this.noise(0.025, 3200, 1.2, 0.5);
  key = () => this.noise(0.018, 3800 + Math.random() * 1600, 2, 0.35);
  open = () => {
    this.tone(660, 0.05, 0.03);
    this.tone(990, 0.07, 0.03, 'square', 0.05);
  };
  close = () => {
    this.tone(990, 0.05, 0.025);
    this.tone(520, 0.08, 0.025, 'square', 0.05);
  };
  error = () => {
    this.tone(196, 0.16, 0.05);
    this.tone(196, 0.16, 0.05, 'square', 0.2);
  };
  post = () => this.tone(1000, 0.16, 0.04);
  /** Un golpe de señal rota: ruido ancho y un tono que se hunde. */
  crunch = () => {
    this.noise(0.22, 900, 0.3, 1.1);
    this.tone(150, 0.3, 0.07, 'sawtooth', 0, 38);
  };
  /** El tubo que se apaga: el golpe grave de la alta tensión y un chasquido corto. */
  clonk = () => {
    this.tone(60, 0.35, 0.2, 'sine', 0, 30);
    this.noise(0.08, 300, 0.6, 0.9);
  };
  granted = () => [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.09, 0.03, 'square', i * 0.07));
  degauss = () => {
    this.tone(55, 0.6, 0.22, 'sine', 0, 48);
    this.noise(0.45, 260, 0.5, 0.5);
  };
  /** El disco busca: tics secos y desordenados. */
  hdd = (n = 6) => {
    for (let i = 0, t = 0; i < n; i++, t += 0.035 + Math.random() * 0.07) this.noise(0.03, 1600 + Math.random() * 2200, 4, 0.7, t);
  };

  /** Virus: un pitido atascado que no para de repetirse. */
  stuckBeeps(on: boolean) {
    const c = this.ctx;
    if (!on) {
      if (!this.stuck) return;
      clearInterval(this.stuck.id);
      this.stuck.o.stop();
      this.stuck = undefined;
      return;
    }
    if (this.stuck) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0;
    o.connect(g).connect(this.out);
    o.start();
    let k = 0;
    const id = window.setInterval(() => g.gain.setTargetAtTime(this.muted || k++ % 2 ? 0 : 0.025, c.currentTime, 0.004), 70);
    this.stuck = { o, g, id };
  }

  /** Virus: todo se desafina (0 limpio, 1 roto): el ventilador se acelera y el pitido se tuerce. */
  detune(amount: number) {
    const t = this.ctx.currentTime;
    this.fan?.playbackRate.setTargetAtTime(1 + amount * 2.5, t, 0.1);
    this.stuck?.o.detune.setTargetAtTime(amount * (600 + Math.random() * 900), t, 0.03);
  }

  /** Precarga la risa, para que suene a su hora y no cuando acabe de bajar. */
  loadLaugh() {
    return (this.laughBuf ||= fetch('/audio/laugh.mp3')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => this.ctx.decodeAudioData(b))
      .catch((e) => {
        if (process.env.NODE_ENV === 'development') console.info('laugh.mp3 no disponible:', e);
        return null;
      }));
  }

  /** La risa, como por una radio: banda estrecha y algo saturada. Sin archivo, nada. */
  laugh() {
    this.loadLaugh().then((buf) => {
      if (!buf || this.muted) return;
      const c = this.ctx;
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), sh = c.createWaveShaper(), g = c.createGain();
      s.buffer = buf;
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 0.7;
      const k = 18, curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      sh.curve = curve;
      g.gain.value = 0.9;
      const an = c.createAnalyser();
      an.fftSize = 512;
      s.connect(bp).connect(sh).connect(g).connect(an).connect(this.out);
      s.start();
      this.laughAn = an;
      s.onended = () => this.laughAn === an && (this.laughAn = undefined);
    });
  }

  /** Volumen de la risa ahora mismo (0–1), o -1 si no está sonando. */
  laughLevel() {
    const an = this.laughAn;
    if (!an) return -1;
    an.getFloatTimeDomainData(this.laughData);
    let s = 0;
    for (const v of this.laughData) s += v * v;
    return Math.min(1, Math.sqrt(s / this.laughData.length) * 3.2);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  dispose() {
    clearTimeout(this.seekT);
    this.stuckBeeps(false);
    this.out.disconnect();
  }
}
