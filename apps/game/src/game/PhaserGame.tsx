import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { approvedArt, art, loadArtCatalog } from '../stage/art';
import type { GameBridge } from './bridge';
import { GARDEN_ART, GardenScene, WORLD_H, WORLD_W, type GardenArt } from './GardenScene';

/** Creates ONE game instance per mount and destroys it on unmount. */
export function PhaserGame({ bridge }: { bridge: GameBridge }) {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // the garden pieces come from the art catalogue (photo approved by the parents or fallback drawing)
  const [artMap, setArtMap] = useState<GardenArt | null>(null);

  useEffect(() => {
    let alive = true;
    void loadArtCatalog().then(() => {
      if (!alive) return;
      setArtMap(Object.fromEntries(Object.entries(GARDEN_ART).map(([key, id]) => [key, { url: art(id), approved: approvedArt(id) !== null }])) as GardenArt);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!host.current || gameRef.current || !artMap) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      width: WORLD_W,
      height: WORLD_H,
      backgroundColor: '#9ad68f',
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true },
      banner: false,
      scene: [],
    });
    game.registry.set('bridge', bridge);
    game.registry.set('art', artMap);
    game.scene.add('garden', GardenScene, true);
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [bridge, artMap]);

  return <div ref={host} className="game-host" aria-label="Jardin — utilise les flèches pour marcher" />;
}
