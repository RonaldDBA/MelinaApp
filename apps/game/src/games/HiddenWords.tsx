import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HiddenWordsSpec, Rect } from '@melina/shared';
import scene from '../../../../content/scenes/hidden-words.json';
import { sfx, speak } from '../audio';
import { hintDelayMs } from '../hints';
import { pick } from '../praise';
import { approvedArt, art, icon, useArtCatalog } from '../stage/art';
import { Stage, at } from '../stage/Stage';
import { Confetti, EndPanel, ErrorPanel, GameHud, Guide, ResultPanel, focusedControl, repeated, useLater, useRounds } from './shell';

/**
 * « Les mots cachés » — word search.
 * 1) Search: tap the first and the last letter of a word. Finding is NOT assessed (nothing goes to the server).
 * 2) Test: once all are found, the grid disappears; one of the words comes back with missing letters and the child
 *    completes it by tapping the keyboard letters. Only that word is assessed, on the server.
 */

const END = 'Bravo! Tu as trouvé tous les mots cachés.';
const zones = scene.zones as Record<'list' | 'spell' | 'result' | 'endPanel', Rect>;
const SHEET = scene.sheet;
const COLORS = ['#ffd166', '#8ce99a', '#a5d8ff', '#ffc9de', '#d0bfff'];
type Cell = { r: number; c: number };
type Line = { a: Cell; b: Cell; color: string };

