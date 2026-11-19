/**
 * Sound and voice, with no external files.
 * - Effects: synthesized with Web Audio (marimba, little bells, an applauding audience, whistles and confetti poppers made of filtered noise).
 *   No third-party sound files.
 * - Voice: the browser's speech synthesis. It only speaks if there is a French voice;
 *   it prefers the natural Canadian voice that ships with Microsoft Edge.
 * - English voice (listening games): a SEPARATE voice, only English (en-CA first, then en-US); one single voice for all
 *   the English content (children understand one talker better than several), a bit slower than normal.
 */

const KEY = 'melina.muted';
let muted = false;
try {
  muted = window.localStorage.getItem(KEY) === '1';
} catch {
  /* storage unavailable: start with sound on */
}

export function isMuted() {
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  try {
    window.localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (m) {
    stopSpeaking();
    sfx.hush(); // the celebration in progress stops too (before, applause and whistle went on for up to 5 s after muting)
  }
}

// ------------------------------------------------------------------ effects

let ctx: AudioContext | null = null;
let master: AudioNode | null = null;
function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = limiter(ctx);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Compressor on the output: fanfare + applause together never clip or get too loud. */
function limiter(a: BaseAudioContext): AudioNode {
  const c = a.createDynamicsCompressor();
  c.threshold.value = -14;
  c.knee.value = 10;
  c.ratio.value = 6;
  c.attack.value = 0.003;
  c.release.value = 0.2;
  c.connect(a.destination);
  return c;
}

/** Everything is rendered into any context: the real one (to play) or an offline one (to check silently, in tests). */
type Out = { a: BaseAudioContext; dest: AudioNode; t0: number };

function noteOn({ a, dest, t0 }: Out, freq: number, at = 0, dur = 0.18, gain = 0.16, type: OscillatorType = 'triangle') {
  const t = t0 + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(a: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(a);
  if (!b) {
    b = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(a, b);
  }
  return b;
}

/** One clap: three bursts of noise very close together, filtered like a palm. */
function clap(o: Out, at: number, gain: number, pan: number, tone: number) {
  const { a, dest } = o;
  const t = o.t0 + at;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = tone;
  bp.Q.value = 1.1;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (const [dt, k] of [[0, 1], [0.009, 0.8], [0.018, 0.65]] as const) {
    g.gain.setValueAtTime(gain * k, t + dt);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.008);
  }
  g.gain.setValueAtTime(gain * 0.7, t + 0.026);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  const p = a.createStereoPanner();
  p.pan.value = pan;
  src.connect(bp).connect(g).connect(p).connect(dest);
  src.start(t, Math.random() * 0.3);
  src.stop(t + 0.16);
}

/** Room: short echo (impulse response made of decaying noise), so the claps sound like a real audience. */
const roomCache = new WeakMap<BaseAudioContext, AudioNode>();
function room(o: Out): AudioNode {
  let r = roomCache.get(o.a);
  if (!r) {
    const a = o.a;
    const len = Math.floor(a.sampleRate * 1.1);
    const ir = a.createBuffer(2, len, a.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = a.createConvolver();
    conv.buffer = ir;
    const wet = a.createGain();
    wet.gain.value = 0.22;
    const input = a.createGain();
    input.connect(o.dest); // dry sound
    input.connect(conv).connect(wet).connect(o.dest); // room echo
    roomCache.set(a, input);
    r = input;
  }
  return r;
}

/**
 * Audience clapping: many loose claps (each person at their own pace, each in a different spot in the room),
 * that build quickly and fade slowly.
 */
function applause(o: Out, at: number, dur: number, peak: number, perSecond = 60) {
  const inRoom: Out = { ...o, dest: room(o) };
  const n = Math.round(dur * perSecond);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * dur;
    const env = Math.min(1, x / 0.35) * Math.pow(1 - x / dur, 1.1);
    clap(inRoom, at + x, peak * (0.35 + Math.random() * 0.65) * env, Math.random() * 1.8 - 0.9, 800 + Math.random() * 1800);
  }
}

/** The audience's «Ouuuh!»: noise with vowel resonances that rises and falls. */
function crowdCheer(o: Out, at: number, dur: number, gain: number) {
  const { a } = o;
  const t = o.t0 + at;
  const dest = room(o);
  for (const [f, q, k] of [[650, 4, 1], [1100, 5, 0.7], [2400, 6, 0.35]] as const) {
    const src = a.createBufferSource();
    src.buffer = noise(a);
    src.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f * 0.9, t);
    bp.frequency.linearRampToValueAtTime(f * 1.08, t + dur * 0.4);
    bp.frequency.linearRampToValueAtTime(f * 0.95, t + dur);
    bp.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * k, t + 0.3);
    g.gain.setValueAtTime(gain * k, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}

/** A «fiu-fiu» whistle from someone in the audience. */
function whistle(o: Out, at: number, pan: number) {
  const { a } = o;
  const t = o.t0 + at;
  const p = a.createStereoPanner();
  p.pan.value = pan;
  p.connect(room(o));
  for (const [dt, f0, f1, d] of [[0, 1500, 2600, 0.16], [0.24, 1700, 2900, 0.3]] as const) {
    const osc = a.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t + dt);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dt + d * 0.7);
    osc.frequency.exponentialRampToValueAtTime(f1 * 0.9, t + dt + d);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t + dt);
    g.gain.exponentialRampToValueAtTime(0.09, t + dt + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + d);
    osc.connect(g).connect(p);
    osc.start(t + dt);
    osc.stop(t + dt + d + 0.02);
  }
}

