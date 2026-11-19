import { useEffect, useState } from 'react';
import type { NumberTrainSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/number-train.json';
import { approvedArt, art, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, NumberQuestion, ResultPanel, useRounds } from './shell';
import { playerName } from '../player';

const END = 'Bravo! Le train peut repartir. Tchou tchou!';
const zones = scene.zones as Record<'train' | 'panel' | 'endPanel', Rect>;
const COLORS = ['#ff7a85', '#ffb84d', '#5cc8a1', '#5aa9f0', '#b68cf5', '#f58cc6'];

export function NumberTrain({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.number-train', 3, (r) => `Le train des nombres arrive! ${r.exercise.statement}`);
  const { round, status } = rounds;
  const spec = round?.exercise.game as NumberTrainSpec | undefined;
  const outcome = round?.outcome ?? null;
  const [help, setHelp] = useState(false);
  useEffect(() => setHelp(false), [round?.id]);

  const t = scene.train;
  const x0 = zones.train.x + (zones.train.w - (t.locoW + 6 * (t.wagonW + t.gap))) / 2;
  const wagonY = zones.train.y + zones.train.h - t.wagonH - 34;
  const terms = spec?.terms ?? [];
  const known = terms.findIndex((v, i) => v !== null && terms[i + 1] !== null && i + 1 < terms.length);
  const step = known >= 0 ? (terms[known + 1] as number) - (terms[known] as number) : 0;
  const showRule = help || status === 'result';
  const wagonArt = approvedArt('train.wagon'); // without an approved photo, the wagons are still drawn in code

  return (
    <Stage background={art(scene.background)} className="game train-game" data-phase={status === 'playing' ? 'question' : status}>
      <GameHud title="Le train des nombres" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.panel} rounds={rounds} />}

      {spec && (status === 'playing' || status === 'result') && (
        <>
          <div className="track" style={{ left: zones.train.x - 60, top: zones.train.y + zones.train.h - 30, width: zones.train.w + 120 }} />
          <img className="loco" src={art('train.locomotive')} alt="" draggable={false} style={at({ x: x0, y: zones.train.y - 6, w: t.locoW, h: t.locoW })} />
          {terms.map((v, i) => {
            const x = x0 + t.locoW + t.gap + i * (t.wagonW + t.gap);
            const missing = v === null;
            return (
              <div
                key={i}
                className={`wagon ${wagonArt ? 'with-art' : ''} ${missing ? 'missing' : ''} ${missing && outcome ? 'solved' : ''}`}
                data-wagon={i}
                style={{ ...at({ x, y: wagonY, w: t.wagonW, h: t.wagonH }), ['--c' as string]: COLORS[i % COLORS.length], ...(wagonArt ? { backgroundImage: `url("${wagonArt}")` } : {}) }}
              >
                <span>{missing ? (outcome ? outcome.correctAnswerDisplay : '?') : v}</span>
                <i className="wheel w1" />
                <i className="wheel w2" />
                {showRule && i > 0 && (
                  <b className="hop" style={{ animationDelay: `${i * 0.15}s` }}>
                    {step > 0 ? `+${step}` : `−${-step}`}
                  </b>
                )}
              </div>
            );
          })}
        </>
      )}

      {status === 'playing' && <NumberQuestion wide rect={zones.panel} rounds={rounds} onRetry={(r) => r.feedback?.showCounting && setHelp(true)} />}
      {/* the solved wagon already shows the answer: no big repeated number in the small panel */}
      {status === 'result' && (
        <ResultPanel rect={zones.panel} rounds={rounds} endMessage={END}>
          <></>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={art('train.locomotive')} title={`Bravo, ${playerName()}!`} text="Tous les wagons ont leur nombre. Le train repart!" onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
