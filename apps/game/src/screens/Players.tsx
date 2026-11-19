import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type PlayerInfo } from '../api';
import { sfx } from '../audio';
import { App } from '../App';
import { currentPlayer, lastPlayerId, onPlayerChange, sessionPlayerId, setPlayer } from '../player';
import { art } from '../stage/art';
import { Stage } from '../stage/Stage';
import { Gate } from './ParentArea';

/** Animals a player can choose (the same list as the server's). */
export const AVATARS = ['🦔', '🦊', '🐼', '🐸', '🦁', '🐰', '🐢', '🦄', '🐧', '🐙', '🦋', '🐝'];

/**
 * «Qui joue?» — the player picker, before the home screen. Each player has their own history, levels, flowers and
 * reports (a friend never inherits Melina's). Creating a player is a parent's action (the same small gate as the
 * parents' area). The app below is mounted again for each player (`key`), so nothing of the previous one stays on screen.
 */
export function Root() {
  const [player, setP] = useState(currentPlayer());
  // after a reload of the same window, the same player continues (no picker in the middle of a session)
  const [resuming, setResuming] = useState(() => !currentPlayer() && Boolean(sessionPlayerId()));
  useEffect(() => onPlayerChange(() => setP(currentPlayer())), []);
  useEffect(() => {
    if (!resuming) return;
    const id = sessionPlayerId();
    api
      .profiles()
      .then((list) => {
        const p = list.find((x) => x.id === id);
        if (p) setPlayer({ id: p.id, name: p.name, avatar: p.avatar });
      })
      .catch(() => undefined)
      .finally(() => setResuming(false));
  }, [resuming]);
  if (resuming) return null;
  if (!player) return <PlayerPicker />;
  return <App key={player.id} />;
}

function PlayerPicker() {
  const [list, setList] = useState<PlayerInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<'gate' | 'form' | null>(null);
  const load = useCallback(() => {
    setError(null);
    api
      .profiles()
      .then(setList)
      .catch(() => setError('Le jeu ne répond pas. Demande à un parent de fermer le jeu et de l’ouvrir de nouveau.'));
  }, []);
  useEffect(() => load(), [load]);
  const last = lastPlayerId();
  const choose = (p: PlayerInfo) => {
    sfx.tap();
    setPlayer({ id: p.id, name: p.name, avatar: p.avatar });
  };

  return (
    <Stage background={art('garden.bg')} className="home players" data-testid="players">
      <header className="home-title players-title">
        <h1>Qui joue?</h1>
        <p>Touche ton animal pour entrer dans le jardin.</p>
      </header>
      {error && (
        <p className="home-offline" role="alert">
          {error}{' '}
          <button className="pill" onClick={load}>
            Réessayer
          </button>
        </p>
      )}
      {list && !adding && (
        <section className="players-list" aria-label="Joueurs">
          {list.map((p, i) => (
            <button key={p.id} className={`player-card ${p.id === last ? 'last' : ''}`} data-player={p.name} autoFocus={p.id === last || (!last && i === 0)} onClick={() => choose(p)}>
              <span className="player-avatar" aria-hidden="true">
                {p.avatar}
              </span>
              <span className="player-name">{p.name}</span>
            </button>
          ))}
          {list.length < 8 && (
            <button className="player-card add" data-testid="add-player" onClick={() => setAdding('gate')}>
              <span className="player-avatar" aria-hidden="true">
                ➕
              </span>
              <span className="player-name">Nouveau joueur</span>
            </button>
          )}
        </section>
      )}
      {adding === 'gate' && (
        <div className="panel players-panel">
          <Gate onPass={() => setAdding('form')} onClose={() => setAdding(null)} />
        </div>
      )}
      {adding === 'form' && (
        <NewPlayer
          onCancel={() => setAdding(null)}
          onCreated={(p) => {
            setAdding(null);
            setList((l) => [...(l ?? []), p]);
          }}
        />
      )}
    </Stage>
  );
}

function NewPlayer({ onCancel, onCreated }: { onCancel: () => void; onCreated: (p: PlayerInfo) => void }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[1] as string);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel players-panel new-player"
      data-testid="new-player"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        api
          .createProfile({ name, avatar })
          .then(onCreated)
          .catch((x) => setErr(x instanceof ApiError ? x.message : 'Impossible de créer ce joueur.'))
          .finally(() => setBusy(false));
      }}
    >
      <h2>Nouveau joueur</h2>
      <p className="q-text small">Il commence à zéro : son propre niveau, ses propres fleurs. L’histoire des autres joueurs ne change pas.</p>
      <label className="new-player-name">
        Prénom{' '}
        <input autoFocus maxLength={20} value={name} onChange={(e) => setName(e.target.value)} aria-label="Prénom" />
      </label>
      <div className="avatar-grid" role="radiogroup" aria-label="Animal">
        {AVATARS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={a === avatar} className={`avatar-pick ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)}>
            {a}
          </button>
        ))}
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <div className="end-actions">
        <button type="button" className="big-btn secondary" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="big-btn" disabled={busy || !name.trim()}>
          Créer
        </button>
      </div>
    </form>
  );
}
