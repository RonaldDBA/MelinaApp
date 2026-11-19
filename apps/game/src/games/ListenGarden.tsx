import { useEffect, useRef, useState } from 'react';
import type { ListenPickSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/listen-garden.json';
import words from '../../../../content/english/words.json';
import { englishVoiceInfo, isMuted, speakEnglish, waitForEnglishVoice } from '../audio';
import { art, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useChoices, useRounds } from './shell';
import { playerName } from '../player';

/**
 * « Le potager qui écoute » — English by ear (research report «English learning games for kids»): the app says a word,
 * a short sentence or a riddle in English, and she taps the picture. Nothing is written in English before the answer.
 * Prompt before the answer (Lyster & Saito): after a mistake the word comes back, slower, and the wrong picture leaves.
 * Without an English voice the game does not start: a listening round without sound would teach nothing and would
 * fill the model with random taps.
 */
const END = 'Bravo! Tes oreilles comprennent de plus en plus d’anglais.';
const zones = scene.zones as Record<'speaker' | 'panel' | 'endPanel' | 'error', Rect>;
const cards = scene.cards as Record<string, Rect[]>;
const WORD = new Map(words.words.map((w) => [w.id, w]));

export function ListenGarden({ onExit }: { onExit: () => void }) {
  const [voice, setVoice] = useState<'checking' | 'ok' | 'missing'>(englishVoiceInfo().available ? 'ok' : 'checking');
  useEffect(() => {
    if (voice !== 'checking') return;
    let alive = true;
    void waitForEnglishVoice().then((ok) => alive && setVoice(ok ? 'ok' : 'missing'));
    return () => {
      alive = false;
    };
  }, [voice]);
  if (voice === 'ok') return <ListenRounds onExit={onExit} />;
  return (
    <Stage background={art(scene.background)} className="game listen-game" data-phase={voice === 'missing' ? 'no-voice' : 'loading'}>
      {voice === 'missing' ? (
        <div className="panel" style={at(zones.error)} role="alert" data-testid="no-english-voice">
          <h2>Il faut une voix anglaise</h2>
          <p className="q-text small">Ce jeu parle anglais, mais cet ordinateur n’a pas de voix anglaise. Demande à un parent d’en ajouter une : Paramètres de Windows › Heure et langue › Voix.</p>
          <button className="big-btn" onClick={onExit}>
            Accueil
          </button>
        </div>
      ) : (
        <p className="scene-note">…</p>
      )}
    </Stage>
  );
}

function ListenRounds({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.listen-garden', 5, (r) => r.exercise.instruction);
  const { round, status } = rounds;
  const spec = round?.exercise.game as ListenPickSpec | undefined;
  const outcome = round?.outcome ?? null;
  const { wrong, choose } = useChoices(rounds);
  const plays = useRef<{ id: string | undefined; n: number }>({ id: undefined, n: 0 });

  // a new round: the English comes right after Lila's French instruction
  useEffect(() => {
    if (status !== 'playing' || !spec || !round) return;
    if (plays.current.id === round.id) return;
    plays.current = { id: round.id, n: 0 };
    speakEnglish(spec.say, { queue: true });
  }, [status, spec, round]);

  /** Big speaker: the first replay at the normal speed, then slower. */
  const replay = () => {
    if (!spec) return;
    plays.current.n += 1;
    speakEnglish(spec.say, { slow: plays.current.n >= 2 });
  };

  // after a mistake (the round is still open and one more picture has left), the English comes back slower
  const missed = wrong.length;
  const missedRef = useRef(0);
  useEffect(() => {
    if (missed > missedRef.current && spec && status === 'playing') speakEnglish(spec.say, { slow: true, queue: true });
    missedRef.current = missed;
  }, [missed, spec, status]);

  const answer = outcome && round?.exercise.game ? WORD.get(String(outcome.correctAnswerDisplay)) : undefined;
  const layout = spec ? cards[String(spec.options.length)] ?? cards['3'] ?? [] : [];

  return (
    <Stage background={art(scene.background)} className="game listen-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="Le potager qui écoute" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.error} rounds={rounds} />}

      {spec && status === 'playing' && (
        <>
          <button type="button" className={`listen-speaker ${rounds.shake ? 'shake' : ''}`} style={at(zones.speaker)} onClick={replay} data-testid="listen-again" aria-label="Écouter encore">
            <img src={icon('speaker_high_volume')} alt="" draggable={false} />
            <span>{isMuted() ? 'Allume le son en haut à droite' : plays.current.n >= 1 ? 'Encore, plus lentement' : 'Écoute encore'}</span>
          </button>
          {spec.options.map((o, i) => (
            <button
              key={o}
              type="button"
              className={`listen-card ${spec.options.length === 6 ? 'small' : ''} ${wrong.includes(o) ? 'away' : ''}`}
              data-option={o}
              aria-label={`Image ${i + 1}`}
              style={{ ...at(layout[i] as Rect), animationDelay: `${i * 0.08}s` }}
              disabled={wrong.includes(o) || rounds.busy}
              onClick={() => void choose(o)}
            >
              <span className={/^\d+$/.test(spec.pics[o] ?? '') ? 'listen-pic numeral' : 'listen-pic'}>{spec.pics[o]}</span>
            </button>
          ))}
        </>
      )}

      {status === 'result' && outcome && (
        <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END}>
          <div className="listen-answer" data-testid="listen-answer">
            <span className={/^\d+$/.test(answer?.pic ?? '') ? 'listen-pic numeral' : 'listen-pic'}>{answer?.pic}</span>
            <span className="listen-word" lang="en">
              {answer?.en}
            </span>
            <button type="button" className="listen-hear" aria-label="Écouter le mot" onClick={() => answer && speakEnglish(answer.en)}>
              <img src={icon('speaker_high_volume')} alt="" />
            </button>
          </div>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={icon('speaker_high_volume')} title={`Bravo, ${playerName()}!`} text="Tu as bien écouté l’anglais. Ton potager a de grandes oreilles!" onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
