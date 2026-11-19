import { useCallback, useEffect, useState } from 'react';
import type { NumberPathSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/number-path.json';
import { sfx } from '../audio';
import { approvedArt, art, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, focusedControl, repeated, useRounds } from './shell';

/**
 * « Le chemin des nombres » — fill in the empty stones of a number path.
 * Levels 1 and 2: stones in a row. Level 3: a hidden piece of the hundred grid (only the path shows).
 * The child picks an empty stone and types; «Valider» sends them all at once.
 * On a mistake, the server says which stones are right: they turn green and locked.
 */

const END = 'Bravo! Tu as trouvé tous les nombres du chemin.';
const zones = scene.zones as Record<'linePanel' | 'gridPanel' | 'lineResult' | 'gridResult' | 'endPanel', Rect>;
const SIZE = scene.line.stoneSize;
const KEYS = ['1', '2', '3', '4', '5', 'del', '6', '7', '8', '9', '0', 'ok'];

function cellRect(spec: NumberPathSpec, i: number): Rect {
  const c = spec.cells[i] as NumberPathSpec['cells'][number];
  if (spec.layout === 'grid') {
    const g = scene.grid;
    return { x: g.x + (c.col ?? 0) * (g.cell + g.gap), y: g.y + (c.row ?? 0) * (g.cell + g.gap), w: g.cell, h: g.cell };
  }
  const p = scene.line.stones[i] as { x: number; y: number };
  return { x: p.x, y: p.y, w: SIZE, h: SIZE };
}

/** Label of the step between two stones: in the row, deduced from the visible numbers; in the grid, from the position. */
function stepLabel(spec: NumberPathSpec, i: number): string {
  if (spec.layout === 'grid') {
    const a = spec.cells[i - 1] as { row?: number; col?: number };
    const b = spec.cells[i] as { row?: number; col?: number };
    const d = ((b.row ?? 0) - (a.row ?? 0)) * 10 + ((b.col ?? 0) - (a.col ?? 0));
    return d > 0 ? `+${d}` : `−${-d}`;
  }
  const vis = spec.cells.map((c, k) => ({ v: c.value, k })).filter((x) => x.v !== null) as Array<{ v: number; k: number }>;
  const a = vis[0];
  const b = vis[vis.length - 1];
  const step = a && b && b.k !== a.k ? Math.round((b.v - a.v) / (b.k - a.k)) : 1;
  return step > 0 ? `+${step}` : `−${-step}`;
}

export function NumberPath({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.number-path', 3, (r) => `${r.exercise.instruction} ${r.exercise.statement}`);
  const { round, status, busy, submit } = rounds;
  const spec = round?.exercise.game as NumberPathSpec | undefined;
  const outcome = round?.outcome ?? null;
  const holes = spec ? spec.cells.map((c, i) => (c.value === null ? i : -1)).filter((i) => i >= 0) : [];
  const [vals, setVals] = useState<string[]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [sel, setSel] = useState(0);
  const [help, setHelp] = useState(false);

  // new round: everything empty, first empty stone selected
  useEffect(() => {
    setVals(holes.map(() => ''));
    setLocked(holes.map(() => false));
    setSel(0);
    setHelp(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id]);

  const move = useCallback(
    (dir: 1 | -1) => {
      if (holes.length === 0) return;
      let k = sel;
      for (let n = 0; n < holes.length; n++) {
        k = (k + dir + holes.length) % holes.length;
        if (!locked[k]) break;
      }
      setSel(k);
    },
    [sel, holes.length, locked],
  );

  const press = useCallback(
    (key: string) => {
      if (busy || status !== 'playing' || holes.length === 0) return;
      if (key === 'ok') {
        const empty = vals.findIndex((v, k) => !locked[k] && v === '');
        if (empty >= 0) {
          setSel(empty);
          rounds.say('Il manque encore un nombre sur le chemin.');
          return;
        }
        void submit(vals.join(',')).then((r) => {
          if (r?.state !== 'retry' || !r.feedback) return;
          const ok = r.feedback.slots ?? holes.map(() => false);
          setLocked(ok);
          setVals((v) => v.map((x, k) => (ok[k] ? x : '')));
          const first = ok.findIndex((x) => !x);
          setSel(first >= 0 ? first : 0);
          if (r.feedback.showCounting) setHelp(true);
        });
        return;
      }
      if (locked[sel]) return;
      sfx.tap();
      setVals((v) =>
        v.map((x, k) => {
          if (k !== sel) return x;
          if (key === 'del') return x.slice(0, -1);
          return x.length >= 4 ? x : x + key; // level 6: thousands
        }),
      );
    },
    [busy, status, holes, vals, locked, sel, submit, rounds],
  );

  useEffect(() => {
    if (status !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') {
        if (repeated(e) || focusedControl(e)) return;
        e.preventDefault();
        press('ok');
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        // Tab stays free so the keyboard can reach the bar buttons (home, sound); arrows and space switch stones
        e.preventDefault();
        move(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, move, status]);

  const shown = outcome ? outcome.correctAnswerDisplay.split(', ') : null;
  const stoneArt = approvedArt('path.stone');
  const grid = spec?.layout === 'grid';
  const panel = grid ? zones.gridPanel : zones.linePanel;

  return (
    <Stage background={art(scene.background)} className="game path-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="Le chemin des nombres" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.linePanel} rounds={rounds} />}

      {spec && (status === 'playing' || status === 'result') && (
        <>
          {grid && spec.grid && (
            <div className="path-grid" style={at({ x: scene.grid.x - 18, y: scene.grid.y - 18, w: spec.grid.cols * (scene.grid.cell + scene.grid.gap) - scene.grid.gap + 36, h: spec.grid.rows * (scene.grid.cell + scene.grid.gap) - scene.grid.gap + 36 })}>
              {Array.from({ length: spec.grid.rows * spec.grid.cols }, (_, k) => {
                const row = Math.floor(k / (spec.grid?.cols ?? 1));
                const col = k % (spec.grid?.cols ?? 1);
                if (spec.cells.some((c) => c.row === row && c.col === col)) return null;
                const g = scene.grid;
                return <span key={k} className="grid-hidden" style={at({ x: 18 + col * (g.cell + g.gap), y: 18 + row * (g.cell + g.gap), w: g.cell, h: g.cell })} />;
              })}
            </div>
          )}
          {!grid && <img className="path-basket" src={art('path.basket')} alt="" draggable={false} style={at(scene.line.basket)} data-solved={outcome?.result === 'correct' ? 'yes' : 'no'} />}

          {spec.cells.map((c, i) => {
            const r = cellRect(spec, i);
            const hole = holes.indexOf(i);
            const style = { ...at(r), animationDelay: `${i * 0.08}s`, ...(stoneArt ? { backgroundImage: `url("${stoneArt}")` } : {}) };
            if (hole < 0) {
              return (
                <div key={i} className={`path-stone ${grid ? 'tile' : ''} ${stoneArt ? 'with-art' : ''}`} style={style} data-cell={i}>
                  <span>{c.value}</span>
                </div>
              );
            }
            const value = shown ? shown[hole] : vals[hole];
            const state = shown ? (outcome?.result === 'correct' ? 'solved' : 'revealed') : locked[hole] ? 'locked' : hole === sel ? 'sel' : '';
            return (
              <button
                key={i}
                type="button"
                className={`path-stone hole ${grid ? 'tile' : ''} ${stoneArt ? 'with-art' : ''} ${state}`}
                style={style}
                data-cell={i}
                data-hole={hole}
                disabled={status !== 'playing' || locked[hole]}
                onClick={() => setSel(hole)}
                aria-label={`Caillou ${hole + 1} : ${value || 'vide'}`}
              >
                <span>{value || '?'}</span>
              </button>
            );
          })}

          {/* 2nd mistake: shows the step between neighbouring stones (+1, −1, +10, −10) */}
          {help &&
            spec.cells.map((_, i) => {
              if (i === 0) return null;
              const a = cellRect(spec, i - 1);
              const b = cellRect(spec, i);
              const horizontal = a.y === b.y;
              // grid: in the gap between cells, next to the edge (the number stays in the centre of the cell, unobstructed);
              // row: just above the midpoint between the two stones
              const x = grid && !horizontal ? a.x + a.w - 34 : (a.x + a.w / 2 + b.x + b.w / 2) / 2;
              const y = grid ? (horizontal ? a.y + a.h - 20 : (a.y + a.h / 2 + b.y + b.h / 2) / 2) : Math.min(a.y, b.y) - 20;
              return (
                <b key={`s${i}`} className={`step-chip ${grid ? 'small' : ''}`} style={{ left: x - (grid ? 34 : 46), top: y - (grid ? 20 : 26) }} data-testid="step-chip">
                  {stepLabel(spec, i)}
                </b>
              );
            })}
        </>
      )}

      {status === 'playing' && round && (
        <div className={`panel question wide path-pad ${grid ? 'grid' : ''} ${rounds.shake ? 'shake' : ''}`} style={at(panel)} role="group" aria-label="Réponse">
          <p className="q-text">{round.exercise.statement}</p>
          <div className="numpad">
            {KEYS.map((k) => (
              <button key={k} type="button" className={`key ${k === 'ok' ? 'ok' : k === 'del' ? 'del' : ''}`} onClick={() => press(k)} disabled={busy} aria-label={k === 'ok' ? 'Valider' : k === 'del' ? 'Effacer' : k}>
                {k === 'ok' ? '✓' : k === 'del' ? '⌫' : k}
              </button>
            ))}
          </div>
          <p className="tries">{round.triesLeft < 3 ? 'Prends ton temps et relis l’astuce de Lila.' : 'Touche un caillou vide, puis écris le nombre.'}</p>
        </div>
      )}

      {status === 'result' && outcome && (
        // in the row, the stones already show the right numbers and the explanation lists the path; in the grid, the answer comes in the panel
        <ResultPanel rect={grid ? zones.gridResult : zones.lineResult} rounds={rounds} endMessage={END}>
          {grid ? <p className="big-answer">{outcome.correctAnswerDisplay}</p> : <span hidden />}
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={art('path.basket')} title="Bravo, Melina!" text="Tu as complété tous les chemins de nombres." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
