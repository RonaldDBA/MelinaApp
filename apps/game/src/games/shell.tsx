import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { i18n, type Rect } from '@melina/shared';
import { api, type GameRound } from '../api';
import { cheer, cheerAfter, isMuted, setMuted, sfx, speak, stopSpeaking } from '../audio';
import { conquestPhrase, endPhrase, milestonePhrase, successPhrase, wrongOpener, almostPhrase } from '../praise';
import { approvedClip, art, icon } from '../stage/art';
import { at } from '../stage/Stage';

/** Parts shared by all the stage mini-games: rounds, bar, guide, keypad and panels. */

export type RoundStatus = 'loading' | 'playing' | 'result' | 'end' | 'error';
type AnswerResult = Awaited<ReturnType<typeof api.answerRound>>;

/**
 * Game timers that go away with it: after leaving the game, no «Dix!» or glow fires on the home screen.
 * `later(fn, ms, key)`: with the same key, the previous timer is replaced (a 2nd «Un indice» does not clear
 * the new glow too early).
 */
export function useLater() {
  const timers = useRef(new Map<string, number>());
  const anon = useRef(new Set<number>());
  useEffect(
    () => () => {
      for (const id of timers.current.values()) window.clearTimeout(id);
      for (const id of anon.current) window.clearTimeout(id);
    },
    [],
  );
  return useCallback((fn: () => void, ms: number, key?: string) => {
    if (key) {
      const old = timers.current.get(key);
      if (old !== undefined) window.clearTimeout(old);
    }
    const id = window.setTimeout(() => {
      if (key) timers.current.delete(key);
      else anon.current.delete(id);
      fn();
    }, ms);
    if (key) timers.current.set(key, id);
    else anon.current.add(id);
  }, []);
}

/** A repeated key (holding Enter) does not count: the mistake explanation does not vanish and the round does not skip. */
export const repeated = (e: KeyboardEvent) => e.repeat;

/**
 * How focus reached the button: tap/click or Tab. (`:focus-visible` cannot be trusted: Enter itself
 * may switch the browser to «keyboard mode» before our shortcut reads the state.)
 */
let reachedByKeyboard = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => (reachedByKeyboard = false), true);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') reachedByKeyboard = true;
  }, true);
}

/**
 * Enter with focus on a NAVIGATION button (little house, sound, «Accueil», «Un défi») REACHED WITH TAB does what that
 * button says. After a tap/click (on mute, a stone, a key, «Écouter»), focus stays on the button, but
 * Enter still validates/continues.
 */
export const focusedControl = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  if (!el?.closest?.('.hud-btn, .end-actions button') || el.closest('[data-next]')) return false;
  return reachedByKeyboard;
};

