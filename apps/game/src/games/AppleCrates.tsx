import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { crateRects, createRng, pileSpots, slotSpots, type AppleCratesSpec, type GridSpec, type Rect, type Spot } from '@melina/shared';
import scene from '../../../../content/scenes/apple-crates.json';
import { sfx, speak } from '../audio';
import { art, artGrid, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, NumberQuestion, ResultPanel, focusedControl, useLater, useRounds } from './shell';
import { playerName } from '../player';

const ROUNDS = 3;
const END = 'Merci! Grâce à toi, Lila peut préparer une tarte aux pommes!';
const zones = scene.zones as Record<'pile' | 'crates' | 'panel' | 'endPanel', Rect>;

interface Flight {
  key: number;
  slot: number;
  from: Spot;
  to: Spot;
}

const seedOf = (id: string, spec: AppleCratesSpec) => spec.loose * 31 + spec.packed * 7 + id.charCodeAt(0) * 131 + id.charCodeAt(1);

export function AppleCrates({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.apple-crates', ROUNDS, (r) => {
    const g = r.exercise.game as AppleCratesSpec;
    return g.packed > 0
      ? `Lila a déjà rempli ${g.packed} ${g.packed > 1 ? 'caisses' : 'caisse'}. Range les autres ${g.fruitLabel}! Clique sur les fruits.`
      : `Aide Lila à ranger les ${g.fruitLabel}! Clique sur les fruits. Chaque caisse contient dix ${g.fruitLabel}.`;
  });
  const { round, status } = rounds;
  const spec = round?.exercise.game as AppleCratesSpec | undefined;
  const roundId = round?.id ?? '';

  const [sent, setSent] = useState<number[]>([]); // fruits that have already left the blanket, in the order they left
  const [landed, setLanded] = useState(0); // fruits that have already reached the crates
  const [flights, setFlights] = useState<Flight[]>([]);
  const [asking, setAsking] = useState(false);
  const [counting, setCounting] = useState(false);
  const sentRef = useRef<number[]>([]);
  const flightKey = useRef(0);
  const arrived = useRef(new Set<number>());

  // new round: restart the sorting
  useEffect(() => {
    sentRef.current = [];
    setSent([]);
    setLanded(0);
    setFlights([]);
    setAsking(false);
    setCounting(false);
  }, [roundId]);

  const phase = status === 'playing' ? (asking ? 'question' : 'pack') : status;
  const fruitArt = art(`fruit.${spec?.fruit ?? 'red_apple'}`);
  const grid = (artGrid(scene.crate.art) ?? scene.crate.grid) as GridSpec;

  // ---------------------------------------------------------------- geometry (stage points)

  const pile = useMemo(() => (spec ? pileSpots(spec.loose, zones.pile, createRng(seedOf(roundId, spec)).next) : []), [spec, roundId]);
  const openCount = spec ? Math.ceil(spec.loose / 10) : 0;
  const rects = useMemo(() => (spec ? crateRects(spec.packed + openCount, zones.crates, scene.crate.aspect, scene.crate.gapX, scene.crate.gapY) : []), [spec, openCount]);
  const spots = useMemo(() => rects.map((r) => slotSpots(r, grid)), [rects, grid]);
  const slotAt = useCallback((slot: number): Spot | undefined => (spec ? spots[spec.packed + Math.floor(slot / 10)]?.[slot % 10] : undefined), [spec, spots]);

  // ---------------------------------------------------------------- sorting the fruits

  const later = useLater(); // timers cancelled when leaving the game
  const arrive = useCallback((slot: number, key: number) => {
    if (arrived.current.has(key)) return; // the animation end and the safety timer can both arrive
    arrived.current.add(key);
    setFlights((f) => f.filter((x) => x.key !== key));
    setLanded((l) => l + 1);
    sfx.pop(slot % 10);
    if (slot % 10 === 9) {
      later(() => {
        sfx.crate();
        speak('Dix!');
      }, 120);
    }
  }, [later]);

  const sendFruit = useCallback(
    (index: number) => {
      if (phase !== 'pack' || !spec || sentRef.current.includes(index)) return;
      const slot = sentRef.current.length;
      const from = pile[index];
      const to = slotAt(slot);
      if (slot >= spec.loose || !from || !to) return;
      sentRef.current = [...sentRef.current, index];
      setSent(sentRef.current);
      sfx.tap();
      const key = ++flightKey.current;
      setFlights((f) => [...f, { key, slot, from, to }]);
      // safety: if the animation does not run (background tab), the fruit arrives anyway
      later(() => arrive(slot, key), 900);
    },
    [phase, spec, pile, slotAt, arrive, later],
  );

  const sendNext = useCallback(() => {
    const next = pile.findIndex((_, i) => !sentRef.current.includes(i));
    if (next >= 0) sendFruit(next);
  }, [pile, sendFruit]);

  useEffect(() => {
    if (phase !== 'pack') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        if (focusedControl(e)) return;
        e.preventDefault();
        sendNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sendNext]);

  // all sorted → question
  useEffect(() => {
    if (phase === 'pack' && spec && landed === spec.loose) {
      const t = window.setTimeout(() => {
        setAsking(true);
        rounds.say(round?.exercise.statement ?? '');
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [landed, phase, spec, round, rounds]);

  const outcome = round?.outcome ?? null;
  useEffect(() => {
    if (status === 'result' && outcome && outcome.result !== 'correct') setCounting(true);
  }, [status, outcome]);

  // ---------------------------------------------------------------- drawing

  const started = spec ? Math.min(openCount, Math.max(1, Math.ceil(sent.length / 10) + (sent.length % 10 === 0 && sent.length > 0 && sent.length < spec.loose ? 1 : 0))) : 0;
  const crates = spec
    ? rects.slice(0, spec.packed + started).map((rect, i) => {
        const open = i - spec.packed;
        const filled = open < 0 ? 10 : Math.max(0, Math.min(10, landed - open * 10));
        return { rect, filled, spots: spots[i] ?? [], firstSlot: open < 0 ? null : open * 10 };
      })
    : [];

  let running = 0;
  const labels = crates.map((c, i) => {
    if (!spec) return '';
    if (spec.question === 'crates') return c.filled > 0 ? String(i + 1) : '';
    running += c.filled;
    return c.filled === 10 ? String(running) : c.filled > 0 ? `+${c.filled}` : '';
  });

  const inPlay = spec && status !== 'loading' && status !== 'error' && status !== 'end';

  return (
    <Stage background={art(scene.background)} className="game apple-game" data-phase={phase} data-remaining={spec ? spec.loose - landed : 0}>
      <GameHud title="Les caisses de pommes" rounds={rounds} onExit={onExit} />

      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.panel} rounds={rounds} />}

      {inPlay && (
        <>
          <img className="prop" src={art(scene.props.blanket.art)} style={at(scene.props.blanket)} alt="" draggable={false} />

          <section aria-label={`Fruits à ranger : ${spec.loose - sent.length}`}>
            {phase === 'pack' &&
              pile.map((p, i) => {
                const gone = sent.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`fruit ${gone ? 'gone' : ''}`}
                    data-fruit={i}
                    data-gone={gone ? '1' : undefined}
                    style={{ left: p.x - p.size / 2, top: p.y - p.size / 2, width: p.size, height: p.size, ['--rot' as string]: `${p.rot}deg` }}
                    onClick={() => sendFruit(i)}
                    tabIndex={-1}
                    aria-hidden={gone}
                    aria-label={`Ranger une ${spec.fruitLabel === 'poires' ? 'poire' : 'pomme'}`}
                  >
                    <img src={fruitArt} alt="" draggable={false} />
                  </button>
                );
              })}
          </section>

          <section aria-label="Caisses">
            {crates.map((c, ci) => (
              <div key={ci} className={`crate ${c.filled === 10 ? 'closed' : ''} ${counting && labels[ci] ? 'counted' : ''}`} data-crate={ci} style={at(c.rect)}>
                <img className="crate-art" src={art(scene.crate.art)} alt="" draggable={false} />
                {c.spots.map((s, si) => (
                  <div
                    key={si}
                    className="slot"
                    data-slot={c.firstSlot === null ? undefined : c.firstSlot + si}
                    style={{ left: s.x - c.rect.x - s.size / 2, top: s.y - c.rect.y - s.size / 2, width: s.size, height: s.size }}
                  >
                    {si < c.filled && <img src={fruitArt} alt="" draggable={false} />}
                  </div>
                ))}
                {c.filled === 10 && <span className="ten">10</span>}
                {c.filled < 10 && c.filled > 0 && phase === 'pack' && <span className="count">{c.filled}</span>}
                {counting && labels[ci] && (
                  <span className="count-label" style={{ animationDelay: `${ci * 0.35}s` }}>
                    {labels[ci]}
                  </span>
                )}
              </div>
            ))}
          </section>

          {flights.map((f) => (
            <img
              key={f.key}
              className="fruit-fly"
              src={fruitArt}
              alt=""
              style={{
                left: f.to.x - f.to.size / 2,
                top: f.to.y - f.to.size / 2,
                width: f.to.size,
                height: f.to.size,
                ['--dx' as string]: `${f.from.x - f.to.x}px`,
                ['--dy' as string]: `${f.from.y - f.to.y}px`,
                ['--s' as string]: f.from.size / f.to.size,
              }}
              onAnimationEnd={() => arrive(f.slot, f.key)}
            />
          ))}
        </>
      )}

      {phase === 'question' && <NumberQuestion rect={zones.panel} rounds={rounds} onRetry={(r) => r.feedback?.showCounting && setCounting(true)} />}
      {status === 'result' && <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END} />}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={icon('pie')} title={`Merci, ${playerName()}!`} text="Lila prépare une tarte aux pommes pour te remercier." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${roundId}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}

      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : phase === 'question' ? 'thinking' : 'idle'} hidden={status === 'end'} />
      {phase === 'pack' && <p className="kbd-hint">Clique sur un fruit — ou appuie sur la barre d’espace.</p>}
      <span className="sr-only" aria-live="polite">
        {phase === 'pack' ? `${landed} sur ${spec?.loose ?? 0} fruits rangés` : ''}
      </span>
    </Stage>
  );
}
