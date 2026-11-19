import Phaser from 'phaser';
import type { GameBridge, PointId, WorldView } from './bridge';

/**
 * Garden scene (paper activities).
 * Backdrop, remise, puits, potager, Lila and rewards come from the ART CATALOGUE (specs garden.* and lila.idle):
 * a photo approved by the parents in the studio, or the spec's fallback drawing (original SVGs in /art/scene).
 * The child walks as a drawn avatar (/art/scene/girl.svg; the style guide does not allow people in photos).
 *
 * The world keeps its 960×600 coordinates (saved positions, layouts, tests), but the canvas is RENDER_SCALE times
 * bigger and the camera zooms in, so the art and the text stay sharp on a full-screen window.
 */
export const WORLD_W = 960;
export const WORLD_H = 600;
export const RENDER_SCALE = 2;

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

/** Built-in pieces that are not catalogue cards: the avatar and the Fluent icons used in the chips. */
const EXTRA_ART: Record<string, { url: string; w?: number; h?: number }> = {
  kid: { url: '/art/scene/girl.svg', w: 40 * RENDER_SCALE, h: 55 * RENDER_SCALE },
  'icon-star': { url: '/art/glowing_star.png' },
  'icon-sparkles': { url: '/art/sparkles.png' },
  'icon-abacus': { url: '/art/abacus.png' },
  'icon-book': { url: '/art/open_book.png' },
  'icon-pencil': { url: '/art/pencil.png' },
};

type Box = [x: number, y: number, w: number, h: number];
interface Spot {
  img: Box; // where the image goes (centre and maximum box, without distortion)
  block: Box; // collision area
  click: Box; // clickable area
  label: [number, number]; // name chip
  wait: [number, number]; // «Ta feuille attend un parent» chip, under the spot where she stands
  mark: [number, number]; // objective star / «waiting sheet» chip
  point: { x: number; y: number }; // where the child stands to talk (reachable: outside every block)
}
interface Layout {
  top: number; // the child does not go above this line (in the photo backdrop, above it is sky and trees)
  perspective: boolean; // photo: the child grows as she gets closer to the camera
  lila: Spot;
  shed: Spot;
  well: Spot;
  bed: Spot;
  sprouts: Array<[number, number]>;
  bloom: { row: (i: number) => [number, number]; big: Box };
  /** Obstacles drawn in the backdrop itself (trees, pond, fence): only for the fallback drawing. */
  scenery: Box[];
}

/** Fallback drawing seen from above (garden-bg.svg): the usual positions (the browser tests click on them). */
const DRAWN: Layout = {
  top: 0,
  perspective: false,
  lila: { img: [420, 252, 84, 74], block: [420, 268, 40, 22], click: [420, 256, 90, 80], label: [420, 300], wait: [420, 350], mark: [420, 192], point: { x: 424, y: 312 } },
  shed: { img: [165, 150, 200, 200], block: [166, 162, 136, 106], click: [165, 152, 160, 190], label: [165, 64], wait: [165, 306], mark: [262, 70], point: { x: 165, y: 266 } },
  well: { img: [790, 300, 190, 190], block: [790, 330, 92, 70], click: [790, 300, 130, 180], label: [790, 196], wait: [790, 442], mark: [790, 158], point: { x: 790, y: 400 } },
  bed: { img: [480, 490, 300, 200], block: [480, 494, 232, 92], click: [480, 494, 250, 120], label: [480, 572], wait: [480, 538], mark: [480, 384], point: { x: 480, y: 416 } },
  sprouts: [[420, 466], [480, 494], [540, 522]],
  bloom: { row: (i) => [392 + i * 44, 462 + (i % 2) * 28], big: [652, 452, 60, 100] },
  scenery: [
    [826, 124, 236, 128], // pond
    [480, 12, 960, 24], // fence
    [330, 66, 60, 60], [598, 58, 60, 60], [52, 330, 60, 60], [58, 468, 60, 60], [930, 300, 60, 60], [908, 470, 60, 60], // trees
    [36, 196, 50, 26], [300, 236, 50, 26], [612, 548, 50, 26], [948, 404, 40, 26], // bushes
  ],
};

