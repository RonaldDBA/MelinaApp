/**
 * Contract between React (learning state, interface) and Phaser (scene, movement).
 * Phaser never holds the only copy of progress: it only receives and emits events.
 */
export type PointId = 'lila' | 'shed' | 'well' | 'bed';

export interface WorldView {
  rewards: string[]; // keys of rewards already earned
  objective: PointId | null; // point marked with a star
  objectiveText: string;
  start?: { x: number; y: number };
  /** Stations with a sheet she finished that waits for a parent (shown calmly on the map, never as a pop-up). */
  waiting?: PointId[];
}

type GameToReact = {
  ready: void;
  interact: PointId;
  position: { x: number; y: number };
};
type ReactToGame = {
  controls: boolean;
  view: WorldView;
};

type Handler<T> = (payload: T) => void;

/** An error inside the scene never brings down the React interface. */
function safe(fn: () => void) {
  try {
    fn();
  } catch (e) {
    console.warn('[game]', (e as Error).message);
  }
}

export class GameBridge {
  private toReact = new Map<keyof GameToReact, Set<Handler<never>>>();
  private toGame = new Map<keyof ReactToGame, Set<Handler<never>>>();
  lastView: WorldView | null = null;
  controlsEnabled = true;

  onGame<K extends keyof GameToReact>(k: K, h: Handler<GameToReact[K]>) {
    const set = this.toReact.get(k) ?? new Set();
    set.add(h as Handler<never>);
    this.toReact.set(k, set);
    return () => set.delete(h as Handler<never>);
  }
  emitFromGame<K extends keyof GameToReact>(k: K, payload: GameToReact[K]) {
    this.toReact.get(k)?.forEach((h) => safe(() => (h as Handler<GameToReact[K]>)(payload)));
  }
  onReact<K extends keyof ReactToGame>(k: K, h: Handler<ReactToGame[K]>) {
    const set = this.toGame.get(k) ?? new Set();
    set.add(h as Handler<never>);
    this.toGame.set(k, set);
    return () => set.delete(h as Handler<never>);
  }
  setControls(enabled: boolean) {
    this.controlsEnabled = enabled;
    this.toGame.get('controls')?.forEach((h) => safe(() => (h as Handler<boolean>)(enabled)));
  }
  setView(v: WorldView) {
    this.lastView = v;
    this.toGame.get('view')?.forEach((h) => safe(() => (h as Handler<WorldView>)(v)));
  }
  clear() {
    this.toReact.clear();
    this.toGame.clear();
  }
}
