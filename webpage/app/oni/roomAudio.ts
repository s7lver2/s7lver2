import * as THREE from 'three';

/*
 * El sonido de la habitación. Todo sale de un mismo contexto que escucha desde la cámara:
 * - la lluvia contra la ventana, de fondo y sin bucle audible (ruido filtrado);
 * - los truenos, que llegan un poco después de cada relámpago;
 * - el siseo de las ruedas en el asfalto mojado cuando pasa un coche;
 * - la grabadora, que funciona como una radio mal sintonizada: ratos callada, unos
 *   segundos de estática pura, una canción (o un trozo del directo largo) con mucha
 *   estática encima, otra vez estática y vuelta a callar. Mientras suena, a veces la
 *   señal se corta y entra una voz. Se oye más cuanto más te acercas a la mesa.
 * El navegador no deja sonar nada hasta el primer clic o tecla: unlock() lo arranca.
 */

// la canción entera, o un trozo al azar del audio largo
const SONG = '/audio/music-2.m4a';
const LONG = '/audio/music-1.m4a';
const MUSIC_GAIN = 0.6;
const HISS = 0.006; // callada: apenas el zumbido del aparato
const STATIC = 0.32; // entre sintonías: estática pura
const UNDER = 0.11; // debajo de la música
const VOICES = Array.from({ length: 8 }, (_, i) => `/audio/voice-${i + 1}.m4a`);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBuffer(ctx: BaseAudioContext, seconds: number, brown = false) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return b;
}

export class RoomAudio {
  readonly listener = new THREE.AudioListener();
  readonly recorder: THREE.PositionalAudio;
  private ctx: AudioContext;
  private master: GainNode;
  private muffle: BiquadFilterNode; // al entrar en el ordenador el cuarto se oye ahogado
  // pegados a la máscara el sonido se rompe: una rama saturada y robótica que entra con la cercanía
  private dry: GainNode;
  private wet: GainNode;
  private ringOsc: OscillatorNode;
  private noise: AudioBuffer;
  private brown: AudioBuffer;
  private carGain?: GainNode;
  private carFilter?: BiquadFilterNode;
  private bus: GainNode; // la entrada de la grabadora: música, estática y voces
  private musicGain: GainNode;
  private staticGain: GainNode;
  private el = new Audio();
  private voices: AudioBuffer[] = [];
  // la programación de la radio
  private radio: 'quiet' | 'tune' | 'song' | 'fade' = 'quiet';
  private radioUntil = 4; // la primera sintonía llega enseguida
  private flutter = 0;
  private nextVoice = rand(30, 55);
  private started = false;
  private interrupted = false;
  private analyser: AnalyserNode;
  private wave = new Float32Array(256);
  private lvl = 0;
  playing = true;

  constructor() {
    const ctx = (this.ctx = this.listener.context);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 18) * 0.8; // saturación dura
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    // modulación en anillo: la señal se multiplica por una onda grave y suena a máquina
    const ring = ctx.createGain();
    ring.gain.value = 0;
    this.ringOsc = ctx.createOscillator();
    this.ringOsc.type = 'square';
    this.ringOsc.frequency.value = 42;
    this.ringOsc.connect(ring.gain);
    this.ringOsc.start();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.6;
    this.master.connect(this.dry).connect(this.muffle);
    this.master.connect(shaper).connect(ring).connect(band).connect(this.wet).connect(this.muffle);
    // el oyente de three manda a ctx.destination; lo desvío por el mismo master
    this.listener.gain.disconnect();
    this.listener.gain.connect(this.master);
    this.muffle.connect(ctx.destination);
    this.noise = noiseBuffer(ctx, 5);
    this.brown = noiseBuffer(ctx, 7, true);

    // la grabadora: fuente posicional con su propia cadena (radio vieja: sin graves ni agudos)
    const pos = (this.recorder = new THREE.PositionalAudio(this.listener));
    pos.setRefDistance(0.8);
    pos.setRolloffFactor(0.6); // desde la cama se oye bajito, pegado a la mesa llena el cuarto
    pos.setDistanceModel('inverse');
    this.bus = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    // la cadena va a mano: setFilters solo conecta cuando el Audio tiene fuente propia
    this.bus.connect(hp).connect(lp).connect(pos.getOutput());
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    lp.connect(this.analyser);
    pos.gain.gain.value = 0.55; // el volumen de la radio

    this.el.crossOrigin = 'anonymous';
    this.el.preload = 'none';
    this.el.addEventListener('ended', () => this.radio === 'song' && this.endSong());
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    // la música pasa por una banda estrecha, como una emisora de onda media
    ctx.createMediaElementSource(this.el).connect(this.filter('highpass', 260)).connect(this.filter('lowpass', 3600)).connect(this.musicGain).connect(this.bus);
    this.staticGain = ctx.createGain();
    this.staticGain.gain.value = 0;
    this.staticGain.connect(this.bus);

