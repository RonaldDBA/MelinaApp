/**
 * The player in use (profile picker before the home screen). Every request to the local server carries the player id,
 * so each child has their own history, levels and rewards. Remembered on this computer (localStorage) only as a
 * convenience: the picker always shows at start, so a friend never plays in Melina's name by mistake.
 */

export interface Player {
  id: string;
  name: string;
  avatar: string;
}

const KEY = 'melina.player';
let current: Player | null = null;
const listeners = new Set<() => void>();

export function currentPlayer(): Player | null {
  return current;
}

/** First name to show on screen («Bravo, Léo!»). Never spoken by the voice and never sent outside this computer. */
export function playerName(): string {
  return current?.name ?? 'Melina';
}

const SESSION = 'melina.session.player';

export function setPlayer(p: Player | null) {
  current = p;
  try {
    if (p) {
      window.localStorage.setItem(KEY, p.id);
      // the same window keeps its player after a reload (e.g. the home screen reloads when the server comes back);
      // a new start of the app shows the picker again
      window.sessionStorage.setItem(SESSION, p.id);
    } else window.sessionStorage.removeItem(SESSION);
  } catch {
    /* storage unavailable: the picker still works */
  }
  for (const f of listeners) f();
}

/** Player of this window before a reload, if any. */
export function sessionPlayerId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION);
  } catch {
    return null;
  }
}

/** Id of the player chosen last time on this computer (to highlight it in the picker). */
export function lastPlayerId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function onPlayerChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