export function useRounds(gameId: string, total: number, intro: (r: GameRound) => string) {
  const [status, setStatus] = useState<RoundStatus>('loading');
  const [round, setRound] = useState<GameRound | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  /** milestone in this round (new level confirmed): big celebration */
  const [milestone, setMilestone] = useState<number | null>(null);
  /** short title of the result panel (a varied marker, not a fixed «Bravo!») */
  const [headline, setHeadline] = useState('');
  const sessionId = useRef<string | undefined>(undefined);
  /** first-try successes in this session (competence information, not currency) */
  const [firstTries, setFirstTries] = useState(0);
  /** she chose «un défi plus difficile» for this session */
  const challenge = useRef(false);
  const introRef = useRef(intro);
  const inFlight = useRef(false); // an answer is on its way to the server
  const lastLevel = useRef<number | null>(null); // level of the previous round on this screen (also across «Encore»)
  introRef.current = intro;
  /** is the game still on screen? (a response arriving after leaving neither speaks nor plays sounds on the home screen) */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const later = useLater();

  const say = useCallback((text: string) => {
    setMessage(text);
    speak(text);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setMilestone(null);
    try {
      const r = await api.startRound(gameId, sessionId.current, challenge.current);
      if (!alive.current) return;
      if (r.sessionId) sessionId.current = r.sessionId;
      setRound(r);
      setStatus('playing');
      // the session climbs with her (staircase on the server): she hears that it is getting harder, so the challenge
      // is visible and means «you know more», not a punishment
      const level = r.exercise.difficulty ?? 1;
      const climbed = lastLevel.current !== null && level > lastLevel.current;
      lastLevel.current = level;
      say(`${climbed ? `${i18n.child.levelUp} ` : ''}${introRef.current(r)}`);
    } catch (e) {
      if (!alive.current) return;
      // the technical detail (from the server) stays in the console; the child sees French
      console.error('[jeu]', (e as Error).message);
      setError((e as { code?: string }).code === 'offline' ? i18n.child.serverDown : i18n.child.gameLoadError);
      setStatus('error');
    }
  }, [gameId, say]);

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, [load]);

  /** Sends the answer. On a mistake with another try left, returns the clue so the game can react. */
  const submit = useCallback(
    async (answer: string): Promise<AnswerResult | null> => {
      // `busy` comes from the last render: two very fast taps (same frame) would both see it false and send two answers.
      // The ref blocks a second answer while the first one is on its way.
      if (!round || busy || inFlight.current || status !== 'playing' || answer.length === 0) return null;
      inFlight.current = true;
      setBusy(true);
      try {
        const r = await api.answerRound(round.id, answer);
        if (!alive.current) return null;
        setRound(r.round);
        if (r.state === 'retry' && r.feedback) {
          // no mistake sound (research): the calm voice, the astuce and the visual highlight are enough
          setShake(true);
          later(() => setShake(false), 500, 'shake');
          say(r.feedback.message);
        } else if (r.round.outcome) {
          const o = r.round.outcome;
          if (o.result === 'correct' && o.help === 'none') setFirstTries((n) => n + 1);
          setStatus('result');
          if (o.result === 'correct') {
            // proportional celebration (research): correct = short bell + short varied sentence; new level = big celebration
            const mc = o.masteryChange;
            const up = mc && mc.levelAfter > mc.levelBefore ? mc.levelAfter : null;
            setMilestone(up ?? (o.conquered ? -1 : null)); // -1 = weak spot overcome (also a big celebration)
            if (o.conquered && !up) {
              const p = conquestPhrase(o.conquered.label);
              setHeadline('🌟 Point fort gagné!');
              setMessage(p);
              cheerAfter('celebrate', p); // full applause, then the sentence
            } else if (up) {
              const p = milestonePhrase();
              setHeadline(`🚀 Nouveau niveau ${up}!`);
              setMessage(p);
              cheerAfter('celebrate', 'Nouveau niveau!', p);
            } else {
              const p = successPhrase({ strategy: o.praise, afterError: o.help !== 'none', hard: (r.round.exercise.difficulty ?? 1) >= 4 || challenge.current, streak: firstTries });
              // weak spot almost overcome: just one extra sentence; the big celebration waits for confirmation on another day
              const spoken = o.almost ? `${p.spoken} ${almostPhrase(o.almost.label)}` : p.spoken;
              sfx.chime();
              setHeadline(p.headline);
              setMessage(spoken);
              cheer(spoken, '');
            }
          } else {
            const p = wrongOpener();
            setHeadline(p);
            say(`${p} ${o.explanation}`);
          }
        }
        return r;
      } catch (e) {
        if (!alive.current) return null;
        // as when loading: the technical detail goes to the console; the child sees a gentle sentence in French
        console.error('[réponse]', (e as Error).message);
        setMessage((e as { code?: string }).code === 'offline' ? i18n.child.serverDown : i18n.child.sendError);
        return null;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [round, busy, status, say, firstTries, later],
  );

  const next = useCallback(
    (endMessage: string) => {
      if (roundIndex + 1 >= total) {
        setStatus('end');
        setMilestone(null); // the end confetti is the activity's, it does not inherit the size of the last round
        // activity complete: bell and short applause (the big celebration is kept for milestones: new level, mission)
        const p = endPhrase();
        const text = `${p} ${endMessage.replace(/^Bravo!\s*/, '')}`.trim();
        setMessage(text);
        cheerAfter('win', text); // full applause (~1.7 s), then Lila speaks
      } else {
        setRoundIndex((i) => i + 1);
        void load();
      }
    },
    [roundIndex, total, load],
  );

  const replay = useCallback(
    (harder = false) => {
      challenge.current = harder;
      sessionId.current = undefined;
      setRoundIndex(0);
      setFirstTries(0);
      void load();
    },
    [load],
  );

  /** Shows one sentence in the bubble and speaks ANOTHER (e.g. dictation: the word is spoken but not written on screen). */
  const sayApart = useCallback((shown: string, spoken: string) => {
    setMessage(shown);
    speak(spoken);
  }, []);

  return { status, round, roundIndex, total, firstTries, message, error, busy, shake, milestone, headline, say, sayApart, load, submit, next, replay };
}

export type Rounds = ReturnType<typeof useRounds>;

export function GameHud({ title, rounds, onExit }: { title: string; rounds: Rounds; onExit: () => void }) {
  const [muted, setMutedState] = useState(isMuted());
  const toggle = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  return (
    <header className="hud">
      <button className="hud-btn" onClick={onExit} aria-label="Retour à l’accueil">
        <img src={icon('house')} alt="" />
      </button>
      <h1>{title}</h1>
      <div className="hud-right">
        <div className="round-dots" aria-label={`Manche ${Math.min(rounds.roundIndex + 1, rounds.total)} sur ${rounds.total}`}>
          {Array.from({ length: rounds.total }, (_, i) => (
            <span key={i} className={i < rounds.roundIndex || rounds.status === 'end' ? 'done' : i === rounds.roundIndex ? 'now' : ''} />
          ))}
        </div>
        <button className="hud-btn" onClick={toggle} aria-label={muted ? 'Activer le son' : 'Couper le son'} aria-pressed={muted}>
          <img src={icon(muted ? 'muted_speaker' : 'speaker_high_volume')} alt="" />
        </button>
      </div>
    </header>
  );
}

export function Guide({ message, mood = 'idle', hidden = false }: { message: string; mood?: 'idle' | 'happy' | 'thinking'; hidden?: boolean }) {
  // correct answer: with a clip approved by the parents, Lila dances in the video (always muted); without a clip, the usual animation applies
  const clip = mood === 'happy' ? approvedClip('lila.dance') : null;
  return (
    <div className="guide" data-mood={mood}>
      {clip ? (
        <video className="lila lila-clip" src={clip} autoPlay loop muted playsInline disablePictureInPicture aria-label="Lila danse" data-testid="lila-clip" />
      ) : (
        <img className="lila" src={art(`lila.${mood}`)} alt="Lila" draggable={false} />
      )}
      {message && !hidden && (
        <div className="bubble" aria-live="polite">
          <span>{message}</span>
          <button className="say-btn" onClick={() => speak(message)} aria-label="Réécouter">
            <img src={icon('speaker_high_volume')} alt="" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  if (n <= 0) return null; // answer shown: no dimmed star in sight (no «failure»)
  return (
    <span className="stars" aria-label={`${n} étoiles sur ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <img key={i} src={icon('star')} alt="" className={i < n ? 'on' : 'off'} style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

const CONFETTI_COLORS = ['#ff4f6d', '#ffc52e', '#2fd18b', '#3d9bff', '#a875ff', '#ff8a3d', '#ff6fc8', '#ffffff'];
const SHAPES = ['rect', 'rect', 'ribbon', 'circle', 'star'] as const;

/**
 * Confetti. `big` (activity complete): two cannons in the bottom corners + a long, dense shower.
 * `fixed`: covers the whole window (cards outside the stage). Sizes in cqw/cqh: they work on the stage and in the window.
 */
export function Confetti({ big = false, fixed = false, small = false }: { big?: boolean; fixed?: boolean; small?: boolean }) {
  const pieces = useMemo(() => {
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const rain = Array.from({ length: big ? 150 : small ? 26 : 70 }, (_, i) => ({
      kind: 'rain' as const,
      x: r(0, 100),
      delay: r(0, big ? 1.8 : 0.6),
      dur: r(2.6, 4.4),
      sway: r(1.5, 4),
      swayDur: r(0.8, 1.6),
      spin: r(0.5, 1.4),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as string,
      shape: SHAPES[i % SHAPES.length] as string,
      size: r(0.7, 1.3),
    }));
    const burst = big
      ? Array.from({ length: 110 }, (_, i) => {
          const left = i % 2 === 0;
          return {
            kind: 'burst' as const,
            x: left ? 2 : 98,
            dx: (left ? 1 : -1) * r(8, 46),
            dy: -r(45, 95),
            delay: r(0, 0.25),
            dur: r(2.6, 3.8),
            spin: r(0.4, 1),
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as string,
            shape: SHAPES[i % SHAPES.length] as string,
            size: r(0.7, 1.3),
          };
        })
      : [];
    return [...burst, ...rain];
  }, [big, small]);
  return (
    <div className={`confetti ${fixed ? 'fixed' : ''} ${big ? 'big' : ''}`} aria-hidden="true" data-testid="confetti">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`cf ${p.kind}`}
          style={
            {
              left: `${p.x}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ...(p.kind === 'burst' ? { '--dx': `${p.dx}cqw`, '--dy': `${p.dy}cqh` } : {}),
            } as CSSProperties
          }
        >
          <span className="sway" style={p.kind === 'rain' ? ({ '--sway': `${p.sway}cqw`, animationDuration: `${p.swayDur}s` } as CSSProperties) : undefined}>
            <span className={`piece ${p.shape}`} style={{ background: p.color, color: p.color, animationDuration: `${p.spin}s`, scale: String(p.size) }} />
          </span>
        </span>
      ))}
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
const WIDE_KEYS = ['1', '2', '3', '4', '5', 'del', '6', '7', '8', '9', '0', 'ok'];

/** Question panel with a number keypad. Also accepts the computer keyboard. */
export function NumberQuestion({ rect, rounds, onRetry, maxLength = 4, wide = false }: { rect: Rect; rounds: Rounds; onRetry?: (r: AnswerResult) => void; maxLength?: number; wide?: boolean }) {
  const [input, setInput] = useState('');
  const { round, busy, submit } = rounds;

  const press = useCallback(
    (k: string) => {
      if (busy) return;
      if (k === 'ok') {
        if (input.length === 0) return;
        void submit(input).then((r) => {
          if (r?.state === 'retry') {
            setInput('');
            onRetry?.(r);
          }
        });
        return;
      }
      sfx.tap();
      if (k === 'del') setInput((v) => v.slice(0, -1));
      else setInput((v) => (v.length >= maxLength ? v : v + k));
    },
    [busy, input, submit, onRetry, maxLength],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (repeated(e)) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') {
        if (focusedControl(e)) return;
        e.preventDefault();
        press('ok');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (!round) return null;
  return (
    <div className={`panel question ${wide ? 'wide' : ''} ${rounds.shake ? 'shake' : ''}`} style={at(rect)} role="group" aria-label="Réponse">
      <p className="q-text">{round.exercise.statement}</p>
      <div className="answer-box" aria-live="polite" data-testid="answer">
        {input || <span className="placeholder">?</span>}
      </div>
      <div className="numpad">
        {(wide ? WIDE_KEYS : KEYS).map((k) => (
          <button key={k} type="button" className={`key ${k === 'ok' ? 'ok' : k === 'del' ? 'del' : ''}`} onClick={() => press(k)} disabled={busy || (k === 'ok' && input.length === 0)} aria-label={k === 'ok' ? 'Valider' : k === 'del' ? 'Effacer' : k}>
            {k === 'ok' ? '✓' : k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <p className="tries">{round.triesLeft < 3 ? 'Prends ton temps et relis l’astuce de Lila.' : 'Tu peux aussi utiliser le clavier.'}</p>
    </div>
  );
}

/** Choice games: a wrong option stays marked and cannot be picked again in the same round. */
export function useChoices(rounds: Rounds) {
  // wrong options only apply to the round in which they were picked: they change together with the round id, in the same
  // frame (before, an effect reset them AFTER the render and the new round appeared with options pressed in)
  const id = rounds.round?.id;
  const [marks, setMarks] = useState<{ id: string | undefined; list: string[] }>({ id: undefined, list: [] });
  const wrong = useMemo(() => (marks.id === id ? marks.list : []), [marks, id]);
  const setWrong = useCallback((f: (w: string[]) => string[]) => setMarks((m) => ({ id, list: f(m.id === id ? m.list : []) })), [id]);
  const { busy, status, submit } = rounds;
  const choose = useCallback(
    async (option: string) => {
      if (busy || status !== 'playing' || wrong.includes(option)) return;
      sfx.tap();
      const r = await submit(option);
      if (r?.state === 'retry') setWrong((w) => [...w, option]);
    },
    [busy, status, submit, wrong],
  );
  return { wrong, choose, helped: wrong.length >= 2 };
}

/** Result panel for a round. Enter also continues. */
/**
 * Fits a panel's content inside the panel: when the content is taller or wider than the panel (long explanation,
 * small panel such as the train's), it is scaled down proportionally instead of spilling over the scene and the
 * guide's bubble. Re-measured whenever the content changes size (fonts loading, new round).
 */
function useFitToPanel() {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const measure = () => {
      const cs = getComputedStyle(b);
      const h = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const w = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const k = Math.min(1, h / Math.max(1, i.scrollHeight), w / Math.max(1, i.scrollWidth));
      setScale(Math.floor(k * 1000) / 1000);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(i);
    return () => ro?.disconnect();
  }, []);
  return { box, inner, innerStyle: scale < 1 ? ({ transform: `scale(${scale})` } as CSSProperties) : undefined };
}

/** Panels shorter than this use the compact layout (smaller stars, title and text). */
const COMPACT_PANEL_H = 600;

export function ResultPanel({ rect, rounds, endMessage, children }: { rect: Rect; rounds: Rounds; endMessage: string; children?: ReactNode }) {
  const outcome = rounds.round?.outcome;
  const go = useCallback(() => {
    sfx.hush(); // a tap skips the celebration (research: the celebration must not hold the child back)
    rounds.next(endMessage);
  }, [rounds, endMessage]);
  useEnter(go);
  const fit = useFitToPanel();
  if (!outcome) return null;
  return (
    <div ref={fit.box} className={`panel result ${outcome.result} ${rect.h < COMPACT_PANEL_H ? 'compact' : ''}`} style={at(rect)} role="status" onPointerDown={() => sfx.hush()}>
      <div ref={fit.inner} className="fit" style={fit.innerStyle}>
      <Stars n={outcome.stars} />
      <h2>{rounds.headline || (outcome.result === 'correct' ? 'Bravo!' : 'On regarde ensemble')}</h2>
      {/* after an error or a hint the headline already praises persistence: no second line saying the same thing */}
      {outcome.result === 'correct' && outcome.help === 'none' && outcome.praise && <p className="q-text small praise">{outcome.praise}</p>}
      {outcome.result === 'correct' && outcome.almost && (
        <p className="q-text small almost" data-testid="almost">
          🌱 {almostPhrase(outcome.almost.label)}
        </p>
      )}
      {children ?? <p className="big-number">{outcome.correctAnswerDisplay}</p>}
      <p className="q-text small">{outcome.explanation}</p>
      <button className="big-btn" onClick={go} data-next>
        {rounds.roundIndex + 1 >= rounds.total ? 'Terminer' : 'Continuer'} ➜
      </button>
      </div>
    </div>
  );
}

export function EndPanel({ rect, rounds, image, title, text, onExit }: { rect: Rect; rounds: Rounds; image: string; title: string; text: string; onExit: () => void }) {
  useEnter(() => rounds.replay(false));
  const fit = useFitToPanel();
  return (
    <div ref={fit.box} className="panel end" style={at(rect)} role="status">
      <div ref={fit.inner} className="fit" style={fit.innerStyle}>
      <img className="end-art" src={image} alt="" />
      <h2>{title}</h2>
      <p className="q-text small">{text}</p>
      <p className="end-stars">
        🌱 {rounds.total} défis faits, dont {rounds.firstTries} réussi{rounds.firstTries > 1 ? 's' : ''} du premier coup
      </p>
      <div className="end-actions">
        <button className="big-btn secondary" onClick={onExit}>
          Accueil
        </button>
        <button className="big-btn" onClick={() => rounds.replay(false)} data-next>
          Rejouer ➜
        </button>
        {rounds.firstTries >= 2 && (
          <button className="big-btn challenge" onClick={() => rounds.replay(true)} data-testid="challenge">
            🚀 Un défi plus difficile?
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export function ErrorPanel({ rect, rounds }: { rect: Rect; rounds: Rounds }) {
  return (
    <div className="panel" style={at(rect)}>
      <p className="q-text">Oups! {rounds.error}</p>
      <button className="big-btn" onClick={() => void rounds.load()}>
        Réessayer
      </button>
    </div>
  );
}

function useEnter(fn: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (repeated(e) || focusedControl(e)) return;
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fn]);
}