/** Confetti popper: a low «pof!» and a short hiss. */
function popper(o: Out, at: number, pan: number) {
  const { a, dest } = o;
  const t = o.t0 + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  const p = a.createStereoPanner();
  p.pan.value = pan;
  osc.connect(g).connect(p).connect(dest);
  osc.start(t);
  osc.stop(t + 0.16);
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2500;
  const gn = a.createGain();
  gn.gain.setValueAtTime(0.35, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  src.connect(hp).connect(gn).connect(p);
  src.start(t);
  src.stop(t + 0.4);
}

/** Sparkles: high bell notes falling like confetti. */
function sparkle(o: Out, at: number, count: number) {
  const bells = [1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96];
  for (let i = 0; i < count; i++) noteOn(o, bells[Math.floor(Math.random() * bells.length)] as number, at + i * 0.07 + Math.random() * 0.03, 0.35, 0.05, 'sine');
}

/*
 * Research rules (research_notes/Completion sounds and messages): correct answer = calm bell ≤ 0.6 s, with 4 variations
 * of the same family; end of activity ≤ 3 s (applause ≤ 2 s), 3 variations; milestone ≤ 5 s, 2 variations, skippable with one
 * tap; mistake = NO sound (no sad notes); effects always below the voice (ducking while it speaks).
 */
const BELLS: Array<Array<[number, number]>> = [
  [[1046.5, 0], [1318.51, 0.06], [1567.98, 0.12]], // C-E-G
  [[783.99, 0], [1046.5, 0.06], [1318.51, 0.12]], // G-C-E
  [[1318.51, 0], [1567.98, 0.06], [2093, 0.12]], // E-G-C
  [[1046.5, 0], [1567.98, 0.07], [1318.51, 0.14]], // C-G-E
];

/** Correct round (small celebration): 3 bell notes, ≤ 0.6 s. */
function drawChime(o: Out, v = 0) {
  for (const [f, at] of BELLS[v % BELLS.length] as Array<[number, number]>) noteOn(o, f, at, 0.42, 0.09, 'sine');
}

/** End of activity: bell + short applause (≤ 2 s); total ≤ 3 s. */
function drawWin(o: Out, v = 0) {
  drawChime(o, v);
  applause(o, 0.15, 1.7, v % 3 === 2 ? 0.5 : 0.6, v % 3 === 1 ? 40 : 50);
}

/** Milestone (level confirmed, mission): confetti poppers + audience (≤ 3.5 s) + «ouuuh!»; total ≤ 5 s. */
function drawCelebrate(o: Out, v = 0) {
  popper(o, 0, -0.6);
  popper(o, 0.09, 0.6);
  drawChime(o, v + 1);
  applause(o, 0.12, 3.4, 0.85, 75);
  crowdCheer(o, 0.2, 2, 0.22);
  if (v % 2 === 0) whistle(o, 0.8, -0.5);
  else whistle(o, 1.4, 0.6);
}

const SOUNDS = { chime: drawChime, win: drawWin, celebrate: drawCelebrate } as const;

/** Effects bus: can be lowered (while the voice speaks) or silenced (a tap skips the celebration). */
let bus: GainNode | null = null;
function busFor(a: AudioContext): GainNode {
  if (!bus) {
    bus = a.createGain();
    bus.gain.value = speaking ? 0.3 : 1; // a new bus created during speech starts low
    bus.connect(master as AudioNode);
  }
  return bus;
}

/** A variation that does not repeat the previous one. */
const lastVariant: Record<string, number> = {};
function variant(name: string, count: number): number {
  let v = Math.floor(Math.random() * count);
  if (count > 1 && v === lastVariant[name]) v = (v + 1) % count;
  lastVariant[name] = v;
  return v;
}

function play(draw: (o: Out) => void) {
  const a = audio();
  if (!a || !master) return;
  draw({ a, dest: busFor(a), t0: a.currentTime + 0.02 });
}

/** Lowers the effects while the voice speaks (effects always below the voice). */
/** Is the voice speaking? (effects stay below it) */
let speaking = false;
function duck(on: boolean) {
  speaking = on;
  if (!ctx || !bus) return;
  bus.gain.setTargetAtTime(on ? 0.3 : 1, ctx.currentTime, 0.08);
}

function note(freq: number, at = 0, dur = 0.18, gain = 0.16, type: OscillatorType = 'triangle') {
  play((o) => noteOn(o, freq, at, dur, gain, type));
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

export const sfx = {
  /** fruit dropping into the crate: the note rises with each fruit, from 1 to 10 */
  pop(index: number) {
    note(PENTA[index % 10] ?? 523.25, 0, 0.2, 0.15);
  },
  tap() {
    note(440, 0, 0.06, 0.08, 'sine');
  },
  /** crate full */
  crate() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.07, 0.32, 0.14));
  },
  /** small find (word found in the grid): the old marimba arpeggio, no applause */
  found() {
    [659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => note(f, i * 0.07, 0.3, 0.13));
  },
  /** correct round: small celebration (bell ≤ 0.6 s, 4 variations) */
  chime() {
    const v = variant('chime', 4);
    play((o) => drawChime(o, v));
  },
  /** end of activity: bell and short applause (≤ 3 s, 3 variations) */
  win() {
    audioLog('sfx', 'win');
    const v = variant('win', 3);
    play((o) => drawWin(o, v));
  },
  /** milestone (new level confirmed, mission complete): audience, whistle, confetti poppers (≤ 5 s, 2 variations) */
  celebrate() {
    audioLog('sfx', 'celebrate');
    const v = variant('celebrate', 2);
    play((o) => drawCelebrate(o, v));
  },
  /** mistake: on purpose, NO sound (research advises against «failure» sounds); the voice and the hint are enough */
  soft() {
    /* silence */
  },
  /** a tap skips the celebration: effects in progress fade out in ~0.15 s */
  hush() {
    // skipping the celebration: the pending sentence comes right away (it is the information; the applause was the celebration)
    if (pendingCheer) {
      const run = pendingCheer.run;
      window.clearTimeout(pendingCheer.timer);
      pendingCheer = null;
      run();
    }
    if (!ctx || !bus) return;
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    bus = null; // the next effect uses a new bus
  },
};

