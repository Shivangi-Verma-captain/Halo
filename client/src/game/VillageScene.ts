import Phaser from "phaser";
import { AVATARS, SOLIDS, WORLD, type AvatarId } from "@moon/shared";

export interface RemotePlayer {
  id: string;
  name: string;
  avatar: AvatarId;
  x: number;
  y: number;
}

export interface Interactable {
  id: string;
  x: number;
  y: number;
  kind: "clue" | "task";
  taken?: boolean;
  done?: boolean;
}

interface AvatarSprites {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
}

function avatarColor(id: AvatarId): number {
  const a = AVATARS.find((a) => a.id === id);
  if (!a) return 0x8f7bd8;
  return parseInt(a.coat.replace("#", ""), 16);
}

export class VillageScene extends Phaser.Scene {
  private meId = "";
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<string, Phaser.Input.Keyboard.Key> = {};
  private avatars = new Map<string, AvatarSprites>();
  private meMarker: RemotePlayer | null = null;
  private interactables: Interactable[] = [];
  private markers = new Map<string, Phaser.GameObjects.Container>();
  private onMove: ((x: number, y: number) => void) | null = null;
  private lastEmit = 0;
  private lastStepSfx = 0;
  private onStep: (() => void) | null = null;
  private fireflies: Phaser.GameObjects.Arc[] = [];
  private reducedMotion = false;

  constructor() {
    super("village");
  }

  setIdentity(meId: string) {
    this.meId = meId;
  }

  setMoveCallback(cb: (x: number, y: number) => void) {
    this.onMove = cb;
  }

  setStepCallback(cb: () => void) {
    this.onStep = cb;
  }

  setInteractables(list: Interactable[]) {
    this.interactables = list;
    this.refreshMarkers();
  }

  /** Called from React whenever socket state changes. */
  syncPlayers(players: RemotePlayer[]) {
    for (const p of players) {
      const existing = this.avatars.get(p.id);
      if (!existing) {
        this.createAvatar(p);
      } else {
        existing.targetX = p.x;
        existing.targetY = p.y;
        if (p.id !== this.meId) {
          // Snap only on huge jumps (late join); otherwise lerp in update().
          const dx = p.x - existing.container.x;
          const dy = p.y - existing.container.y;
          if (Math.hypot(dx, dy) > 600) {
            existing.container.setPosition(p.x, p.y);
            existing.targetX = p.x;
            existing.targetY = p.y;
          }
        } else {
          // Local player: server is truth only for spawn; don't fight input.
          this.meMarker = p;
        }
        const label = existing.label;
        if (label.text !== p.name) label.setText(p.name);
      }
    }
    // Remove players who left (no ghost players).
    for (const [id, spr] of this.avatars) {
      if (!players.some((p) => p.id === id)) {
        spr.container.destroy(true);
        this.avatars.delete(id);
      }
    }
  }

  create() {
    this.reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // World bounds + camera
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setZoom(1);
    this.cameras.main.backgroundColor.setTo(26, 27, 58);

    this.drawGround();
    this.drawBuildings();
    this.drawFireflies();

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    const kb = this.input.keyboard!;
    this.wasd = {
      W: kb.addKey("W"),
      A: kb.addKey("A"),
      S: kb.addKey("S"),
      D: kb.addKey("D"),
    };

    // Static collision bodies matching shared SOLIDS exactly.
    const statics = this.physics.add.staticGroup();
    for (const s of SOLIDS) {
      const rect = this.add.rectangle(
        s.x + s.w / 2,
        s.y + s.h / 2,
        s.w,
        s.h,
        0x000000,
        0,
      );
      statics.add(rect);
    }
    // Store for manual resolve (we move the local container manually).
    this.data.set("statics", statics);

    this.refreshMarkers();
  }

