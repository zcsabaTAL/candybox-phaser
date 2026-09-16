import Phaser from "phaser";
import { runtimeState, saveRuntimeState, type LocationKey } from "./worldState";

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 760;
const ARENA = new Phaser.Geom.Rectangle(40, 84, 1320, 636);
const PLAYER_SPEED = 260;
const BLACKSMITH = new Phaser.Math.Vector2(700, 400);
const BLACKSMITH_CAPTION = "Howdy! Ah'm a blacksmith. Ah kin sell ye various weapons an' pieces o' equipment.";
const DOOR_TOP = 310;
const DOOR_BOTTOM = 490;

interface LocationDefinition {
  key: LocationKey;
  title: string;
  mood: string;
  sky: number;
  ground: number;
  accent: number;
  left?: LocationKey;
  right?: LocationKey;
}

const LOCATIONS: Record<LocationKey, LocationDefinition> = {
  CandyBox: {
    key: "CandyBox",
    title: "CANDY BOX",
    mood: "A single candy hums in the dark.",
    sky: 0x1a1026,
    ground: 0x21142f,
    accent: 0x9a6fb0,
    right: "Village",
  },
  Village: {
    key: "Village",
    title: "THE VILLAGE",
    mood: "Warm windows watch the winding road.",
    sky: 0x17263a,
    ground: 0x28382f,
    accent: 0xd5a85d,
    left: "CandyBox",
    right: "FortressEntrance",
  },
  FortressEntrance: {
    key: "FortressEntrance",
    title: "FORTRESS ENTRANCE",
    mood: "The stone gate counts every footstep.",
    sky: 0x24191c,
    ground: 0x343033,
    accent: 0xb34b42,
    left: "Village",
  },
};

abstract class WorldScene extends Phaser.Scene {
  private readonly definition: LocationDefinition;
  private player!: Phaser.Physics.Arcade.Sprite;
  private candy?: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private transitioning = false;
  private boundaryMessageShown = false;
  private interactionAvailable = false;
  private lastSavedAt = 0;

  protected constructor(key: LocationKey) {
    super(key);
    this.definition = LOCATIONS[key];
  }

  create(): void {
    this.transitioning = false;
    this.boundaryMessageShown = false;
    this.interactionAvailable = false;
    this.lastSavedAt = 0;
    this.drawWorld();
    this.createTextures();
    this.updatePageChrome();

    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.player = this.physics.add.sprite(runtimeState.position.x, runtimeState.position.y, "player");
    this.player.setCollideWorldBounds(true).setDepth(3);

    if (this.definition.key === "CandyBox" && runtimeState.candyCount === 0) {
      this.candy = this.physics.add.sprite(370, 400, "candy");
      this.candy.setImmovable(true).setDepth(2);
      this.physics.add.overlap(this.player, this.candy, this.collectCandy, undefined, this);
    }

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is required for this prototype.");
    }
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    camera.startFollow(this.player, true, 0.12, 0.12);
    camera.setDeadzone(170, 110);
    camera.fadeIn(180, 8, 5, 12);

