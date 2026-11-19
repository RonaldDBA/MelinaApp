import type { CSSProperties } from 'react';
import type { DominoFace, DominoSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/dominoes.json';
import { approvedArt, art, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useChoices, useRounds } from './shell';

/**
 * « Les dominos des nombres » — on the table, a domino with a free end; in the hand, 4 tiles.
 * Tap the tile whose left half shows the same number in another representation. One round = one match.
 */

const END = 'Bravo! Tous tes dominos sont bien attachés.';
const zones = scene.zones as Record<'result' | 'endPanel' | 'error', Rect>;

/** Pip positions on a 3×3 grid, like a real domino. */
const PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  7: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

function Face({ f }: { f: DominoFace }) {
  if (f.kind === 'dots') {
    return (
      <svg className="face dots" viewBox="0 0 100 100" role="img" aria-label={`${f.n} points`}>
        {(PIPS[f.n] ?? []).map(([r, c], i) => (
          <circle key={i} cx={22 + c * 28} cy={22 + r * 28} r={10} />
        ))}
      </svg>
    );
  }
  if (f.kind === 'tens') {
    return (
      <svg className="face tens" viewBox="0 0 120 100" role="img" aria-label={`${f.tens} dizaines et ${f.units} unités`}>
        {Array.from({ length: f.tens }, (_, b) => (
          <g key={b} transform={`translate(${6 + b * 8.4}, 10)`}>
            {Array.from({ length: 10 }, (__, k) => (
              <rect key={k} className="ten" x={0} y={k * 8} width={6.6} height={8} />
            ))}
          </g>
        ))}
        {Array.from({ length: f.units }, (_, u) => (
          <rect key={u} className="unit" x={88 + (u % 3) * 10} y={24 + Math.floor(u / 3) * 10} width={8} height={8} />
        ))}
      </svg>
    );
  }
  // long sums (level 5: «500 + 60 + 1») shrink the font to fit in half a tile
  const long = f.kind === 'expr' && f.text.length > 7;
  // 4-digit numbers (level 6 «Défi»: 6285) also shrink a little
  const wide = f.kind === 'digit' && f.n >= 1000;
  const size = long ? `calc(var(--h) * ${(1.9 / f.text.length).toFixed(3)})` : wide ? 'calc(var(--h) * 0.36)' : undefined;
  return (
    <span className={`face ${f.kind}`} style={size ? { fontSize: size } : undefined}>
      {f.kind === 'digit' ? f.n : f.text}
    </span>
  );
}

/** `quiet`: the half that does NOT touch is dimmed, so the child looks only at the half that matters. */
function Domino({ left, right, half, quiet, style, className = '', tile, ...rest }: { left: DominoFace; right: DominoFace; half: number; quiet: 'left' | 'right'; style?: CSSProperties; className?: string; tile: string | null } & Record<`data-${string}`, string | undefined>) {
  return (
    <div className={`domino ${tile ? 'with-art' : ''} ${className}`} style={{ ['--h' as string]: `${half}px`, ...(tile ? { backgroundImage: `url("${tile}")` } : {}), ...style }} {...rest}>
      <div className={`half ${quiet === 'left' ? 'quiet' : 'key-half'}`}>
        <Face f={left} />
      </div>
      <i className="bar" />
      <div className={`half ${quiet === 'right' ? 'quiet' : 'key-half'}`}>
        <Face f={right} />
      </div>
    </div>
  );
}

export function Dominoes({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.dominoes', 3, (r) => `${r.exercise.instruction}`);
  const { round, status } = rounds;
  const spec = round?.exercise.game as DominoSpec | undefined;
  const outcome = round?.outcome ?? null;
  const { wrong, choose } = useChoices(rounds);
  const tile = approvedArt('domino.tile');
  const H = scene.hand.half;
  const handW = 2 * H + 24;
  const handX0 = (1920 - (4 * handW + 3 * scene.hand.gap)) / 2;
  const placed = outcome && spec ? spec.pieces.find((p) => p.label === outcome.correctAnswerDisplay) : undefined;

  return (
    <Stage background={art(scene.background)} className="game domino-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="Les dominos des nombres" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.error} rounds={rounds} />}

      {spec && (status === 'playing' || status === 'result') && (
        <>
          <Domino left={spec.table.left} right={spec.table.open} half={scene.table.half} quiet="left" tile={tile} className="on-table" style={{ left: scene.table.x, top: scene.table.y }} data-testid="domino-table" />
          {status === 'playing' && <div className="attach-slot" style={{ left: scene.attach.x, top: scene.attach.y, width: 2 * scene.table.half + 24, height: scene.table.half + 24 }} aria-hidden="true" />}
          {placed && (
            <Domino left={placed.left} right={placed.right} half={scene.table.half} quiet="right" tile={tile} className={`placed ${outcome?.result === 'correct' ? 'ok' : 'shown'}`} style={{ left: scene.attach.x, top: scene.attach.y }} data-testid="domino-placed" />
          )}
          {status === 'playing' &&
            spec.pieces.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={`domino-pick ${wrong.includes(p.label) ? 'away' : ''}`}
                style={{ left: handX0 + i * (handW + scene.hand.gap), top: scene.hand.y }}
                data-option={p.label}
                disabled={wrong.includes(p.label) || rounds.busy}
                onClick={() => void choose(p.label)}
                aria-label={`Domino : ${p.label}`}
              >
                <Domino left={p.left} right={p.right} half={H} quiet="right" tile={tile} />
              </button>
            ))}
        </>
      )}

      {status === 'result' && outcome && (
        <ResultPanel rect={zones.result} rounds={rounds} endMessage={END}>
          <span hidden />
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image="/art/scene/domino-card.svg" title="Bravo, Melina!" text="Tu as attaché tous les dominos des nombres." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