  private drawGround() {
    const g = this.add.graphics();
    // Night meadow base
    g.fillStyle(0x2c3a55, 1);
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Plaza circle around fountain
    g.fillStyle(0x3a4666, 1);
    g.fillCircle(800, 600, 210);
    g.fillStyle(0x46547a, 1);
    g.fillCircle(800, 600, 170);
    // Paths
    g.lineStyle(46, 0x4d5b7d, 1);
    g.beginPath();
    g.moveTo(800, 600);
    g.lineTo(800, 200);
    g.moveTo(800, 600);
    g.lineTo(800, 1050);
    g.moveTo(800, 600);
    g.lineTo(200, 600);
    g.moveTo(800, 600);
    g.lineTo(1350, 900);
    g.strokePath();
    // Grass tufts (deterministic pseudo-random)
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    g.fillStyle(0x4e6b62, 1);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * WORLD.width;
      const y = rnd() * WORLD.height;
      g.fillTriangle(x, y, x + 9, y, x + 4, y - 12);
    }
    // Stars in the "sky vignette" border
    g.fillStyle(0xf7ead7, 0.8);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * WORLD.width;
      const y = rnd() * 90;
      g.fillCircle(x, y, 1.4);
    }
  }

  private drawBuildings() {
    const g = this.add.graphics();

    const cottage = (x: number, y: number, w: number, h: number, wall: number, roof: number) => {
      g.fillStyle(wall, 1);
      g.fillRoundedRect(x, y + 40, w, h - 40, 6);
      g.fillStyle(roof, 1);
      g.fillTriangle(x - 14, y + 46, x + w / 2, y - 34, x + w + 14, y + 46);
      // Warm windows
      g.fillStyle(0xf2c572, 1);
      g.fillRoundedRect(x + 24, y + 78, 34, 30, 4);
      g.fillRoundedRect(x + w - 58, y + 78, 34, 30, 4);
      // Window glow halo
      g.fillStyle(0xf2c572, 0.12);
      g.fillCircle(x + 41, y + 93, 34);
      g.fillCircle(x + w - 41, y + 93, 34);
    };

    cottage(150, 220, 220, 170, 0x8a7f9e, 0x4a4a68);
    cottage(1230, 220, 220, 170, 0x9e8fa8, 0x4a4a68);
    // Library (wider, teal door)
    cottage(150, 800, 260, 180, 0x7d90a8, 0x3f5a6e);
    g.fillStyle(0x2f4f4f, 1);
    g.fillRoundedRect(255, 880, 50, 80, 6);
    // Clock tower
    g.fillStyle(0x6b6486, 1);
    g.fillRect(700, 120, 200, 160);
    g.fillStyle(0x4a4a68, 1);
    g.fillTriangle(688, 122, 800, 30, 912, 122);
    g.fillStyle(0xf7ead7, 1);
    g.fillCircle(800, 190, 34);
    g.fillStyle(0x1a1b3a, 1);
    g.fillCircle(800, 190, 28);
    g.fillStyle(0xf7ead7, 1);
    g.fillRect(798, 168, 4, 24);
    g.fillRect(798, 188, 20, 4);
    // Observatory dome
    g.fillStyle(0x5b6b8c, 1);
    g.fillRect(1180, 880, 280, 120);
    g.fillStyle(0x8f7bd8, 1);
    g.beginPath();
    g.arc(1320, 880, 120, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xf2c572, 0.9);
    g.fillRect(1310, 800, 20, 60);
    // Fountain
    g.fillStyle(0x7d90c9, 1);
    g.fillCircle(800, 600, 60);
    g.fillStyle(0xa8c3e8, 1);
    g.fillCircle(800, 600, 44);
    g.fillStyle(0x8f7bd8, 1);
    g.fillRect(794, 540, 12, 60);
    g.fillStyle(0xcfe3ff, 0.85);
    g.fillCircle(800, 545, 16);
    // Garden beds
    g.fillStyle(0x3e5648, 1);
    g.fillRoundedRect(480, 850, 160, 90, 8);
    g.fillRoundedRect(660, 850, 160, 90, 8);
    g.fillStyle(0xe88ca0, 1);
    for (let i = 0; i < 8; i++) {
      g.fillCircle(500 + i * 18, 880 + (i % 3) * 16, 5);
      g.fillCircle(680 + i * 18, 880 + ((i + 1) % 3) * 16, 5);
    }
    // Location labels (small, readable)
    const label = (x: number, y: number, text: string) => {
      this.add
        .text(x, y, text, {
          fontFamily: "Karla, sans-serif",
          fontSize: "13px",
          color: "#cfd3ec",
        })
        .setOrigin(0.5)
        .setAlpha(0.85);
    };
    label(800, 100, "Clock Tower");
    label(260, 790, "Tiny Library");
    label(650, 840, "Overgrown Garden");
    label(800, 720, "Fountain");
    label(1320, 1010, "Observatory");
    label(800, 420, "Village Square");
  }

  private drawFireflies() {
    if (this.reducedMotion) return;
    for (let i = 0; i < 26; i++) {
      const x = 100 + Math.random() * (WORLD.width - 200);
      const y = 100 + Math.random() * (WORLD.height - 200);
      const f = this.add.circle(x, y, 2.4, 0xf2e394, 0.9);
      this.fireflies.push(f);
      this.tweens.add({
        targets: f,
        x: x + Phaser.Math.Between(-60, 60),
        y: y + Phaser.Math.Between(-60, 60),
        alpha: 0.25,
        duration: Phaser.Math.Between(1800, 4200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private createAvatar(p: RemotePlayer) {
    const color = avatarColor(p.avatar);
    const isMe = p.id === this.meId;
    const body = this.add.circle(0, -6, 17, color, 1);
    body.setStrokeStyle(3, 0xf7ead7, 1);
    // Little hood triangle on top for storybook charm
    const hood = this.add.triangle(0, -26, 0, 0, -13, 12, 13, 12, color, 1);
    hood.setStrokeStyle(2, 0xf7ead7, 0.9);
    const face = this.add.circle(-5.5, -8, 2.2, 0x1a1b3a, 1);
    const face2 = this.add.circle(5.5, -8, 2.2, 0x1a1b3a, 1);
    const label = this.add
      .text(0, -52, p.name, {
        fontFamily: "Karla, sans-serif",
        fontSize: "13px",
        color: isMe ? "#f2c572" : "#f7ead7",
        fontStyle: isMe ? "bold" : "normal",
        backgroundColor: "rgba(26,27,58,0.72)",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5);
    // Culprit sees nothing special here — roles are never rendered.
    const container = this.add.container(p.x, p.y, [hood, body, face, face2, label]);
    container.setDepth(10);
    if (isMe) {
      const ring = this.add.circle(0, -6, 23, 0xf2c572, 0);
      ring.setStrokeStyle(2, 0xf2c572, 0.85);
      container.add(ring);
      this.cameras.main.startFollow(container, true, 0.08, 0.08);
    }
    this.avatars.set(p.id, { container, body, label, targetX: p.x, targetY: p.y });
  }

  private refreshMarkers() {
    // Clear old
    for (const [, c] of this.markers) c.destroy(true);
    this.markers.clear();
    for (const it of this.interactables) {
      if (it.taken || it.done) continue;
      const color = it.kind === "clue" ? 0xf2c572 : 0x8fd6b4;
      const ring = this.add.circle(0, 0, 14, color, 0);
      ring.setStrokeStyle(2.5, color, 0.95);
      const dot = this.add.circle(0, 0, 5, color, 1);
      const c = this.add.container(it.x, it.y - 30, [ring, dot]);
      c.setDepth(5);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: c,
          y: it.y - 38,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
      this.markers.set(it.id, c);
    }
  }

  private collides(x: number, y: number): boolean {
    const b = WORLD.bounds;
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return true;
    for (const s of SOLIDS) {
      // Player radius ~17px padding
      if (x > s.x - 16 && x < s.x + s.w + 16 && y - 6 > s.y - 16 && y - 6 < s.y + s.h + 16) {
        return true;
      }
    }
    return false;
  }

  override update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    const me = this.avatars.get(this.meId);
    if (me) {
      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown || this.wasd.A?.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd.D?.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd.W?.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd.S?.isDown) vy += 1;
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy);
        vx = (vx / len) * WORLD.playerSpeed * dt;
        vy = (vy / len) * WORLD.playerSpeed * dt;
        const nx = me.container.x + vx;
        const ny = me.container.y + vy;
        // Axis-separated slide so walls feel fair
        if (!this.collides(nx, me.container.y)) me.container.x = nx;
        if (!this.collides(me.container.x, ny)) me.container.y = ny;
        me.targetX = me.container.x;
        me.targetY = me.container.y;
        const now = performance.now();
        if (now - this.lastEmit > WORLD.moveThrottleMs) {
          this.lastEmit = now;
          this.onMove?.(Math.round(me.container.x), Math.round(me.container.y));
        }
        if (now - this.lastStepSfx > 320) {
          this.lastStepSfx = now;
          this.onStep?.();
        }
      }
    }
    // Smooth remote players (lerp toward last known target).
    for (const [id, spr] of this.avatars) {
      if (id === this.meId) continue;
      const cx = spr.container.x;
      const cy = spr.container.y;
      const dx = spr.targetX - cx;
      const dy = spr.targetY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 1.5) {
        const t = Math.min(1, (dt * 10 * Math.min(dist, 220)) / 220 + dt * 3);
        spr.container.x = cx + dx * t;
        spr.container.y = cy + dy * t;
      }
    }
  }
}
