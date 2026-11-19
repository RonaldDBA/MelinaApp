import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { approvedArt, art, loadArtCatalog } from '../stage/art';
import type { GameBridge } from './bridge';
import { GARDEN_ART, GardenScene, RENDER_SCALE, WORLD_H, WORLD_W, type GardenArt } from './GardenScene';

/** The chips are drawn on the canvas: wait for the app's rounded font, or the first frame bakes in the fallback font. */
function fontsReady(): Promise<unknown> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts?.load) return Promise.resolve();
  const wait = Promise.all([fonts.load('600 16px Fredoka'), fonts.load('700 16px Fredoka')]).catch(() => undefined);
  // never block the garden for a font: after 1.5 s it opens with whatever is there
  return Promise.race([wait, new Promise((r) => window.setTimeout(r, 1500))]);
}

/** Creates ONE game instance per mount and destroys it on unmount. */
export function PhaserGame({ bridge }: { bridge: GameBridge }) {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  // the garden pieces come from the art catalogue (photo approved by the parents or fallback drawing)
  const [artMap, setArtMap] = useState<GardenArt | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadArtCatalog(), fontsReady()]).then(() => {
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
      // the world is 960×600; the canvas is RENDER_SCALE times bigger and the scene's camera zooms in (sharp art and text)
      width: WORLD_W * RENDER_SCALE,
      height: WORLD_H * RENDER_SCALE,
      backgroundColor: '#8cc976',
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

  return <div ref={host} className="game-host" aria-label="Jardin — utilise les flèches pour marcher ou clique pour y aller" />;
}