export function HiddenWords({ onExit }: { onExit: () => void }) {
  useArtCatalog();
  const rounds = useRounds('game.hidden-words', 3, () => 'Trouve les mots cachés dans la grille. Touche la première lettre, puis la dernière.');
  const { round, status, busy, submit } = rounds;
  const spec = round?.exercise.game as HiddenWordsSpec | undefined;
  const outcome = round?.outcome ?? null;
  const [phase, setPhase] = useState<'search' | 'spell'>('search');
  const [found, setFound] = useState<number[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [start, setStart] = useState<Cell | null>(null);
  const [miss, setMiss] = useState(false);
  const [glow, setGlow] = useState<Cell | null>(null);
  const later = useLater(); // timers cancelled when leaving the game
  // hint: one per word, and only after ~20 s of searching (finding a word restarts the count)
  const [hinted, setHinted] = useState<number[]>([]);
  const [helpReady, setHelpReady] = useState(false);
  const armHelp = useCallback(() => {
    setHelpReady(false);
    later(() => setHelpReady(true), hintDelayMs(), 'help-ready');
  }, [later]);
  const [fill, setFill] = useState<string[]>([]);
  const [sel, setSel] = useState(0);

  const n = spec?.grid.length ?? 6;
  const cell = (SHEET.size - 2 * SHEET.padding) / n;
  const holes = useMemo(() => (spec ? spec.final.pattern.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0) : []), [spec]);

  useEffect(() => {
    setPhase('search');
    setFound([]);
    setLines([]);
    setStart(null);
    setGlow(null);
    setSel(0);
    setHinted([]);
    armHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id]);
  useEffect(() => setFill(holes.map(() => '')), [holes]);

  // ---------------------------------------------------------------- search (not assessed)
  const tap = (r: number, c: number) => {
    if (!spec || phase !== 'search' || status !== 'playing') return;
    sfx.tap();
    if (!start) return setStart({ r, c });
    // accepts tapping the ends in any order: the word is always read in the →, ↓ or ↘ direction
    let a = start;
    let b = { r, c };
    if (b.r < a.r || (b.r === a.r && b.c < a.c)) [a, b] = [b, a];
    const dr = b.r - a.r;
    const dc = b.c - a.c;
    const dir = dr === 0 && dc > 0 ? 'h' : dc === 0 && dr > 0 ? 'v' : dr === dc && dr > 0 ? 'd' : null;
    setStart(null);
    if (!dir || !spec.directions.includes(dir)) return wrongPick();
    const len = Math.max(dr, dc) + 1;
    const text = Array.from({ length: len }, (_, k) => spec.grid[a.r + Math.sign(dr) * k]?.[a.c + Math.sign(dc) * k] ?? '').join('');
    const idx = spec.words.findIndex((w, i) => !found.includes(i) && w.word.normalize('NFC') === text);
    if (idx < 0) return wrongPick();
    const next = [...found, idx];
    setFound(next);
    armHelp(); // found: the next hint waits for her to search again
    setLines((l) => [...l, { a, b, color: COLORS[l.length % COLORS.length] as string }]);
    sfx.found();
    if (next.length === spec.words.length) {
      // dictation: the word is spoken but never written on screen during the test
      const word = (spec.words[spec.final.index] as { word: string }).word;
      rounds.sayApart('Bravo! Tu as trouvé tous les mots. Écoute le mot et complète-le.', `Bravo! Tu as trouvé tous les mots. Écoute le mot et complète-le : ${word}.`);
      later(() => setPhase('spell'), 1400, 'phase');
    } else rounds.say(`${pick('hw-found', ['Oui!', 'Trouvé!', 'Bien vu!', 'C’est ça!', 'Voilà!'])} « ${(spec.words[idx] as { word: string }).word} ».`);
  };
  const wrongPick = () => {
    sfx.soft();
    setMiss(true);
    later(() => setMiss(false), 450, 'miss');
  };
  const help = () => {
    if (!spec || !helpReady) return;
    // lights up the first letter of a missing word that has not had a hint yet (one hint per word)
    const i = spec.words.findIndex((_, k) => !found.includes(k) && !hinted.includes(k));
    const w = spec.words[i];
    if (!w) return;
    const first = [...w.word.normalize('NFC')];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        for (const d of spec.directions) {
          const [sr, sc] = d === 'h' ? [0, 1] : d === 'v' ? [1, 0] : [1, 1];
          if (first.every((ch, k) => spec.grid[r + sr * k]?.[c + sc * k] === ch)) {
            setGlow({ r, c });
            setHinted((h) => [...h, i]);
            armHelp();
            rounds.say(`Cherche le mot « ${w.word} ». Il commence ici.`);
            later(() => setGlow(null), 2500, 'glow'); // a 2nd «Un indice» renews the glow
            return;
          }
        }
  };

  // ---------------------------------------------------------------- test (assessed on the server)
  const press = useCallback(
    (key: string) => {
      if (!spec || phase !== 'spell' || busy || status !== 'playing') return;
      if (key === 'ok') {
        const empty = fill.findIndex((v) => v === '');
        if (empty >= 0) {
          setSel(empty);
          rounds.say('Il manque encore une lettre.');
          return;
        }
        const word = spec.final.pattern.map((p, i) => p ?? fill[holes.indexOf(i)]).join('');
        void submit(word).then((r) => {
          if (r?.state === 'retry') {
            setFill(holes.map(() => ''));
            setSel(0);
          }
        });
        return;
      }
      sfx.tap();
      if (key === 'del') {
        const k = fill[sel] ? sel : Math.max(0, sel - 1);
        setFill((f) => f.map((v, i) => (i === k ? '' : v)));
        setSel(k);
        return;
      }
      setFill((f) => f.map((v, i) => (i === sel ? key : v)));
      setSel((s) => Math.min(holes.length - 1, s + 1));
    },
    [spec, phase, busy, status, fill, holes, sel, submit, rounds],
  );

  useEffect(() => {
    if (phase !== 'spell' || status !== 'playing' || !spec) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.normalize('NFC').toLowerCase();
      if (spec.final.letters.includes(k)) press(k);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') {
        if (repeated(e) || focusedControl(e)) return;
        e.preventDefault();
        press('ok');
      } else if (e.key === 'ArrowRight') {
        // Tab stays free so the keyboard can reach the bar buttons (home, sound)
        e.preventDefault();
        setSel((s) => Math.min(holes.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSel((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, status, spec, press, holes.length]);

  const sheetArt = approvedArt('hidden.sheet');
  const target = spec ? (spec.words[spec.final.index] as { word: string; emoji?: string }) : null;
  const dataPhase = status === 'playing' ? (phase === 'search' ? 'search' : 'question') : status;

  return (
    <Stage background={art(scene.background)} className="game hidden-game" data-phase={dataPhase}>
      <GameHud title="Les mots cachés" rounds={rounds} onExit={onExit} />
      {status === 'loading' && <p className="scene-note">…</p>}
      {status === 'error' && <ErrorPanel rect={zones.spell} rounds={rounds} />}

      {spec && status === 'playing' && phase === 'search' && (
        <>
          <div className={`word-sheet ${sheetArt ? 'with-art' : ''} ${miss ? 'shake' : ''}`} style={{ ...at({ x: SHEET.x, y: SHEET.y, w: SHEET.size, h: SHEET.size }), ...(sheetArt ? { backgroundImage: `url("${sheetArt}")` } : {}) }}>
            {lines.map((l, i) => {
              const ax = SHEET.padding + (l.a.c + 0.5) * cell;
              const ay = SHEET.padding + (l.a.r + 0.5) * cell;
              const bx = SHEET.padding + (l.b.c + 0.5) * cell;
              const by = SHEET.padding + (l.b.r + 0.5) * cell;
              const len = Math.hypot(bx - ax, by - ay) + cell * 0.86;
              const angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
              return <span key={i} className="found-line" style={{ left: ax - cell * 0.43, top: ay - cell * 0.38, width: len, height: cell * 0.76, background: l.color, transform: `rotate(${angle}deg)`, transformOrigin: `${cell * 0.43}px ${cell * 0.38}px` }} />;
            })}
            {spec.grid.map((row, r) =>
              row.map((ch, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`letter ${start && start.r === r && start.c === c ? 'start' : ''} ${glow && glow.r === r && glow.c === c ? 'glow' : ''}`}
                  style={{ left: SHEET.padding + c * cell, top: SHEET.padding + r * cell, width: cell, height: cell, fontSize: cell * 0.58 }}
                  data-r={r}
                  data-c={c}
                  onClick={() => tap(r, c)}
                  aria-label={ch}
                >
                  {ch}
                </button>
              )),
            )}
          </div>
          <div className="panel word-list" style={at(zones.list)}>
            <h2>
              <img src={art('hidden.loupe')} alt="" /> Mots à trouver ({found.length}/{spec.words.length})
            </h2>
            <ul>
              {spec.words.map((w, i) => (
                <li key={w.word} className={found.includes(i) ? 'found' : ''} data-word={w.word}>
                  <span className="emoji" aria-hidden="true">
                    {w.emoji ?? '•'}
                  </span>
                  <span className="w">{w.word}</span>
                  {found.includes(i) && <span className="check">✓</span>}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="big-btn secondary small-help"
              onClick={help}
              disabled={!helpReady || !spec.words.some((_, k) => !found.includes(k) && !hinted.includes(k))}
              data-testid="hw-help"
            >
              {helpReady ? 'Un indice' : 'Cherche encore…'}
            </button>
          </div>
        </>
      )}

      {spec && target && status === 'playing' && phase === 'spell' && (
        <div className={`panel spell ${rounds.shake ? 'shake' : ''}`} style={at(zones.spell)} role="group" aria-label="Complète le mot">
          <p className="q-text">{round?.exercise.statement}</p>
          <div className="spell-cue">
            {target.emoji && <span className="spell-emoji" aria-hidden="true">{target.emoji}</span>}
            <button type="button" className="say-btn big" onClick={() => speak(target.word)} aria-label="Écouter le mot" data-testid="hw-listen">
              <img src={icon('speaker_high_volume')} alt="" />
            </button>
          </div>
          <div className="spell-word">
            {spec.final.pattern.map((p, i) => {
              const k = holes.indexOf(i);
              return p !== null ? (
                <span key={i} className="sl fixed">
                  {p}
                </span>
              ) : (
                <button key={i} type="button" className={`sl hole ${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)} data-slot={k} aria-label={`Lettre ${k + 1} : ${fill[k] || 'vide'}`}>
                  {fill[k] || ''}
                </button>
              );
            })}
          </div>
          <div className="letter-bank">
            {spec.final.letters.map((l) => (
              <button key={l} type="button" className="key" data-letter={l} onClick={() => press(l)} disabled={busy}>
                {l}
              </button>
            ))}
            <button type="button" className="key del" onClick={() => press('del')} disabled={busy} aria-label="Effacer">
              ⌫
            </button>
            <button type="button" className="key ok" onClick={() => press('ok')} disabled={busy} aria-label="Valider">
              ✓
            </button>
          </div>
          <p className="tries">{round && round.triesLeft < 3 ? 'Prends ton temps et relis l’astuce de Lila.' : 'Touche une case vide, puis la bonne lettre.'}</p>
        </div>
      )}

      {status === 'result' && outcome && (
        <ResultPanel rect={zones.result} rounds={rounds} endMessage={END}>
          <p className="big-answer">
            {target?.emoji ? `${target.emoji} ` : ''}
            {outcome.correctAnswerDisplay}
          </p>
        </ResultPanel>
      )}
      {status === 'end' && <EndPanel rect={zones.endPanel} rounds={rounds} image={art('hidden.loupe')} title="Bravo, Melina!" text="Tu as trouvé tous les mots cachés et tu les as bien écrits." onExit={onExit} />}
      {(status === 'result' && outcome?.result === 'correct') || status === 'end' ? <Confetti key={`${round?.id}-${status}`} big={rounds.milestone !== null} small={status === 'result' && rounds.milestone === null} /> : null}
      <Guide message={rounds.message} mood={status === 'end' || (status === 'result' && outcome?.result === 'correct') ? 'happy' : 'thinking'} hidden={status === 'end'} />
    </Stage>
  );
}
