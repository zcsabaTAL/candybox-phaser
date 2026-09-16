import Phaser from "phaser";

export interface CandyBoxDebugState {
  scene: "CandyBox";
  player: { x: number; y: number };
  candy: { collected: boolean };
  candyCount: 0 | 1;
}

declare global {
  interface Window {
    __CANDYBOX_DEBUG__?: CandyBoxDebugState;
  }
}

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 480;
const ARENA = new Phaser.Geom.Rectangle(40, 92, 720, 344);
const PLAYER_SPEED = 210;

export class CandyBoxScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private candy!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private candyCount: 0 | 1 = 0;

  constructor() {
    super("CandyBox");
  }

  create(): void {
    this.drawWorld();
    this.createTextures();

    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

    this.player = this.physics.add.sprite(172, 268, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(3);

    this.candy = this.physics.add.sprite(610, 268, "candy");
    this.candy.setImmovable(true);
    this.candy.setDepth(2);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is required for this prototype.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;

    this.physics.add.overlap(this.player, this.candy, this.collectCandy, undefined, this);
    this.publishDebugState();
  }

  update(): void {
    const horizontal = Number(this.cursors.right.isDown || this.wasd.D.isDown)
      - Number(this.cursors.left.isDown || this.wasd.A.isDown);
    const vertical = Number(this.cursors.down.isDown || this.wasd.S.isDown)
      - Number(this.cursors.up.isDown || this.wasd.W.isDown);

    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(PLAYER_SPEED);
    }

    this.player.setVelocity(velocity.x, velocity.y);
    this.publishDebugState();
  }

  private drawWorld(): void {
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(0x1a1026, 0x1a1026, 0x0e1720, 0x0e1720, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    graphics.fillStyle(0x21142f, 1);
    graphics.fillRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 18);
    graphics.lineStyle(4, 0x77518f, 0.9);
    graphics.strokeRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 18);

    graphics.lineStyle(1, 0x8b6a9c, 0.1);
    for (let x = ARENA.x + 30; x < ARENA.right; x += 48) {
      graphics.lineBetween(x, ARENA.y + 4, x, ARENA.bottom - 4);
    }
    for (let y = ARENA.y + 30; y < ARENA.bottom; y += 48) {
      graphics.lineBetween(ARENA.x + 4, y, ARENA.right - 4, y);
    }

    this.add.text(WORLD_WIDTH / 2, 45, "A single candy hums in the dark.", {
      color: "#cdb8d8",
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      fontStyle: "italic",
    }).setOrigin(0.5);

    this.add.text(172, 306, "YOU", {
      color: "#d6b7e6",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  private createTextures(): void {
    const playerGraphics = this.make.graphics({ x: 0, y: 0 }, false);
    playerGraphics.fillStyle(0xead8f4, 1);
    playerGraphics.fillCircle(16, 16, 14);
    playerGraphics.fillStyle(0x513363, 1);
    playerGraphics.fillCircle(11, 13, 2);
    playerGraphics.fillCircle(21, 13, 2);
    playerGraphics.lineStyle(2, 0x513363, 1);
    playerGraphics.beginPath();
    playerGraphics.arc(16, 17, 6, 0.2, Math.PI - 0.2);
    playerGraphics.strokePath();
    playerGraphics.generateTexture("player", 32, 32);
    playerGraphics.destroy();

    const candyGraphics = this.make.graphics({ x: 0, y: 0 }, false);
    candyGraphics.fillStyle(0xffd45f, 0.2);
    candyGraphics.fillCircle(22, 18, 18);
    candyGraphics.fillStyle(0xffea98, 1);
    candyGraphics.fillTriangle(0, 18, 10, 10, 10, 26);
    candyGraphics.fillTriangle(44, 18, 34, 10, 34, 26);
    candyGraphics.fillStyle(0xf5a623, 1);
    candyGraphics.fillRoundedRect(9, 8, 26, 20, 9);
    candyGraphics.lineStyle(2, 0xffefb0, 1);
    candyGraphics.strokeRoundedRect(9, 8, 26, 20, 9);
    candyGraphics.generateTexture("candy", 44, 36);
    candyGraphics.destroy();
  }

  private collectCandy(): void {
    if (this.candyCount === 1) {
      return;
    }

    this.candyCount = 1;
    this.candy.disableBody(true, true);

    const counter = document.querySelector<HTMLParagraphElement>("#candy-counter");
    const status = document.querySelector<HTMLParagraphElement>("#game-status");
    if (counter) {
      counter.textContent = "Candies: 1/1";
    }
    if (status) {
      status.textContent = "The first candy is yours.";
    }

    this.cameras.main.flash(180, 255, 221, 117, false);
    this.publishDebugState();
  }

  private publishDebugState(): void {
    if (import.meta.env.MODE !== "development") {
      return;
    }

    window.__CANDYBOX_DEBUG__ = {
      scene: "CandyBox",
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
      },
      candy: { collected: this.candyCount === 1 },
      candyCount: this.candyCount,
    };
  }
}
