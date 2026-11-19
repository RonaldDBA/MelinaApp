import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n, type Subject } from '@melina/shared';
import { api, type GameInfo } from '../api';
import { sfx, voiceInfo } from '../audio';
import { art, icon, useArtCatalog } from '../stage/art';
import { Stage } from '../stage/Stage';

const t = i18n.child;

/** Catalogue cards. A game is only active when the server knows it. */
export const gameCards = [
  { id: 'game.apple-crates', title: 'Les caisses de pommes', sub: 'Compte par groupes de 10', img: 'red_apple', color: 'c-red' },
  { id: 'game.number-train', title: 'Le train des nombres', sub: 'Trouve la règle de la suite', img: 'locomotive', color: 'c-blue' },
  { id: 'game.frog-jump', title: 'Saute-grenouille', sub: 'Additionne et soustrais', img: 'frog', color: 'c-green' },
  { id: 'game.word-fishing', title: 'La pêche aux mots', sub: 'Écris les mots au pluriel', img: 'fish', color: 'c-teal' },
  { id: 'game.mystery-story', title: 'L’histoire mystère', sub: 'Lis et trouve la réponse', img: 'open_book', color: 'c-purple' },
  { id: 'game.number-path', title: 'Le chemin des nombres', sub: 'Trouve les nombres qui manquent', img: '/art/scene/path-card.svg', color: 'c-orange' },
  { id: 'game.hidden-words', title: 'Les mots cachés', sub: 'Trouve les mots, puis écris-les', img: 'loupe', color: 'c-yellow' },
  { id: 'game.dominoes', title: 'Les dominos des nombres', sub: 'Attache le même nombre', img: '/art/scene/domino-card.svg', color: 'c-pink' },
] as const;

/** Cards with a catalogue piece: art approved by the parents shows here too. */
const CARD_ART: Record<string, string> = { red_apple: 'fruit.red_apple', locomotive: 'train.locomotive', frog: 'pond.frog', fish: 'pond.fish', loupe: 'hidden.loupe' };
const cardImage = (img: string) => (CARD_ART[img] ? art(CARD_ART[img]) : img.startsWith('/') ? img : icon(img));

export function Home({
  onGame,
  onWorld,
  onPractice,
  onParents,
  health,
}: {
  onGame: (id: string) => void;
  onWorld: () => void;
  onPractice: (s: Subject) => void;
  onParents: () => void;
  health: { ok: boolean; ai: { keyConfigured: boolean; enabled: boolean } } | null;
}) {
  useArtCatalog();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [voice, setVoice] = useState(voiceInfo());
  // server down: a notice and «Réessayer» (before, every card turned into «Bientôt» with no explanation)
  const failedOnce = useRef(false);
  const loadGames = useCallback(() => {
    setLoadFailed(false);
    api
      .games()
      .then((g) => {
        // the server came back after a failure: reload the page so the images that failed come back too
        if (failedOnce.current) window.location.reload();
        else setGames(g);
      })
      .catch(() => {
        failedOnce.current = true;
        setLoadFailed(true);
      });
  }, []);
  useEffect(() => {
    loadGames();
    const t = window.setTimeout(() => setVoice(voiceInfo()), 800); // the browser's voices load late
    return () => window.clearTimeout(t);
  }, [loadGames]);

  return (
    <Stage background={art('orchard.bg')} className="home">
      <header className="home-title">
        <img src={art('lila.idle')} alt="" draggable={false} />
        <div>
          <h1>Le jardin de Melina</h1>
          <p>Choisis ton jeu!</p>
        </div>
      </header>

      {loadFailed && (
        <p className="home-offline" role="alert" data-testid="home-offline">
          {t.serverDown}{' '}
          <button className="pill" onClick={loadGames}>
            Réessayer
          </button>
        </p>
      )}
      <section className={`cards ${gameCards.length > 5 ? 'many' : ''}`} aria-label="Jeux">
        {gameCards.map((g, i) => {
          const info = games.find((x) => x.id === g.id);
          return info ? (
            <button
              key={g.id}
              className={`card-game ${g.color}`}
              data-game={g.id}
              autoFocus={i === 0}
              onClick={() => {
                sfx.tap();
                onGame(g.id);
              }}
            >
              <img className="card-art" src={cardImage(g.img)} alt="" draggable={false} />
              <span className="card-title">{g.title}</span>
              <span className="card-sub">{g.sub}</span>
              <span className="card-play">Jouer</span>
              <span className="card-badge" data-testid="card-badge">
                Niveau {info.level}
                {info.flowers > 0 && <> · 🌻 {info.flowers}</>}
              </span>
            </button>
          ) : (
            <div key={g.id} className={`card-game soon ${g.color}`} aria-disabled="true">
              <img className="card-art" src={cardImage(g.img)} alt="" draggable={false} />
              <span className="card-title">{g.title}</span>
              <span className="card-sub">{g.sub}</span>
              <span className="card-play">Bientôt</span>
            </div>
          );
        })}
      </section>

      <section className="paper" aria-label="Sur papier">
        <h2>
          <img src={icon('pencil')} alt="" /> Sur papier
        </h2>
        <button className="pill" onClick={onWorld}>
          <img src={icon('house_with_garden')} alt="" /> Le jardin de Lila
        </button>
        <button className="pill" onClick={() => onPractice('french')}>
          <img src={icon('open_book')} alt="" /> Pratiquer le français
        </button>
        <button className="pill" onClick={() => onPractice('mathematics')}>
          <img src={icon('abacus')} alt="" /> Pratiquer les mathématiques
        </button>
      </section>

      <footer className="home-foot">
        <button className="pill" onClick={onParents}>
          <img src={icon('gear')} alt="" /> {t.parentsArea}
        </button>
        <span className="status">
          {health && !loadFailed ? `● ${t.statusOk}` : `○ ${t.statusConnecting}`} · {t.statusAi} : {health?.ai.enabled && health.ai.keyConfigured ? t.statusAiOn : t.statusAiOff} · {t.statusVoice} :{' '}
          {/* no technical browser voice name (in English) on her screen; the detail stays in the parents' area */}
          {voice.available ? (voice.canadian ? 'française (Canada)' : `française ${t.statusVoiceNotCanadian}`) : t.statusNoVoice}
        </span>
      </footer>
    </Stage>
  );
}
