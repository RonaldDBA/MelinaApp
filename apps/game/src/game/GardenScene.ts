import Phaser from 'phaser';
import type { GameBridge, PointId, WorldView } from './bridge';

/**
 * Garden scene (paper activities).
 * Backdrop, remise, puits, potager, Lila and rewards come from the ART CATALOGUE (specs garden.* and lila.idle):
 * a photo approved by the parents in the studio, or the spec's fallback drawing. The girl is still drawn in
 * code (the guardian's decision: the style guide does not allow people in photos).
 */
export const WORLD_W = 960;
export const WORLD_H = 600;

/** Phaser texture key → catalogue spec. */
export const GARDEN_ART = {
  bg: 'garden.bg',
  shed: 'garden.shed',
  well: 'garden.well',
  bed: 'garden.bed',
  sprout: 'garden.sprout',
  sunflower: 'garden.sunflower',
  lila: 'lila.idle',
} as const;
export type GardenArt = Record<keyof typeof GARDEN_ART, { url: string; approved: boolean }>;
const tex = (k: keyof typeof GARDEN_ART) => `art-${k}`;

type Box = [x: number, y: number, w: number, h: number];
interface Spot {
  img: Box; // where the image goes (centre and maximum box, without distortion)
  block: Box; // collision area
  click: Box; // clickable area
  labelY: number;
  point: { x: number; y: number }; // where the girl stands to talk
}
interface Layout {
  top: number; // the girl does not go above this line (in the photo backdrop, above it is sky and trees)
  perspective: boolean; // photo: the girl grows as she gets closer to the camera
  lila: Spot;
  shed: Spot;
  well: Spot;
  bed: Spot;
  sprouts: Array<[number, number]>;
  bloom: { row: (i: number) => [number, number]; big: Box };
}

/** Fallback drawing seen from above: the usual positions (the browser tests click on them). */
const DRAWN: Layout = {
  top: 0,
  perspective: false,
  lila: { img: [420, 256, 72, 64], block: [420, 268, 36, 24], click: [420, 262, 60, 50], labelY: 296, point: { x: 420, y: 262 } },
  shed: { img: [165, 131, 200, 200], block: [165, 140, 140, 110], click: [165, 150, 140, 120], labelY: 200, point: { x: 165, y: 232 } },
  well: { img: [790, 302, 200, 200], block: [790, 330, 90, 80], click: [790, 320, 100, 110], labelY: 430, point: { x: 790, y: 392 } },
  bed: { img: [480, 490, 300, 200], block: [480, 495, 230, 90], click: [480, 490, 230, 100], labelY: 552, point: { x: 480, y: 418 } },
  sprouts: [[420, 466], [480, 494], [540, 522]],
  bloom: { row: (i) => [392 + i * 44, 460 + (i % 2) * 34], big: [610, 430, 60, 100] },
};

/**
 * Approved photo (landscape in perspective): the top third is sky, trees and lake, so everything stays on the lawn.
 * Farther = smaller; the girl and the pieces are drawn in depth order.
 */
const PHOTO: Layout = {
  top: 250,
  perspective: true,
  lila: { img: [470, 296, 60, 52], block: [470, 312, 30, 18], click: [470, 300, 56, 46], labelY: 336, point: { x: 470, y: 306 } },
  shed: { img: [150, 300, 160, 160], block: [150, 340, 120, 70], click: [150, 300, 130, 150], labelY: 392, point: { x: 150, y: 410 } },
  well: { img: [800, 360, 170, 170], block: [800, 412, 90, 50], click: [800, 360, 110, 150], labelY: 462, point: { x: 800, y: 478 } },
  bed: { img: [480, 500, 300, 190], block: [480, 515, 230, 80], click: [480, 500, 230, 110], labelY: 570, point: { x: 480, y: 404 } },
  sprouts: [[430, 452], [480, 462], [530, 472]],
  bloom: { row: (i) => [400 + i * 40, 448 + (i % 2) * 20], big: [660, 440, 60, 100] },
};