/**
 * SILENT check (tests): renders the effect into an OfflineAudioContext and measures the result.
 * Nothing comes out of the speakers.
 */
async function renderSound(name: keyof typeof SOUNDS): Promise<AudioBuffer> {
  const seconds = name === 'celebrate' ? 6 : name === 'chime' ? 1.5 : 4;
  const a = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  SOUNDS[name]({ a, dest: limiter(a), t0: 0 }, 0);
  return a.startRendering();
}

/** For parents to listen whenever they like: the effect becomes a WAV file (base64), without playing anything. */
export async function exportSoundWav(name: keyof typeof SOUNDS): Promise<string> {
  const buf = await renderSound(name);
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = buf.length;
  const view = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 2; c++) view.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, (ch[c] as Float32Array)[i] as number)) * 32767, true);
  let bin = '';
  const bytes = new Uint8Array(view.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function measureSound(name: keyof typeof SOUNDS): Promise<{ seconds: number; audible: number; peak: number; rms: number }> {
  const buf = await renderSound(name);
  const seconds = buf.duration;
  let peak = 0;
  let sum = 0;
  let lastLoud = 0;
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i] as number);
    peak = Math.max(peak, v);
    sum += v * v;
    if (v > 0.02) lastLoud = i;
  }
  // «audible»: how long the sound can still be heard (amplitude > 0.02) — to check the research's maximum durations
  return { seconds, audible: lastLoud / buf.sampleRate, peak, rms: Math.sqrt(sum / d.length) };
}

