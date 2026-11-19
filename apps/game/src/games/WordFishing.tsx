import type { ChoiceSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/word-fishing.json';
import { approvedArt, art, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useChoices, useRounds } from './shell';
import { playerName } from '../player';

const END = 'Quelle belle pêche! Tu connais bien tes pluriels.';
const zones = scene.zones as Record<'pond' | 'prompt' | 'panel' | 'endPanel', Rect>;
const spots = scene.fish as Rect[];

export function WordFishing({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.word-fishing', 3, (r) => `${r.exercise.instruction} ${r.exercise.statement.replace('→', ', au pluriel :').replace('…', '')}`);
  const { round, status } = rounds;
  const spec = round?.exercise.game as ChoiceSpec | undefined;
  const outcome = round?.outcome ?? null;
  const { wrong, choose } = useChoices(rounds);
  const pondArt = approvedArt('pond.water');

  return (
    <Stage background={art(scene.background)} className="game fishing-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="La pêche aux mots" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.panel} rounds={rounds} />}

      {spec && status === 'playing' && (
        <>
          <div className={`pond ${pondArt ? 'with-art' : ''}`} style={pondArt ? { ...at(zones.pond), backgroundImage: `url("${pondArt}")` } : at(zones.pond)} />
          <div className={`prompt-card ${rounds.shake ? 'shake' : ''}`} style={at(zones.prompt)}>
            <img src={icon('fishing_pole')} alt="" />
            <span>{spec.prompt}</span>
          </div>
          {spec.options.map((o, i) => (
            <button key={o} type="button" className={`fish ${wrong.includes(o) ? 'away' : ''}`} data-option={o} style={{ ...at(spots[i] as Rect), animationDelay: `${i * -0.9}s` }} disabled={wrong.includes(o) || rounds.busy} onClick={() => void choose(o)}>
              <img src={art('pond.fish')} alt="" draggable={false} />
              <span className={o.includes(' ') ? 'long' : undefined}>{o}</span>
            </button>
          ))}
        </>
      )}

      {status === 'result' && outcome && (
        <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END}>
          <p className="big-answer">{round?.exercise.statement.replace('…', outcome.correctAnswerDisplay)}</p>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={art('pond.fish')} title={`Bravo, ${playerName()}!`} text="Ton panier est rempli de mots bien écrits." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