    this.publishDebugState();
  }

  update(): void {
    if (this.transitioning) {
      return;
    }

    const horizontal = Number(this.cursors.right.isDown || this.wasd.D.isDown)
      - Number(this.cursors.left.isDown || this.wasd.A.isDown);
    const vertical = Number(this.cursors.down.isDown || this.wasd.S.isDown)
      - Number(this.cursors.up.isDown || this.wasd.W.isDown);
    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(PLAYER_SPEED);
    }

    this.player.setVelocity(velocity.x, velocity.y);
    this.updateInteraction();
    if (this.interactionAvailable && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      window.dispatchEvent(new CustomEvent("candybox:dialogue", {
        detail: {
          src: "audio/blacksmith-introduction.wav",
          caption: BLACKSMITH_CAPTION,
        },
      }));
    }
    this.persistPosition();
    this.checkExit();
    this.updateBoundaryMessage(velocity);
    this.publishDebugState();
  }

  private checkExit(): void {
    if (!this.isAtDoor()) return;
    if (this.player.x >= 1338 && this.definition.right) {
      this.transitionTo(this.definition.right, "left");
    } else if (this.player.x <= 62 && this.definition.left) {
      this.transitionTo(this.definition.left, "right");
    }
  }

  private isAtDoor(): boolean {
    return this.player.y >= DOOR_TOP && this.player.y <= DOOR_BOTTOM;
  }

  private transitionTo(next: LocationKey, entryFrom: "left" | "right"): void {
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    runtimeState.entryFrom = entryFrom;
    runtimeState.location = next;
    runtimeState.position = {
      x: entryFrom === "right" ? 1295 : 105,
      y: Phaser.Math.Clamp(this.player.y, 100, 704),
    };
    saveRuntimeState();
    this.cameras.main.fadeOut(160, 8, 5, 12);
    this.time.delayedCall(170, () => this.scene.start(next));
  }

  private updatePageChrome(): void {
    const heading = document.querySelector<HTMLHeadingElement>("#location-title");
    const mood = document.querySelector<HTMLParagraphElement>("#location-mood");
    const counter = document.querySelector<HTMLParagraphElement>("#candy-counter");
    const status = document.querySelector<HTMLParagraphElement>("#game-status");
    const prompt = document.querySelector<HTMLParagraphElement>("#interaction-prompt");

    if (heading) heading.textContent = this.definition.title;
    if (mood) mood.textContent = this.definition.mood;
    if (counter) counter.textContent = `Candies: ${runtimeState.candyCount}/1`;
    if (status) {
      status.textContent = this.definition.key === "CandyBox" && runtimeState.candyCount === 0
        ? "The candy is waiting."
        : "The road is open.";
    }
    if (prompt) prompt.hidden = true;

    window.dispatchEvent(new CustomEvent<LocationKey>("candybox:location", {
      detail: this.definition.key,
    }));
  }

  private drawWorld(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(
      this.definition.sky,
      this.definition.sky,
      this.definition.ground,
      this.definition.ground,
      1,
    );
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    graphics.fillStyle(this.definition.ground, 1);
    graphics.fillRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 18);
    graphics.lineStyle(4, this.definition.accent, 0.9);
    graphics.strokeRoundedRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height, 18);

    this.drawLandmarks(graphics);
    this.add.text(WORLD_WIDTH / 2, 38, this.definition.mood, {
      color: "#f2dfc7",
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      fontStyle: "italic",
    }).setOrigin(0.5);

    if (this.definition.left) this.drawGate(70, "←");
    if (this.definition.right) this.drawGate(1330, "→");
  }

  private drawLandmarks(graphics: Phaser.GameObjects.Graphics): void {
    if (this.definition.key === "CandyBox") {
      graphics.lineStyle(1, this.definition.accent, 0.16);
      for (let x = 120; x < 1280; x += 70) graphics.lineBetween(x, 120, x, 680);
      for (let y = 150; y < 680; y += 70) graphics.lineBetween(80, y, 1320, y);
      return;
    }

    if (this.definition.key === "Village") {
      for (let x = 250; x <= 1100; x += 280) {
        graphics.fillStyle(0x6e4938, 1).fillRect(x, 330, 150, 150);
        graphics.fillStyle(0xd5a85d, 0.85).fillTriangle(x - 20, 330, x + 75, 245, x + 170, 330);
        graphics.fillStyle(0xffd978, 0.75).fillRect(x + 55, 380, 38, 42);
      }
      graphics.fillStyle(0x907052, 1).fillRect(70, 520, 1260, 74);
      graphics.fillStyle(0x33251e, 1).fillCircle(BLACKSMITH.x, BLACKSMITH.y, 28);
      graphics.fillStyle(0xd7a25b, 1).fillRect(BLACKSMITH.x - 20, BLACKSMITH.y - 13, 40, 30);
      this.add.text(BLACKSMITH.x, BLACKSMITH.y + 48, "BLACKSMITH", {
        color: "#fff1bc",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
      }).setOrigin(0.5);
      return;
    }

    graphics.fillStyle(0x242326, 1).fillRect(455, 200, 490, 420);
    graphics.fillStyle(0x171619, 1).fillRect(620, 335, 160, 285);
    graphics.fillStyle(this.definition.accent, 0.65);
    graphics.fillCircle(700, 325, 13);
    for (let x = 470; x < 930; x += 58) graphics.fillRect(x, 170, 34, 52);
  }

  private drawGate(x: number, label: string): void {
    this.add.rectangle(x, 400, 44, 180, this.definition.accent, 0.22)
      .setStrokeStyle(2, this.definition.accent, 0.8);
    this.add.text(x, 400, label, {
      color: "#fff1bc",
      fontFamily: "Arial, sans-serif",
      fontSize: "30px",
      fontStyle: "bold",
    }).setOrigin(0.5);
  }

  private createTextures(): void {
    if (!this.textures.exists("player")) {
      const playerGraphics = this.make.graphics({ x: 0, y: 0 }, false);
      playerGraphics.fillStyle(0xead8f4, 1).fillCircle(16, 16, 14);
      playerGraphics.fillStyle(0x513363, 1).fillCircle(11, 13, 2).fillCircle(21, 13, 2);
      playerGraphics.lineStyle(2, 0x513363, 1).beginPath().arc(16, 17, 6, 0.2, Math.PI - 0.2).strokePath();
      playerGraphics.generateTexture("player", 32, 32);
      playerGraphics.destroy();
    }

    if (!this.textures.exists("candy")) {
      const candyGraphics = this.make.graphics({ x: 0, y: 0 }, false);
      candyGraphics.fillStyle(0xffd45f, 0.2).fillCircle(22, 18, 18);
      candyGraphics.fillStyle(0xffea98, 1).fillTriangle(0, 18, 10, 10, 10, 26).fillTriangle(44, 18, 34, 10, 34, 26);
      candyGraphics.fillStyle(0xf5a623, 1).fillRoundedRect(9, 8, 26, 20, 9);
      candyGraphics.lineStyle(2, 0xffefb0, 1).strokeRoundedRect(9, 8, 26, 20, 9);
      candyGraphics.generateTexture("candy", 44, 36);
      candyGraphics.destroy();
    }
  }

  private collectCandy(): void {
    if (runtimeState.candyCount === 1 || !this.candy) return;
    runtimeState.candyCount = 1;
    saveRuntimeState();
    this.candy.disableBody(true, true);
    const counter = document.querySelector<HTMLParagraphElement>("#candy-counter");
    const status = document.querySelector<HTMLParagraphElement>("#game-status");
    if (counter) counter.textContent = "Candies: 1/1";
    if (status) status.textContent = "The first candy is yours.";
    this.cameras.main.flash(180, 255, 221, 117, false);
    this.publishDebugState();
  }

  private updateInteraction(): void {
    const available = this.definition.key === "Village"
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, BLACKSMITH.x, BLACKSMITH.y) <= 95;
    if (available === this.interactionAvailable) return;
    this.interactionAvailable = available;
    const prompt = document.querySelector<HTMLParagraphElement>("#interaction-prompt");
    if (prompt) prompt.hidden = !available;
  }

  private persistPosition(): void {
    runtimeState.location = this.definition.key;
    runtimeState.position = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    if (this.time.now - this.lastSavedAt < 500) return;
    saveRuntimeState();
    this.lastSavedAt = this.time.now;
  }

  private updateBoundaryMessage(velocity: Phaser.Math.Vector2): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const blockedAtClosedEdge = (body.blocked.left && (!this.definition.left || !this.isAtDoor()))
      || (body.blocked.right && (!this.definition.right || !this.isAtDoor()))
      || body.blocked.up
      || body.blocked.down;
    const pushing = velocity.lengthSq() > 0 && blockedAtClosedEdge;
    if (pushing && !this.boundaryMessageShown) {
      const status = document.querySelector<HTMLParagraphElement>("#game-status");
      if (status) {
        status.textContent = (body.blocked.left || body.blocked.right)
          ? "The wall is solid. Find the doorway."
          : "The edge of this place holds firm.";
      }
      this.boundaryMessageShown = true;
    } else if (!pushing) {
      this.boundaryMessageShown = false;
    }
  }

  private publishDebugState(): void {
    if (import.meta.env.MODE !== "development") return;
    window.__CANDYBOX_DEBUG__ = {
      scene: this.definition.key,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      camera: {
        scrollX: Math.round(this.cameras.main.scrollX),
        scrollY: Math.round(this.cameras.main.scrollY),
      },
      candy: { collected: runtimeState.candyCount === 1 },
      candyCount: runtimeState.candyCount,
      interactionAvailable: this.interactionAvailable,
    };
  }
}

export class CandyBoxScene extends WorldScene {
  constructor() { super("CandyBox"); }
}

export class VillageScene extends WorldScene {
  constructor() { super("Village"); }
}

export class FortressEntranceScene extends WorldScene {
  constructor() { super("FortressEntrance"); }
}