// ------------------------------------------------------------------ voice

let voice: SpeechSynthesisVoice | null = null;
const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

function rank(v: SpeechSynthesisVoice): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (!lang.startsWith('fr')) return -1;
  let score = 1;
  if (lang === 'fr-ca') score += 10;
  if (/natural/i.test(v.name)) score += 5;
  if (/sylvie/i.test(v.name)) score += 2;
  if (v.localService) score += 1;
  return score;
}

function pickVoice() {
  if (!hasSpeech) return;
  const best = window.speechSynthesis
    .getVoices()
    .map((v) => ({ v, r: rank(v) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)[0];
  voice = best?.v ?? null;
}
if (hasSpeech) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

function utter(text: string, rate: number, pitch: number): SpeechSynthesisUtterance | null {
  if (!voice) return null;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  u.pitch = pitch;
  // effects below the voice while it speaks
  u.onstart = () => duck(true);
  u.onend = () => duck(false);
  // cancelled speech (leaving the game, mute button, another utterance) fires «error/interrupted», not «end»:
  // without this, the effects stayed low until the next utterance ended normally
  u.onerror = () => duck(false);
  return u;
}

/**
 * Log of audio events (so the browser test can check the ORDER: applause, then speech). The voice is disabled
 * in tests, so this log is the only way to see when speech would start. Keeps only the last 40.
 */
function audioLog(ev: 'sfx' | 'cheer' | 'en', what: string) {
  try {
    const w = window as unknown as { __melinaAudioLog?: Array<{ ev: string; what: string; t: number }> };
    const log = (w.__melinaAudioLog ??= []);
    log.push({ ev, what, t: performance.now() });
    if (log.length > 40) log.shift();
  } catch {
    /* no window (unit tests) */
  }
}

/** Applause length for each celebration (measured: end 1.7 s; milestone 3.3 s) + a margin: speech only starts after. */
export const APPLAUSE_MS = { win: 1900, celebrate: 3500 } as const;
let pendingCheer: { timer: number; run: () => void } | null = null;
function cancelPendingCheer() {
  if (pendingCheer) window.clearTimeout(pendingCheer.timer);
  pendingCheer = null;
}

/**
 * Celebration with speech: the applause plays in FULL and Lila speaks right after (before, they played together and the applause
 * sat at 30 % volume under the voice, almost inaudible). A tap that skips the celebration (`sfx.hush`) brings the sentence immediately;
 * leaving the game (`stopSpeaking`) cancels the pending sentence.
 */
export function cheerAfter(sound: keyof typeof APPLAUSE_MS, shout: string, then = '') {
  cancelPendingCheer();
  sfx[sound]();
  const run = () => {
    pendingCheer = null;
    cheer(shout, then);
  };
  pendingCheer = { timer: window.setTimeout(run, APPLAUSE_MS[sound]), run };
}

export function speak(text: string) {
  cancelPendingCheer(); // a new utterance replaces the sentence that was waiting for the applause
  if (muted || !hasSpeech) return;
  if (!voice) pickVoice();
  if (!voice) return; // no French voice: better to stay silent than to read with the wrong accent
  try {
    window.speechSynthesis.cancel();
    const u = utter(text, 0.9, 1.05);
    if (u) window.speechSynthesis.speak(u);
  } catch {
    /* speech is an extra: it never interrupts the game */
  }
}

/**
 * Spoken celebration: a reaction word, then the sentence (research: rate ~0.9, pitch 1.0–1.1,
 * no «squeaky» voice).
 * Never says the child's name: Edge's natural voice may be an online service (rule 4).
 */
export function cheer(shout: string, then = '') {
  audioLog('cheer', shout);
  if (muted || !hasSpeech) return;
  if (!voice) pickVoice();
  if (!voice) return;
  try {
    window.speechSynthesis.cancel();
    const a = utter(shout, 0.95, 1.1);
    if (a) window.speechSynthesis.speak(a);
    const b = then ? utter(then, 0.9, 1.05) : null;
    if (b) window.speechSynthesis.speak(b);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  cancelPendingCheer();
  try {
    if (hasSpeech) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  duck(false);
}

/** For the parents' panel: which voice is in use. */
export function voiceInfo(): { available: boolean; name: string; canadian: boolean; natural: boolean } {
  if (!voice) pickVoice();
  return {
    available: Boolean(voice),
    name: voice?.name ?? '',
    canadian: voice ? voice.lang.replace('_', '-').toLowerCase() === 'fr-ca' : false,
    natural: voice ? /natural/i.test(voice.name) : false,
  };
}

// ------------------------------------------------------------------ English voice (listening games)

let enVoice: SpeechSynthesisVoice | null = null;

function rankEnglish(v: SpeechSynthesisVoice): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  let score = 1;
  if (lang === 'en-ca') score += 10;
  else if (lang === 'en-us') score += 6;
  if (/natural/i.test(v.name)) score += 5;
  if (v.localService) score += 1;
  return score;
}

function pickEnglishVoice() {
  if (!hasSpeech) return;
  const best = window.speechSynthesis
    .getVoices()
    .map((v) => ({ v, r: rankEnglish(v) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)[0];
  enVoice = best?.v ?? null;
}
if (hasSpeech) {
  pickEnglishVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickEnglishVoice);
}

/** Rates of the English voice: normal listening, and the slower replay (research: ~0.85–0.9 of normal speed). */
export const EN_RATE = { normal: 0.85, slow: 0.62 } as const;

/**
 * Says English text with the English voice. `queue`: after what is being said (the French instruction first, then
 * the English word). Never says the child's name (Edge's natural voices may be an online service: rule 4); it only
 * says words of the game.
 */
export function speakEnglish(text: string, opts: { slow?: boolean; queue?: boolean } = {}) {
  audioLog('en', `${opts.slow ? 'slow:' : ''}${text}`);
  if (muted || !hasSpeech) return;
  if (!enVoice) pickEnglishVoice();
  if (!enVoice) return;
  try {
    if (!opts.queue) {
      cancelPendingCheer();
      window.speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = enVoice;
    u.lang = enVoice.lang;
    u.rate = opts.slow ? EN_RATE.slow : EN_RATE.normal;
    u.pitch = 1;
    u.onstart = () => duck(true);
    u.onend = () => duck(false);
    u.onerror = () => duck(false);
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is an extra: it never interrupts the game */
  }
}

/** For the parents' panel and the listening games: which English voice is in use. */
export function englishVoiceInfo(): { available: boolean; name: string; canadian: boolean; natural: boolean } {
  if (!enVoice) pickEnglishVoice();
  return {
    available: Boolean(enVoice),
    name: enVoice?.name ?? '',
    canadian: enVoice ? enVoice.lang.replace('_', '-').toLowerCase() === 'en-ca' : false,
    natural: enVoice ? /natural/i.test(enVoice.name) : false,
  };
}

/** The browser loads its voices a little after the page: waits up to `ms` for an English voice. */
export function waitForEnglishVoice(ms = 2500): Promise<boolean> {
  if (englishVoiceInfo().available || !hasSpeech) return Promise.resolve(englishVoiceInfo().available);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', check);
      window.clearTimeout(timer);
      resolve(englishVoiceInfo().available);
    };
    const check = () => {
      if (englishVoiceInfo().available) done();
    };
    const timer = window.setTimeout(done, ms);
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
  });
}
