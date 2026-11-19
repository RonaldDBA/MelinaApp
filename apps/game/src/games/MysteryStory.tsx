import type { ChoiceSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/mystery-story.json';
import { speak } from '../audio';
import { art, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useChoices, useRounds } from './shell';
import { playerName } from '../player';

const END = 'Bravo! Tu as trouvé toutes les réponses dans les histoires.';
const zones = scene.zones as Record<'book' | 'question' | 'panel' | 'endPanel', Rect>;
const spots = scene.options as Rect[];

export function MysteryStory({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.mystery-story', 3, (r) => `Lis l’histoire, puis choisis la bonne réponse. ${r.exercise.statement}`);
  const { round, status } = rounds;
  const spec = round?.exercise.game as ChoiceSpec | undefined;
  const text = round?.exercise.visual?.kind === 'text' ? round.exercise.visual : null;
  const outcome = round?.outcome ?? null;
  const { wrong, choose } = useChoices(rounds);

  return (
    <Stage background={art(scene.background)} className="game story-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="L’histoire mystère" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.panel} rounds={rounds} />}

      {text && (status === 'playing' || status === 'result') && (
        <article className={`book ${text.paragraphs.length > 5 ? 'long' : ''}`} style={at(zones.book)}>
          <h2>
            <img src={icon('open_book')} alt="" /> {text.title}
          </h2>
          {text.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <button className="listen" onClick={() => speak(text.paragraphs.join(' '))} aria-label="Écouter l’histoire">
            <img src={icon('speaker_high_volume')} alt="" /> Écouter
          </button>
        </article>
      )}

      {spec && status === 'playing' && (
        <>
          <div className={`question-card ${rounds.shake ? 'shake' : ''}`} style={at(zones.question)}>
            {spec.prompt}
          </div>
          {spec.options.map((o, i) => (
            <button key={o} type="button" className={`answer-option ${wrong.includes(o) ? 'wrong' : ''}`} data-option={o} style={at(spots[i] as Rect)} disabled={wrong.includes(o) || rounds.busy} onClick={() => void choose(o)}>
              <b>{'ABC'[i]}</b>
              <span>{o}</span>
            </button>
          ))}
        </>
      )}

      {status === 'result' && outcome && (
        <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END}>
          <p className="big-answer">{outcome.correctAnswerDisplay}</p>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={icon('books')} title={`Bravo, ${playerName()}!`} text="Tu as cherché les indices dans chaque histoire." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
