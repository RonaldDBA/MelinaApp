import type { FrogJumpSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/frog-jump.json';
import { approvedArt, art, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useChoices, useRounds } from './shell';
import { playerName } from '../player';

const END = 'Bravo! La grenouille a traversé tout l’étang!';
const zones = scene.zones as Record<'pond' | 'startPad' | 'sign' | 'panel' | 'endPanel', Rect>;
const pads = scene.pads as Rect[];

export function FrogJump({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.frog-jump', 3, (r) => r.exercise.statement);
  const { round, status } = rounds;
  const spec = round?.exercise.game as FrogJumpSpec | undefined;
  const outcome = round?.outcome ?? null;
  const { wrong, choose } = useChoices(rounds);
  const landed = outcome ? (spec?.options.indexOf(outcome.correctAnswerDisplay) ?? -1) : -1;
  const frogAt = landed >= 0 && outcome?.result === 'correct' ? (pads[landed] as Rect) : zones.startPad;
  // pond and water lilies: photo approved by the parents, or the usual code drawing
  const pondArt = approvedArt('pond.water');
  const padArt = approvedArt('pond.lilypad');
  const padStyle = (r: Rect) => (padArt ? { ...at(r), backgroundImage: `url("${padArt}")` } : at(r));

  return (
    <Stage background={art(scene.background)} className="game frog-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="Saute-grenouille" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.panel} rounds={rounds} />}

      {spec && (status === 'playing' || status === 'result') && (
        <>
          <div className={`pond ${pondArt ? 'with-art' : ''}`} style={pondArt ? { ...at(zones.pond), backgroundImage: `url("${pondArt}")` } : at(zones.pond)} />
          <div className={`pad start ${padArt ? 'with-art' : ''}`} style={padStyle(zones.startPad)}>
            <span>{spec.start}</span>
          </div>
          <div className={`jump-sign ${spec.op === '+' ? 'plus' : 'minus'}`} style={at(zones.sign)}>
            {spec.op === '+' ? '+' : '−'}
            {spec.jump}
            <i>{spec.op === '+' ? '➜' : '⬅'}</i>
          </div>
          {spec.options.map((o, i) => (
            <button key={o} type="button" className={`pad option ${padArt ? 'with-art' : ''} ${wrong.includes(o) ? 'sunk' : ''} ${outcome && i === landed ? 'target' : ''}`} data-option={o} style={padStyle(pads[i] as Rect)} disabled={status !== 'playing' || wrong.includes(o) || rounds.busy} onClick={() => void choose(o)} aria-label={`Nénuphar ${o}`}>
              <span>{o}</span>
            </button>
          ))}
          <img className="frog" src={art('pond.frog')} alt="" draggable={false} style={{ left: frogAt.x + frogAt.w / 2 - 95, top: frogAt.y - 70, width: 190, height: 190 }} />
        </>
      )}

      {status === 'result' && outcome?.result !== 'correct' && <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END} />}
      {status === 'result' && outcome?.result === 'correct' && <ResultPanel rect={{ ...zones.panel, h: 560 }} rounds={rounds} endMessage={END} />}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={art('pond.frog')} title={`Bravo, ${playerName()}!`} text="La grenouille est arrivée de l’autre côté de l’étang." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