/**
 * Flowers for confirmed levels (a reward that INFORMS: «you know more»), along the bottom edge,
 * on both sides of the potager. Same slots in both layouts.
 */
const FLOWER_SLOTS: Array<[number, number]> = [
  ...[60, 105, 150, 195, 240, 285].map((x) => [x, 586] as [number, number]),
  ...[675, 720, 765, 810, 855, 900].map((x) => [x, 586] as [number, number]),
  ...[82, 127, 172, 217, 262].map((x) => [x, 556] as [number, number]),
  ...[697, 742, 787, 832, 877].map((x) => [x, 556] as [number, number]),
];

const LABELS: Record<PointId, string> = { lila: 'Lila', shed: 'La remise', well: 'Le puits', bed: 'Le potager' };
const SPOTS: PointId[] = ['lila', 'shed', 'well', 'bed'];
/** Fixed layers above the depth-sorted pieces (which range from 0 to WORLD_H). */
const Z = { label: 900, star: 1000, prompt: 1010, objective: 1020 };

export class GardenScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private player!: Phaser.Physics.Arcade.Sprite;
  private layout: Layout = DRAWN;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private prompt!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private star!: Phaser.GameObjects.Image;
  private rewardLayer!: Phaser.GameObjects.Container;
  private controls = true;
  private lastSaved = { x: 0, y: 0 };
  private saveTimer = 0;
  private unsub: Array<() => void> = [];

  constructor() {
    super('garden');
  }

  /** Loads the catalogue pieces (approved photo or SVG fallback drawing). */
  preload() {
    const artMap = this.registry.get('art') as GardenArt | undefined;
    if (!artMap) return;
    for (const k of Object.keys(GARDEN_ART) as Array<keyof typeof GARDEN_ART>) {
      if (this.textures.exists(tex(k))) this.textures.remove(tex(k)); // approved art may have changed since the last visit
      const { url } = artMap[k];
      // SVG at a good size for the screen; approved photos arrive as WebP/PNG
      if (url.endsWith('.svg')) this.load.svg(tex(k), url, { width: k === 'bg' ? 1536 : 512, height: k === 'bg' ? 960 : 512 });
      else this.load.image(tex(k), url);
    }
  }

  create() {
    this.bridge = this.registry.get('bridge') as GameBridge;
    const artMap = this.registry.get('art') as GardenArt;
    this.makeTextures();

    const obstacles = this.physics.add.staticGroup();
    const block = (x: number, y: number, w: number, h: number) => {
      const z = this.add.zone(x, y, w, h);
      this.physics.add.existing(z, true);
      obstacles.add(z);
    };
    /** Catalogue image fitted into a box without distortion (like «contain»). */
    const place = (k: keyof typeof GARDEN_ART, x: number, y: number, w: number, h: number) => {
      const img = this.add.image(x, y, tex(k));
      img.setScale(Math.min(w / img.width, h / img.height));
      return img;
    };

    // Backdrop: approved photo (perspective) or the fallback drawing seen from above, each with its own layout
    const L = (this.layout = artMap.bg.approved ? PHOTO : DRAWN);
    this.add.image(WORLD_W / 2, WORLD_H / 2, tex('bg')).setDisplaySize(WORLD_W, WORLD_H).setDepth(-1);
    if (!artMap.bg.approved) {
      // in the fallback drawing, the lake and trees are still obstacles
      block(820, 120, 200, 100);
      for (const [x, y] of [[60, 470], [70, 360], [330, 80], [600, 70], [900, 520], [640, 560], [930, 300]] as Array<[number, number]>) block(x, y + 10, 40, 40);
    }

    // Lila (hérissonne, spec lila.idle), remise, puits and potager
    for (const id of SPOTS) {
      const sp = L[id];
      const img = place(id, sp.img[0], sp.img[1], sp.img[2], sp.img[3]);
      img.setDepth(img.y + img.displayHeight / 2); // the piece's base decides who is in front
      block(...sp.block);
      this.label(sp.point.x, sp.labelY, LABELS[id]);
      // clickable zone (alternative to the keyboard)
      const z = this.add.zone(sp.click[0], sp.click[1], sp.click[2], sp.click[3]).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        if (this.controls) this.bridge.emitFromGame('interact', id);
      });
    }

    this.rewardLayer = this.add.container(0, 0);
    this.rewardLayer.setDepth(L.bed.img[1] + L.bed.img[3] / 2 + 1); // pousses and tournesols on top of the potager

    // Player
    const start = this.bridge.lastView?.start;
    this.player = this.physics.add.sprite(start?.x ?? 480, start?.y ?? 320, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(22, 16).setOffset(5, 28);
    this.physics.world.setBounds(0, L.top, WORLD_W, WORLD_H - L.top);
    this.physics.add.collider(this.player, obstacles);
    this.lastSaved = { x: this.player.x, y: this.player.y };

    // Keyboard: no global capture, so React text fields are not blocked.
    const kb = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    this.keys = kb.addKeys('W,A,S,D,E,SPACE,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>;

    this.star = this.add.image(0, 0, 'star').setVisible(false).setDepth(Z.star);
    this.tweens.add({ targets: this.star, y: '-=10', duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.prompt = this.add
      .text(0, 0, 'Espace : parler', { fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '18px', color: '#1d2a3a', backgroundColor: '#fff8dc', padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(Z.prompt)
      .setVisible(false);

    this.objectiveText = this.add
      .text(16, 14, '', { fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '22px', color: '#1d2a3a', backgroundColor: '#fffbeaee', padding: { x: 12, y: 8 }, wordWrap: { width: 560 } })
      .setDepth(Z.objective)
      .setScrollFactor(0)
      .setVisible(false);
    this.unsub.push(this.bridge.onReact('controls', (on) => this.setControls(on)));
    this.unsub.push(this.bridge.onReact('view', (v) => this.applyView(v)));
    const cleanup = () => {
      this.unsub.forEach((u) => u());
      this.unsub = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.setControls(this.bridge.controlsEnabled);
    if (this.bridge.lastView) this.applyView(this.bridge.lastView);
    this.bridge.emitFromGame('ready', undefined);
  }

  private label(x: number, y: number, text: string) {
    this.add
      .text(x, y, text, { fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '16px', color: '#ffffff', backgroundColor: '#3b5d3acc', padding: { x: 6, y: 2 } })
      .setOrigin(0.5)
      .setDepth(Z.label);
  }

  private setControls(on: boolean) {
    this.controls = on;
    if (!this.sys?.isActive()) return;
    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = on;
      if (!on) kb.resetKeys();
    }
    if (!on && this.player) this.player.setVelocity(0, 0);
  }

  private applyView(v: WorldView) {
    if (!this.sys?.isActive() || !this.objectiveText?.active) return;
    // with no written objective the box disappears (before, an empty rectangle stayed in the corner)
    this.objectiveText.setText(v.objectiveText).setVisible(v.objectiveText.trim() !== '');
    if (v.objective) {
      const p = this.layout[v.objective].point;
      this.star.setPosition(p.x, p.y - 80).setVisible(true);
    } else this.star.setVisible(false);

    this.rewardLayer.removeAll(true);
    const has = (k: string) => v.rewards.includes(k);
    /** Catalogue piece fitted into a box without distortion. */
    const piece = (k: 'sprout' | 'sunflower', x: number, y: number, w: number, h: number) => {
      const img = this.add.image(x, y, tex(k));
      img.setScale(Math.min(w / img.width, h / img.height));
      return img;
    };
    // graines trouvées: one pousse per graine, in the potager's rows
    const L = this.layout;
    const seeds = ['seed.sunflower', 'seed.carrot', 'seed.tomato'];
    seeds.forEach((key, i) => {
      const at = L.sprouts[i];
      if (at && has(key)) this.rewardLayer.add(piece('sprout', at[0], at[1], 34, 34));
    });
    if (has('garden.bloom')) {
      // garden in bloom: tournesols in the potager and a big one beside it
      for (let i = 0; i < 5; i++) {
        const [x, y] = L.bloom.row(i);
        this.rewardLayer.add(piece('sunflower', x, y, 34, 56));
      }
      this.rewardLayer.add(piece('sunflower', ...L.bloom.big));
    }
    // one flower per confirmed level
    v.rewards
      .filter((k) => k.startsWith('flower.'))
      .slice(0, FLOWER_SLOTS.length)
      .forEach((_, i) => {
        const [x, y] = FLOWER_SLOTS[i] as [number, number];
        this.rewardLayer.add(piece('sunflower', x, y, 26, 44));
      });
  }

  private nearestPoint(): PointId | null {
    let best: PointId | null = null;
    let bestD = 85;
    for (const id of SPOTS) {
      const p = this.layout[id].point;
      const d = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  override update(_t: number, dt: number) {
    if (!this.player) return;
    // depth: whoever is lower on screen is in front; in the photo, closer = bigger
    const feet = this.player.y + 22 * this.player.scaleY;
    this.player.setDepth(feet);
    if (this.layout.perspective) this.player.setScale(0.85 + (0.65 * Math.max(0, feet - this.layout.top)) / (WORLD_H - this.layout.top));
    const near = this.controls ? this.nearestPoint() : null;
    if (near) {
      const p = this.layout[near].point;
      this.prompt.setText(near === 'lila' ? 'Espace : parler à Lila' : `Espace : ${LABELS[near]}`).setPosition(p.x, p.y - 48).setVisible(true);
    } else this.prompt.setVisible(false);

    if (!this.controls) {
      this.player.setVelocity(0, 0);
      return;
    }
    const k = this.keys;
    const speed = 190;
    let vx = 0;
    let vy = 0;
    if (k.LEFT?.isDown || k.A?.isDown) vx -= 1;
    if (k.RIGHT?.isDown || k.D?.isDown) vx += 1;
    if (k.UP?.isDown || k.W?.isDown) vy -= 1;
    if (k.DOWN?.isDown || k.S?.isDown) vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
    if (vx !== 0) this.player.setFlipX(vx < 0);

    if (near && ((k.SPACE && Phaser.Input.Keyboard.JustDown(k.SPACE)) || (k.E && Phaser.Input.Keyboard.JustDown(k.E)))) {
      this.player.setVelocity(0, 0);
      this.bridge.emitFromGame('interact', near);
    }

    this.saveTimer += dt;
    if (this.saveTimer > 1000) {
      this.saveTimer = 0;
      if (Math.hypot(this.player.x - this.lastSaved.x, this.player.y - this.lastSaved.y) > 4) {
        this.lastSaved = { x: this.player.x, y: this.player.y };
        this.bridge.emitFromGame('position', { x: Math.round(this.player.x), y: Math.round(this.player.y) });
      }
    }
  }

  private makeTextures() {
    if (this.textures.exists('player')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Melina (simple, temporary avatar)
    g.fillStyle(0x5a3825).fillCircle(16, 12, 11); // hair
    g.fillStyle(0xf2c9a0).fillCircle(16, 14, 8); // face
    g.fillStyle(0x5a3825).fillRect(6, 10, 4, 14).fillRect(22, 10, 4, 14);
    g.fillStyle(0xe8508f).fillTriangle(16, 20, 4, 40, 28, 40); // dress
    g.fillStyle(0x333333).fillRect(10, 40, 4, 4).fillRect(18, 40, 4, 4);
    g.fillStyle(0x222222).fillCircle(13, 14, 1.4).fillCircle(19, 14, 1.4);
    g.generateTexture('player', 32, 44);
    g.clear();
    // objective star
    g.fillStyle(0xffd23f).lineStyle(3, 0xc99700);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 16 : 7;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(new Phaser.Math.Vector2(18 + r * Math.cos(a), 18 + r * Math.sin(a)));
    }
    g.fillPoints(pts, true).strokePoints(pts, true);
    g.generateTexture('star', 36, 36);
    g.destroy();
  }
}