/**
 * Approved photo (landscape in perspective): the top third is sky, trees and lake, so everything stays on the lawn.
 * Farther = smaller; the child and the pieces are drawn in depth order.
 */
const PHOTO: Layout = {
  top: 250,
  perspective: true,
  lila: { img: [470, 296, 60, 52], block: [470, 312, 30, 18], click: [470, 300, 70, 60], label: [470, 334], wait: [470, 380], mark: [470, 254], point: { x: 470, y: 344 } },
  shed: { img: [150, 300, 160, 160], block: [150, 340, 120, 70], click: [150, 300, 140, 160], label: [150, 210], wait: [150, 448], mark: [150, 176], point: { x: 150, y: 410 } },
  well: { img: [800, 360, 170, 170], block: [800, 412, 90, 50], click: [800, 360, 120, 160], label: [800, 268], wait: [800, 516], mark: [800, 232], point: { x: 800, y: 478 } },
  bed: { img: [480, 500, 300, 190], block: [480, 515, 230, 80], click: [480, 500, 240, 120], label: [480, 580], wait: [480, 548], mark: [480, 372], point: { x: 480, y: 404 } },
  sprouts: [[430, 452], [480, 462], [530, 472]],
  bloom: { row: (i) => [400 + i * 40, 448 + (i % 2) * 20], big: [660, 440, 60, 100] },
  scenery: [],
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
/** Little icon of each chip: the subject of the station (maths, reading) or what grows there. */
const LABEL_ICONS: Record<PointId, string> = { lila: tex('lila'), shed: 'icon-abacus', well: 'icon-book', bed: tex('sprout') };
const SPOTS: PointId[] = ['lila', 'shed', 'well', 'bed'];
/** Fixed layers above the depth-sorted pieces (which range from 0 to WORLD_H). */
const Z = { cloud: 700, halo: 2, label: 900, mark: 1000, prompt: 1010, objective: 1020 };
/** The generated textures are RENDER_SCALE times bigger than their size in the world. */
const HALO = 1 / RENDER_SCALE;
const FONT ='Fredoka, "Trebuchet MS", "Segoe UI", sans-serif';
const WAITING_TEXT = 'Ta feuille attend un parent';

/** Rounded «chip» look (name of a station, objective, hints). */
interface ChipStyle {
  fill: number;
  stroke: number;
  color: string;
  size: number;
}
const CHIP: Record<'label' | 'hot' | 'wait' | 'prompt' | 'goal', ChipStyle> = {
  label: { fill: 0xffffff, stroke: 0xcfe2c4, color: '#1f2d47', size: 15 },
  hot: { fill: 0xfff3c4, stroke: 0xf2b830, color: '#5a3d00', size: 15 },
  wait: { fill: 0xfff1e2, stroke: 0xf0a35e, color: '#7a3d12', size: 14 },
  prompt: { fill: 0x2f7d4f, stroke: 0x2f7d4f, color: '#ffffff', size: 14 },
  goal: { fill: 0xfffdf4, stroke: 0xf2cf6b, color: '#1f2d47', size: 18 },
};
interface Chip {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image | null;
  style: ChipStyle;
  drawn?: string;
}

/** A click on the map: she walks there; on a station, she talks on arrival. */
interface WalkTarget {
  x: number;
  y: number;
  then: PointId | null;
  startedAt: number;
  checkAt: number;
  checkX: number;
  checkY: number;
}

export class GardenScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private layout: Layout = DRAWN;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private prompt!: Chip;
  private objective!: Chip;
  private labels = {} as Record<PointId, Chip>;
  private props = {} as Record<PointId, Phaser.GameObjects.Image>;
  /** «Ta feuille attend un parent» chip of each station (hidden unless a sheet waits there). */
  private waitChips = {} as Record<PointId, { chip: Chip; zone: Phaser.GameObjects.Zone }>;
  private star!: Phaser.GameObjects.Image;
  private goalHalo!: Phaser.GameObjects.Image;
  private nearHalo!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private rewardLayer!: Phaser.GameObjects.Container;
  private controls = true;
  private near: PointId | null = null;
  private target: WalkTarget | null = null;
  private lastSaved = { x: 0, y: 0 };
  private saveTimer = 0;
  private unsub: Array<() => void> = [];

  constructor() {
    super('garden');
  }

  /** Loads the catalogue pieces (approved photo or SVG fallback drawing) and the built-in icons. */
  preload() {
    const artMap = this.registry.get('art') as GardenArt | undefined;
    if (!artMap) return;
    for (const k of Object.keys(GARDEN_ART) as Array<keyof typeof GARDEN_ART>) {
      if (this.textures.exists(tex(k))) this.textures.remove(tex(k)); // approved art may have changed since the last visit
      const { url } = artMap[k];
      // SVG rasterized at its on-screen size × RENDER_SCALE; approved photos arrive as WebP/PNG
      const [w, h] = k === 'bg' ? [WORLD_W, WORLD_H] : k === 'bed' ? [300, 200] : [200, 200];
      if (url.endsWith('.svg')) this.load.svg(tex(k), url, { width: w * RENDER_SCALE, height: h * RENDER_SCALE });
      else this.load.image(tex(k), url);
    }
    for (const [key, a] of Object.entries(EXTRA_ART)) {
      if (this.textures.exists(key)) continue;
      if (a.url.endsWith('.svg')) this.load.svg(key, a.url, { width: a.w ?? 128, height: a.h ?? 128 });
      else this.load.image(key, a.url);
    }
  }

  create() {
    this.bridge = this.registry.get('bridge') as GameBridge;
    const artMap = this.registry.get('art') as GardenArt;
    this.makeTextures();
    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE).centerOn(WORLD_W / 2, WORLD_H / 2);

    const obstacles = this.physics.add.staticGroup();
    const block = (x: number, y: number, w: number, h: number) => {
      const z = this.add.zone(x, y, w, h);
      this.physics.add.existing(z, true);
      obstacles.add(z);
    };
    /** Catalogue image fitted into a box without distortion (like «contain»). */
    const place = (key: string, x: number, y: number, w: number, h: number) => {
      const img = this.add.image(x, y, key);
      img.setScale(Math.min(w / img.width, h / img.height));
      return img;
    };

    // Backdrop: approved photo (perspective) or the fallback drawing seen from above, each with its own layout
    const L = (this.layout = artMap.bg.approved ? PHOTO : DRAWN);
    this.add.image(WORLD_W / 2, WORLD_H / 2, tex('bg')).setDisplaySize(WORLD_W, WORLD_H).setDepth(-10);
    for (const b of L.scenery) block(...b);

    // halos on the ground: the objective (gold, pulsing) and the station she is standing at
    this.goalHalo = this.add.image(0, 0, 'halo').setTint(0xffd23f).setDepth(Z.halo).setVisible(false);
    this.tweens.add({ targets: this.goalHalo, alpha: { from: 0.95, to: 0.35 }, scale: { from: HALO, to: HALO * 1.18 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.nearHalo = this.add.image(0, 0, 'halo').setScale(HALO * 0.9).setTint(0xffffff).setAlpha(0.8).setDepth(Z.halo + 1).setVisible(false);
    this.marker = this.add.image(0, 0, 'halo').setTint(0xffffff).setDepth(Z.halo).setVisible(false);

    // Lila (hérissonne, spec lila.idle), remise, puits and potager
    for (const id of SPOTS) {
      const sp = L[id];
      const img = place(tex(id), sp.img[0], sp.img[1], sp.img[2], sp.img[3]);
      img.setDepth(img.y + img.displayHeight / 2); // the piece's base decides who is in front
      img.setData('baseScale', img.scaleX);
      this.props[id] = img;
      block(...sp.block);
      this.labels[id] = this.makeChip(sp.label[0], sp.label[1], LABELS[id], CHIP.label, LABEL_ICONS[id]);
      this.labels[id].box.setDepth(Z.label);
      // clickable zone: she walks there and talks on arrival (alternative to the keyboard)
      this.add.zone(sp.click[0], sp.click[1], sp.click[2], sp.click[3]).setInteractive({ useHandCursor: true }).setData('spot', id);
      // the name chip counts as the station too
      const lb = this.labels[id].box;
      this.add.zone(lb.x, lb.y, lb.width, lb.height).setInteractive({ useHandCursor: true }).setData('spot', id);
    }
    // Lila breathes and looks around now and then
    const lila = this.props.lila;
    this.add.image(lila.x + 2, lila.y + lila.displayHeight / 2 - 4, 'shadow').setDisplaySize(lila.displayWidth * 0.8, 14).setDepth(lila.depth - 0.5);
    this.tweens.add({ targets: lila, scaleY: lila.scaleY * 1.04, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => {
        if (lila.active) this.tweens.add({ targets: lila, y: lila.y - 6, duration: 160, yoyo: true, ease: 'Quad.out' });
      },
    });

    this.rewardLayer = this.add.container(0, 0);
    this.rewardLayer.setDepth(L.bed.img[1] + L.bed.img[3] / 2 + 1); // pousses and tournesols on top of the potager

    // The child
    const start = this.bridge.lastView?.start;
    this.player = this.physics.add.sprite(start?.x ?? 480, start?.y ?? 320, 'kid');
    this.player.setDisplaySize(40, 55);
    this.player.setCollideWorldBounds(true);
    // feet-sized body (in texture pixels: the texture is RENDER_SCALE times the display size)
    const s = RENDER_SCALE;
    this.player.body?.setSize(22 * s, 12 * s).setOffset(9 * s, 41 * s);
    this.physics.world.setBounds(0, L.top, WORLD_W, WORLD_H - L.top);
    this.physics.add.collider(this.player, obstacles);
    this.shadow = this.add.image(this.player.x, this.player.y, 'shadow').setDisplaySize(30, 10);
    this.lastSaved = { x: this.player.x, y: this.player.y };

    // Keyboard: no global capture, so React text fields are not blocked.
    const kb = this.input.keyboard as Phaser.Input.Keyboard.KeyboardPlugin;
    this.keys = kb.addKeys('W,A,S,D,E,SPACE,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>;

    // Click / tap: on a station she walks there and talks; on the grass she just walks there
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.controls) return;
      const id = over.map((o) => o.getData('spot') as PointId | undefined).find(Boolean) ?? null;
      if (id) this.walkTo(L[id].point.x, L[id].point.y, id);
      else this.walkTo(p.worldX, p.worldY, null);
    });

    this.star = this.add.image(0, 0, 'icon-star').setDisplaySize(42, 42).setVisible(false).setDepth(Z.mark);
    this.tweens.add({ targets: this.star, y: '-=9', duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    for (const id of SPOTS) {
      const [x, y] = L[id].wait;
      const chip = this.makeChip(x, y, WAITING_TEXT, CHIP.wait, 'icon-pencil');
      chip.box.setDepth(Z.mark).setVisible(false);
      // a click on the chip goes to its station (the zone is only interactive while the chip shows)
      const zone = this.add.zone(x, y, chip.box.width, chip.box.height).setData('spot', id);
      this.waitChips[id] = { chip, zone };
    }
    this.prompt = this.makeChip(0, 0, '', CHIP.prompt);
    this.prompt.box.setDepth(Z.prompt).setVisible(false);
    this.objective = this.makeChip(WORLD_W / 2, 50, '', CHIP.goal);
    this.objective.box.setDepth(Z.objective).setVisible(false);
    this.makeClouds();

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

  // ---------------------------------------------------------------- chips

  private makeChip(x: number, y: number, text: string, style: ChipStyle, iconKey?: string): Chip {
    const bg = this.add.graphics();
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${style.size}px`, fontStyle: '600', color: style.color, resolution: RENDER_SCALE }).setOrigin(0, 0.5);
    const icon = iconKey && this.textures.exists(iconKey) ? this.add.image(0, 0, iconKey) : null;
    const box = this.add.container(x, y, icon ? [bg, icon, t] : [bg, t]);
    const chip: Chip = { box, bg, text: t, icon, style };
    this.layoutChip(chip);
    return chip;
  }

  private layoutChip(chip: Chip, text?: string, style?: ChipStyle) {
    if (style && style !== chip.style) {
      chip.style = style;
      chip.text.setColor(style.color).setFontSize(style.size);
    }
    if (text !== undefined && text !== chip.text.text) chip.text.setText(text);
    const st = chip.style;
    // called every frame for the hint above her head: only redraw when something changed
    const key = `${chip.text.text}|${st.fill}|${st.size}`;
    if (chip.drawn === key) return;
    chip.drawn = key;
    const iconSize = Math.round(st.size * 1.45);
    const gap = chip.icon ? 6 : 0;
    const padX = 12;
    const w = Math.ceil(chip.text.width + padX * 2 + (chip.icon ? iconSize + gap : 0));
    const h = Math.ceil(Math.max(chip.text.height, iconSize) + 10);
    const left = -w / 2;
    if (chip.icon) {
      chip.icon.setScale(Math.min(iconSize / chip.icon.width, iconSize / chip.icon.height));
      chip.icon.setPosition(left + padX + iconSize / 2, 0);
    }
    chip.text.setPosition(left + padX + (chip.icon ? iconSize + gap : 0), 0);
    const g = chip.bg.clear();
    g.fillStyle(0x1f2d47, 0.18).fillRoundedRect(left, -h / 2 + 3, w, h, h / 2);
    g.fillStyle(st.fill, 0.97).fillRoundedRect(left, -h / 2, w, h, h / 2);
    g.lineStyle(2, st.stroke, 1).strokeRoundedRect(left, -h / 2, w, h, h / 2);
    chip.box.setSize(w, h);
  }

  // ---------------------------------------------------------------- state from React

  private setControls(on: boolean) {
    this.controls = on;
    if (!this.sys?.isActive()) return;
    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = on;
      if (!on) kb.resetKeys();
    }
    if (!on) {
      this.target = null;
      this.marker?.setVisible(false);
      this.player?.setVelocity(0, 0);
    }
  }

  private applyView(v: WorldView) {
    if (!this.sys?.isActive() || !this.objective?.box.active) return;
    // with no written objective the chip disappears
    const goal = v.objectiveText.trim();
    this.layoutChip(this.objective, goal);
    this.objective.box.setVisible(goal !== '');

    // a sheet waiting for a parent: a calm chip on its station (never a pop-up), instead of the star
    const waiting = v.waiting ?? [];
    this.game.canvas.setAttribute('data-waiting', waiting.join(','));
    for (const id of SPOTS) {
      const { chip, zone } = this.waitChips[id];
      const on = waiting.includes(id);
      chip.box.setVisible(on);
      if (on) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
    }
    const star = v.objective && !waiting.includes(v.objective) ? v.objective : null;
    if (star) {
      const m = this.layout[star].mark;
      const p = this.layout[star].point;
      this.tweens.killTweensOf(this.star);
      this.star.setPosition(m[0], m[1]).setVisible(true);
      this.tweens.add({ targets: this.star, y: m[1] - 9, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.goalHalo.setPosition(p.x, p.y + 20).setVisible(true);
    } else {
      this.star.setVisible(false);
      this.goalHalo.setVisible(false);
    }

    for (const child of this.rewardLayer.list) this.tweens.killTweensOf(child);
    this.rewardLayer.removeAll(true);
    const has = (k: string) => v.rewards.includes(k);
    /** Catalogue piece fitted into a box without distortion, swaying gently in the breeze. */
    const piece = (k: 'sprout' | 'sunflower', x: number, y: number, w: number, h: number) => {
      const img = this.add.image(x, y + h / 2, tex(k)).setOrigin(0.5, 1);
      img.setScale(Math.min(w / img.width, h / img.height));
      img.setAngle(-2);
      this.tweens.add({ targets: img, angle: 2, duration: 1400 + ((x * 7) % 600), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return img;
    };
    // graines trouvées: one pousse per graine, in the potager's rows
    const L = this.layout;
    const seeds = ['seed.sunflower', 'seed.carrot', 'seed.tomato'];
    seeds.forEach((key, i) => {
      const at = L.sprouts[i];
      if (at && has(key)) this.rewardLayer.add(piece('sprout', at[0], at[1], 36, 36));
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

  // ---------------------------------------------------------------- movement

  private walkTo(x: number, y: number, then: PointId | null) {
    const L = this.layout;
    const tx = Phaser.Math.Clamp(x, 14, WORLD_W - 14);
    const ty = Phaser.Math.Clamp(y, L.top + 30, WORLD_H - 30);
    const now = this.time.now;
    this.target = { x: tx, y: ty, then, startedAt: now, checkAt: now + 400, checkX: this.player.x, checkY: this.player.y };
    // a small ring where she is going (only on the grass: a station already has its own halo)
    this.tweens.killTweensOf(this.marker);
    if (then) this.marker.setVisible(false);
    else {
      this.marker.setPosition(tx, ty + 20).setScale(HALO * 0.5).setAlpha(0.9).setVisible(true);
      this.tweens.add({ targets: this.marker, scale: HALO * 0.8, alpha: 0, duration: 700, ease: 'Quad.out', onComplete: () => this.marker.setVisible(false) });
    }
  }

  /** Follows a click: straight line; if she gets stuck (a tree), she stops, or talks if it was a station. */
  private followTarget(): boolean {
    const t = this.target;
    if (!t) return false;
    const dx = t.x - this.player.x;
    const dy = t.y - this.player.y;
    const d = Math.hypot(dx, dy);
    const arrive = (talk: boolean) => {
      this.target = null;
      this.player.setVelocity(0, 0);
      if (talk && t.then) this.interact(t.then);
    };
    if (d < 6) {
      arrive(true);
      return true;
    }
    const now = this.time.now;
    if (now >= t.checkAt) {
      const moved = Math.hypot(this.player.x - t.checkX, this.player.y - t.checkY);
      // stuck behind something, or walking for too long: the click on a station still counts
      if (moved < 4 || now - t.startedAt > 7000) {
        arrive(true);
        return true;
      }
      t.checkAt = now + 400;
      t.checkX = this.player.x;
      t.checkY = this.player.y;
    }
    const speed = Math.min(230, d * 8);
    this.player.setVelocity((dx / d) * speed, (dy / d) * speed);
    if (Math.abs(dx) > 2) this.player.setFlipX(dx < 0);
    return true;
  }

  private interact(id: PointId) {
    if (!this.controls) return;
    this.player.setVelocity(0, 0);
    this.bridge.emitFromGame('interact', id);
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

  /** Gentle feedback when she reaches a station: the chip lights up, the piece bounces and a few sparkles rise. */
  private onArrive(id: PointId | null, prev: PointId | null) {
    if (prev) {
      this.layoutChip(this.labels[prev], undefined, CHIP.label);
      this.labels[prev].box.setScale(1);
    }
    if (!id) {
      this.nearHalo.setVisible(false);
      return;
    }
    const chip = this.labels[id];
    this.layoutChip(chip, undefined, CHIP.hot);
    this.tweens.add({ targets: chip.box, scale: { from: 1, to: 1.12 }, duration: 160, yoyo: true, ease: 'Quad.out' });
    const prop = this.props[id];
    const base = prop.getData('baseScale') as number;
    if (id !== 'lila') this.tweens.add({ targets: prop, scaleX: base * 1.03, scaleY: base * 0.97, duration: 140, yoyo: true, ease: 'Quad.out', onComplete: () => prop.setScale(base) });
    const p = this.layout[id].point;
    this.nearHalo.setPosition(p.x, p.y + 20).setVisible(true);
    for (let i = 0; i < 4; i++) {
      const sx = p.x - 30 + i * 20 + Phaser.Math.Between(-4, 4);
      const sp = this.add.image(sx, p.y - 10, 'icon-sparkles').setDisplaySize(16, 16).setDepth(Z.prompt - 1).setAlpha(0);
      this.tweens.add({ targets: sp, y: p.y - 46 - i * 4, alpha: { from: 1, to: 0 }, duration: 700 + i * 90, delay: i * 60, ease: 'Quad.out', onComplete: () => sp.destroy() });
    }
  }

  override update(_t: number, dt: number) {
    if (!this.player) return;
    // depth: whoever is lower on screen is in front; in the photo, closer = bigger
    const feet = this.player.y + 27 * (this.player.displayHeight / 55);
    this.player.setDepth(feet);
    if (this.layout.perspective) {
      const k = 0.85 + (0.65 * Math.max(0, feet - this.layout.top)) / (WORLD_H - this.layout.top);
      this.player.setDisplaySize(40 * k, 55 * k);
    }
    this.shadow.setPosition(this.player.x + 1, feet - 2).setDepth(feet - 1).setDisplaySize(30 * (this.player.displayWidth / 40), 10 * (this.player.displayWidth / 40));

    // the position is saved even while a dialog is open (it opens right when she arrives)
    this.saveTimer += dt;
    if (this.saveTimer > 1000) {
      this.saveTimer = 0;
      if (Math.hypot(this.player.x - this.lastSaved.x, this.player.y - this.lastSaved.y) > 4) {
        this.lastSaved = { x: this.player.x, y: this.player.y };
        this.bridge.emitFromGame('position', { x: Math.round(this.player.x), y: Math.round(this.player.y) });
      }
    }

    // the station lights up while she stands there (also behind a dialog, so closing it does not replay the sparkles)
    const near = this.nearestPoint();
    if (near !== this.near) {
      this.onArrive(near, this.near);
      this.near = near;
    }
    if (near && this.controls && !this.target) {
      this.layoutChip(this.prompt, near === 'lila' ? 'Espace : parler à Lila' : 'Espace : on y va!');
      this.prompt.box.setPosition(this.player.x, this.player.y - 44 * (this.player.displayHeight / 55)).setVisible(true);
    } else this.prompt.box.setVisible(false);

    if (!this.controls) {
      this.player.setVelocity(0, 0);
      this.player.setAngle(0);
      return;
    }
    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k.LEFT?.isDown || k.A?.isDown) vx -= 1;
    if (k.RIGHT?.isDown || k.D?.isDown) vx += 1;
    if (k.UP?.isDown || k.W?.isDown) vy -= 1;
    if (k.DOWN?.isDown || k.S?.isDown) vy += 1;
    let moving: boolean;
    if (vx !== 0 || vy !== 0) {
      // the keyboard always wins over a click in progress
      this.target = null;
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * 200, (vy / len) * 200);
      if (vx !== 0) this.player.setFlipX(vx < 0);
      moving = true;
    } else {
      moving = this.followTarget();
      if (!moving) this.player.setVelocity(0, 0);
    }
    // a little waddle while walking
    this.player.setAngle(moving ? Math.sin(this.time.now / 70) * 6 : 0);

    if (near && this.controls && ((k.SPACE && Phaser.Input.Keyboard.JustDown(k.SPACE)) || (k.E && Phaser.Input.Keyboard.JustDown(k.E)))) {
      this.target = null;
      this.interact(near);
    }
  }

  /** Two soft cloud shadows drifting slowly over the lawn (fallback drawing only: a photo has its own light). */
  private makeClouds() {
    if (this.layout.perspective) return;
    [
      { y: 180, s: 1, delay: 0 },
      { y: 450, s: 0.8, delay: 26000 },
    ].forEach(({ y, s, delay }) => {
      const c = this.add.image(-200, y, 'cloud-shadow').setScale(s / RENDER_SCALE).setAlpha(0.09).setDepth(Z.cloud);
      this.tweens.add({ targets: c, x: WORLD_W + 200, duration: 52000, delay, repeat: -1 });
    });
  }

  private makeTextures() {
    const s = RENDER_SCALE;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    if (!this.textures.exists('shadow')) {
      g.fillStyle(0x1f4d24, 0.28).fillEllipse(30 * s, 10 * s, 60 * s, 20 * s);
      g.generateTexture('shadow', 60 * s, 20 * s);
      g.clear();
    }
    if (!this.textures.exists('halo')) {
      // flat ring seen from above, tinted at use (gold = objective, white = where she stands)
      g.lineStyle(5 * s, 0xffffff, 0.9).strokeEllipse(40 * s, 14 * s, 72 * s, 22 * s);
      g.fillStyle(0xffffff, 0.25).fillEllipse(40 * s, 14 * s, 72 * s, 22 * s);
      g.generateTexture('halo', 80 * s, 28 * s);
      g.clear();
    }
    if (!this.textures.exists('cloud-shadow')) {
      g.fillStyle(0x1f3d2a, 1);
      g.fillEllipse(110 * s, 50 * s, 180 * s, 70 * s).fillEllipse(70 * s, 40 * s, 110 * s, 60 * s).fillEllipse(160 * s, 42 * s, 100 * s, 56 * s);
      g.generateTexture('cloud-shadow', 220 * s, 100 * s);
    }
    g.destroy();
  }
}
