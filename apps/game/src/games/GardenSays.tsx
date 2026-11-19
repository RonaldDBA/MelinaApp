import { useEffect, useRef, useState } from 'react';
import type { CommandsSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/garden-says.json';
import { englishVoiceInfo, isMuted, sfx, speakEnglish, waitForEnglishVoice } from '../audio';
import { art, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, useRounds } from './shell';

/**
 * « La jardinière dit » — English commands (research report «English learning games for kids»: in Cycle One, children
 * show they understood by acting). She hears a command and does it by tapping the things in order: one object, a colour
 * and an object, two steps with «then», «put … in the basket». Each tap shows its number; tapping the last one again
 * takes it back. After a mistake the command comes back, slower, and she starts over.
 */
const END = 'Bravo! Tu comprends les consignes en anglais.';
const zones = scene.zones as Record<'speaker' | 'panel' | 'endPanel' | 'error', Rect>;
const layouts = scene.layouts as Record<string, { items: Rect[]; containers: Rect[] }>;

export function GardenSays({ onExit }: { onExit: () => void }) {
  const [voice, setVoice] = useState<'checking' | 'ok' | 'missing'>(englishVoiceInfo().available ? 'ok' : 'checking');
  useEffect(() => {
    if (voice !== 'checking') return;
    let alive = true;
    void waitForEnglishVoice().then((ok) => alive && setVoice(ok ? 'ok' : 'missing'));
    return () => {
      alive = false;
    };
  }, [voice]);
  if (voice === 'ok') return <CommandRounds onExit={onExit} />;
  return (
    <Stage background={art(scene.background)} className="game says-game" data-phase={voice === 'missing' ? 'no-voice' : 'loading'}>
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

function CommandRounds({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.garden-says', 5, (r) => r.exercise.instruction);
  const { round, status, busy } = rounds;
  const spec = round?.exercise.game as CommandsSpec | undefined;
  const outcome = round?.outcome ?? null;
  const [taps, setTaps] = useState<{ id: string | undefined; list: string[] }>({ id: undefined, list: [] });
  const tapped = taps.id === round?.id ? taps.list : [];
  const plays = useRef<{ id: string | undefined; n: number }>({ id: undefined, n: 0 });
  const latest = useRef<string[]>([]); // taps of this round, up to date even between two renders
  const sending = useRef(false);
  useEffect(() => {
    latest.current = []; // a new round starts with no taps
  }, [round?.id]);

  // a new round: the English command right after Lila's French instruction
  useEffect(() => {
    if (status !== 'playing' || !spec || !round) return;
    if (plays.current.id === round.id) return;
    plays.current = { id: round.id, n: 0 };
    speakEnglish(spec.say, { queue: true });
  }, [status, spec, round]);

  const replay = () => {
    if (!spec) return;
    plays.current.n += 1;
    speakEnglish(spec.say, { slow: plays.current.n >= 2 });
  };

  const tap = async (thing: string) => {
    if (!spec || !round || busy || status !== 'playing') return;
    if (latest.current[latest.current.length - 1] === thing && !sending.current) {
      latest.current = latest.current.slice(0, -1);
      setTaps({ id: round.id, list: latest.current }); // changed her mind: the last tap goes back
      return;
    }
    if (latest.current.includes(thing) || sending.current) return;
    sfx.tap();
    // taps are read from the ref, not from the last render: two taps in the same frame must both count, in order
    const list = [...latest.current, thing];
    latest.current = list;
    setTaps({ id: round.id, list });
    if (list.length < spec.steps) return;
    sending.current = true;
    const r = await rounds.submit(list.join(','));
    sending.current = false;
    latest.current = [];
    if (r?.state === 'retry') {
      setTaps({ id: round.id, list: [] });
      speakEnglish(spec.say, { slow: true, queue: true });
    }
  };

  const layout = spec ? layouts[`${spec.items.length}${spec.containers.length ? 'c' : ''}`] ?? layouts['4']! : layouts['4']!;
  const order = (id: string) => tapped.indexOf(id) + 1;
  /** An object put in a container (the next tap was the basket or the box): it «leaves» the table. */
  const moved = (id: string) => order(id) > 0 && Boolean(spec?.containers.includes(tapped[order(id)] as string));
  /** What was put in each container: the object tapped just before it. */
  const inside = (container: string) => {
    const i = tapped.indexOf(container);
    return i > 0 && spec?.items.includes(tapped[i - 1] as string) ? spec.pics[tapped[i - 1] as string] : null;
  };

  return (
    <Stage background={art(scene.background)} className="game says-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="La jardinière dit" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.error} rounds={rounds} />}

      {spec && status === 'playing' && (
        <>
          <button type="button" className={`listen-speaker ${rounds.shake ? 'shake' : ''}`} style={at(zones.speaker)} onClick={replay} data-testid="listen-again" aria-label="Écouter encore">
            <img src={icon('speaker_high_volume')} alt="" draggable={false} />
            <span>{isMuted() ? 'Allume le son en haut à droite' : plays.current.n >= 1 ? 'Encore, plus lentement' : 'Écoute encore'}</span>
          </button>
          {spec.items.map((id, i) => (
            <button
              key={id}
              type="button"
              className={`listen-card says-item ${layout.items.length >= 6 || spec.containers.length ? 'small' : ''} ${moved(id) ? 'moved' : order(id) ? 'picked' : ''}`}
              data-option={id}
              aria-label={`Objet ${i + 1}`}
              style={{ ...at(layout.items[i] as Rect), animationDelay: `${i * 0.06}s` }}
              disabled={busy}
              onClick={() => void tap(id)}
            >
              <span className="listen-pic">{spec.pics[id]}</span>
              {order(id) > 0 && <span className="says-badge">{order(id)}</span>}
            </button>
          ))}
          {spec.containers.map((id, i) => (
            <button key={id} type="button" className={`says-container ${order(id) ? 'picked' : ''}`} data-option={id} aria-label={`Contenant ${i + 1}`} style={at(layout.containers[i] as Rect)} disabled={busy} onClick={() => void tap(id)}>
              <span className="listen-pic">{spec.pics[id]}</span>
              {inside(id) && <span className="says-inside">{inside(id)}</span>}
              {order(id) > 0 && <span className="says-badge">{order(id)}</span>}
            </button>
          ))}
        </>
      )}

      {status === 'result' && outcome && spec && (
        <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END}>
          <div className="listen-answer says-answer" data-testid="says-answer">
            <span className="says-sentence" lang="en">
              {spec.say}
            </span>
            <button type="button" className="listen-hear" aria-label="Écouter la consigne" onClick={() => speakEnglish(spec.say)}>
              <img src={icon('speaker_high_volume')} alt="" />
            </button>
          </div>
          <p className="says-picks">{outcome.correctAnswerDisplay.split(',').map((id) => spec.pics[id]).join('  ➜  ')}</p>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={icon('basket')} title="Bravo, Melina!" text="Tu as fait tout ce que la jardinière a demandé, en anglais!" onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