    for (const [i, url] of VOICES.entries())
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((a) => ctx.decodeAudioData(a))
        .then((b) => (this.voices[i] = b))
        .catch(() => {});
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Primer gesto del usuario: arranca el contexto, la lluvia y la música. */
  unlock() {
    if (this.started) {
      this.ctx.resume();
      return;
    }
    this.started = true;
    this.ctx.resume();
    this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
    this.startRain();
    this.startStatic();
    this.startCar();
    this.radioUntil = this.ctx.currentTime + 3;
  }

  private loop(buf: AudioBuffer, ...chain: AudioNode[]) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = 0;
    s.loopEnd = buf.duration;
    let n: AudioNode = s;
    for (const c of chain) n = n.connect(c);
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  private filter(type: BiquadFilterType, f: number, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  private gain(v: number) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  private startRain() {
    const out = this.gain(1);
    out.connect(this.listener.gain);
    // cuerpo: el aguacero amortiguado por el cristal
    this.loop(this.noise, this.filter('lowpass', 700), this.gain(0.05), out);
    // la cortina fina de gotas
    this.loop(this.brown, this.filter('bandpass', 2600, 0.4), this.gain(0.016), out);
    // y el golpeteo: un ruido que respira despacio, para que no suene a ventilador
    const tick = this.gain(0.008);
    this.loop(this.noise, this.filter('highpass', 4200), tick, out);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const depth = this.gain(0.004);
    lfo.connect(depth).connect(tick.gain);
    lfo.start();
  }

  private startStatic() {
    // la estática de la radio: un soplido ancho y un chisporroteo grave mezclados
    this.loop(this.noise, this.filter('bandpass', 3000, 0.35), this.staticGain);
    this.loop(this.brown, this.filter('lowpass', 1200), this.gain(1.6), this.staticGain);
    this.staticGain.gain.value = this.playing ? HISS : 0;
  }

  private startCar() {
    this.carGain = this.gain(0);
    this.carFilter = this.filter('bandpass', 900, 0.8);
    this.loop(this.noise, this.carFilter, this.carGain, this.listener.gain);
  }

  /** env 0 → 1 → 0 mientras el coche pasa por delante de la ventana. */
  car(env: number) {
    if (!this.carGain || !this.carFilter) return;
    const t = this.ctx.currentTime;
    this.carGain.gain.setTargetAtTime(env * 0.11, t, 0.08);
    this.carFilter.frequency.setTargetAtTime(600 + env * 900, t, 0.1);
  }

  /** Un trueno, que llega tarde y largo; cuanto más fuerte el relámpago, antes y más grave. */
  thunder(power: number) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + rand(0.6, 2.2) * (1.4 - power * 0.6);
    const s = ctx.createBufferSource();
    s.buffer = this.brown;
    const lp = this.filter('lowpass', 160 + power * 120);
    const g = this.gain(0);
    s.connect(lp).connect(g).connect(this.listener.gain);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9 * power, t + 0.12);
    g.gain.setTargetAtTime(0.35 * power, t + 0.3, 0.4); // retumba
    g.gain.setTargetAtTime(0, t + 1.6, 1.4);
    s.start(t, Math.random() * 2, 7);
  }

  /** Volumen de la música de la radio, 0 → 1, suavizado (la estática no cuenta). */
  level() {
    if (!this.started || this.radio !== 'song') return (this.lvl *= 0.9);
    this.analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (const v of this.wave) sum += v * v;
    const rms = Math.min(1, Math.sqrt(sum / this.wave.length) * 5);
    this.lvl += (rms - this.lvl) * (rms > this.lvl ? 0.5 : 0.12);
    return this.lvl;
  }

  /** Está entrando una voz por la radio. */
  get cutting() {
    return this.interrupted;
  }

  /** La radio está dando algo (las bobinas solo giran con música). */
  get spinning() {
    return this.playing && this.radio === 'song';
  }

  private setStatic(v: number, tc = 0.08) {
    this.staticGain.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  /** Estática pura unos segundos y luego entra algo. */
  private tune() {
    this.radio = 'tune';
    this.radioUntil = this.ctx.currentTime + rand(2, 5);
    this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    this.setStatic(STATIC, 0.15);
  }

  private startSong() {
    const t = this.ctx.currentTime;
    const long = Math.random() < 0.5;
    this.radio = 'song';
    this.el.src = long ? LONG : SONG;
    // del audio largo, un trozo de uno a dos minutos y medio desde cualquier punto
    this.radioUntil = long ? t + rand(60, 150) : t + 9999;
    if (long)
      this.el.addEventListener('loadedmetadata', () => (this.el.currentTime = rand(0, Math.max(0, this.el.duration - 160))), { once: true });
    this.el.play().catch(() => {});
    this.musicGain.gain.setTargetAtTime(MUSIC_GAIN, t + 0.2, 0.25);
    this.setStatic(UNDER, 0.4);
  }

  private endSong() {
    this.radio = 'fade';
    this.radioUntil = this.ctx.currentTime + rand(2, 4);
    this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    this.setStatic(STATIC, 0.1);
    setTimeout(() => this.radio !== 'song' && this.el.pause(), 600);
  }

  private quiet() {
    this.radio = 'quiet';
    this.radioUntil = this.ctx.currentTime + rand(25, 70);
    this.setStatic(this.playing ? HISS : 0, 0.3);
  }

  /** Clic en la grabadora: el botón hace clac y la radio se apaga o vuelve a sintonizar. */
  toggle() {
    this.playing = !this.playing;
    if (!this.started) return this.playing;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const g = this.gain(0);
    s.connect(this.filter('bandpass', 1400, 2)).connect(g).connect(this.bus);
    g.gain.setValueAtTime(0.9, t);
    g.gain.setTargetAtTime(0, t + 0.01, 0.015);
    s.start(t, 0, 0.12);
    if (this.playing) this.tune();
    else {
      // la cinta pierde velocidad antes de pararse
      this.el.playbackRate = 0.85;
      this.musicGain.gain.setTargetAtTime(0, t, 0.08);
      this.setStatic(0, 0.05);
      this.radio = 'quiet';
      setTimeout(() => {
        if (!this.playing) this.el.pause();
        this.el.playbackRate = 1;
      }, 350);
    }
    return this.playing;
  }

  /** La señal se corta: cae la música, sube la estática y habla alguien que no está. */
  private interrupt() {
    const v = this.voices.filter(Boolean);
    if (!v.length || !this.spinning) return;
    this.interrupted = true;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const voice = v[Math.floor(Math.random() * v.length)];
    this.musicGain.gain.setTargetAtTime(0.02, t, 0.05);
    this.setStatic(0.3, 0.05);
    const src = ctx.createBufferSource();
    src.buffer = voice;
    src.connect(this.gain(0.9)).connect(this.bus);
    src.start(t + 0.35);
    const end = t + 0.35 + voice.duration;
    this.staticGain.gain.setTargetAtTime(0.12, t + 0.4, 0.2);
    this.staticGain.gain.setTargetAtTime(0.3, end, 0.03);
    this.radioUntil = Math.max(this.radioUntil, end + 4); // que no se acabe la canción en mitad de la voz
    setTimeout(() => {
      this.interrupted = false;
      if (this.radio !== 'song' || !this.playing) return;
      const n = this.ctx.currentTime;
      this.setStatic(UNDER, 0.1);
      this.musicGain.gain.setTargetAtTime(MUSIC_GAIN, n, 0.25);
    }, (voice.duration + 0.6) * 1000);
  }

  /** Cada fotograma: la programación de la radio, la estática viva, las voces y la zambullida. */
  update(T: number, dive: number, visible: boolean, near = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (this.playing && t > this.radioUntil) {
      if (this.radio === 'quiet') this.tune();
      else if (this.radio === 'tune') this.startSong();
      else if (this.radio === 'song') this.endSong();
      else this.quiet();
    }
    // la estática nunca es plana: tiembla, y con la música mete chasquidos y desvanecimientos
    if (this.playing && !this.interrupted && T > this.flutter) {
      this.flutter = T + rand(0.05, 0.18);
      const base = this.radio === 'tune' || this.radio === 'fade' ? STATIC : this.radio === 'song' ? UNDER : HISS;
      const pop = this.radio === 'song' && Math.random() < 0.08 ? rand(2, 3.5) : 1;
      this.staticGain.gain.setTargetAtTime(base * rand(0.65, 1.35) * pop, t, 0.03);
      if (this.radio === 'song' && Math.random() < 0.02) {
        // la emisora se va un instante
        this.musicGain.gain.setTargetAtTime(0.1, t, 0.02);
        this.musicGain.gain.setTargetAtTime(MUSIC_GAIN, t + rand(0.1, 0.5), 0.05);
      }
    }
    if (T > this.nextVoice) {
      this.nextVoice = T + rand(40, 90);
      if (!this.interrupted) this.interrupt();
    }
    this.muffle.frequency.setTargetAtTime(20000 - dive * 19400, t, 0.1);
    // cuanto más cerca de la máscara, más rota: entra la rama distorsionada y la onda baja y tiembla
    const d = near * near;
    this.wet.gain.setTargetAtTime(d * 0.3, t, 0.15);
    this.dry.gain.setTargetAtTime(1 - d * 0.45, t, 0.15);
    this.ringOsc.frequency.setTargetAtTime(42 - d * 24 + Math.sin(T * 7) * 6 * d, t, 0.05);
    if (this.radio === 'song' && Math.random() < d * 0.08) {
      // la emisora se corta a golpes
      this.musicGain.gain.setTargetAtTime(0.05, t, 0.01);
      this.musicGain.gain.setTargetAtTime(MUSIC_GAIN, t + rand(0.05, 0.2), 0.02);
    }
    this.master.gain.setTargetAtTime(visible ? 1 - dive * 0.7 : 0, t, visible ? 0.4 : 0.8);
  }

  private onVisibility = () => {
    if (!this.started) return;
    if (document.hidden) this.ctx.suspend();
    else this.ctx.resume();
  };

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.el.pause();
    this.el.removeAttribute('src');
    // el contexto de three es compartido: se desconecta, no se cierra
    this.master.gain.value = 0;
    this.muffle.disconnect();
    this.ringOsc.stop();
  }
}
