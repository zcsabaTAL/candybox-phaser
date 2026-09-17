import Phaser from "phaser";
import { publishStateChange, runtimeState, saveRuntimeState, type LocationKey } from "./worldState";

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 760;
const ARENA = new Phaser.Geom.Rectangle(40, 84, 1320, 636);
const PLAYER_SPEED = 260;
const BLACKSMITH = new Phaser.Math.Vector2(760, 370);
const VILLAGE_FORGE_DOOR = new Phaser.Math.Vector2(325, 450);
const FORGE_EXIT = new Phaser.Math.Vector2(700, 675);
const BLACKSMITH_CAPTION = "Hi! I'm a blacksmith. I can sell you various weapons and pieces of equipment.";
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
  Forge: {
    key: "Forge",
    title: "THE FORGE",
    mood: "The rhythmic ring of an anvil fills the workshop.",
    sky: 0x2b1b18,
    ground: 0x463026,
    accent: 0xe08a3e,
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
  private lollipop?: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private transitioning = false;
  private boundaryMessageShown = false;
  private interactionAvailable = false;
  private interactionKind: "blacksmith" | "forgeDoor" | "forgeExit" | null = null;
  private lastSavedAt = 0;

  protected constructor(key: LocationKey) {
    super(key);
    this.definition = LOCATIONS[key];
  }

  create(): void {
    this.transitioning = false;
    this.boundaryMessageShown = false;
    this.interactionAvailable = false;
    this.interactionKind = null;
    this.lastSavedAt = 0;
    this.drawWorld();
    this.createTextures();
    this.updatePageChrome();

    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.width, ARENA.height);
    this.player = this.physics.add.sprite(runtimeState.position.x, runtimeState.position.y, "player");
    this.player.setCollideWorldBounds(true).setDepth(3);

    if (this.definition.key === "CandyBox" && !runtimeState.candyCollected) {
      this.candy = this.physics.add.sprite(370, 400, "candy");
      this.candy.setImmovable(true).setDepth(2);
      this.physics.add.overlap(this.player, this.candy, this.collectCandy, undefined, this);
    }
    if (this.definition.key === "Forge" && !runtimeState.forgeLollipopCollected) {
      this.lollipop = this.physics.add.sprite(425, 300, "lollipop");
      this.lollipop.setImmovable(true).setDepth(2);
      this.physics.add.overlap(this.player, this.lollipop, this.collectLollipop, undefined, this);
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
      this.activateInteraction();
    }
    if (this.transitioning) return;
    this.persistPosition();
    this.checkExit();
    this.updateBoundaryMessage(velocity);
    this.publishDebugState();
  }

  private activateInteraction(): void {
    if (this.interactionKind === "forgeDoor") {
      this.transitionToPoint("Forge", 700, 540);
    } else if (this.interactionKind === "forgeExit") {
      this.transitionToPoint("Village", 325, 510);
    } else if (this.interactionKind === "blacksmith") {
      window.dispatchEvent(new CustomEvent("candybox:dialogue", { detail: {
        src: "audio/blacksmith-introduction.wav", caption: BLACKSMITH_CAPTION,
      } }));
      window.dispatchEvent(new Event("candybox:shop"));
    }
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

  private transitionToPoint(next: LocationKey, x: number, y: number): void {
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    runtimeState.location = next;
    runtimeState.position = { x, y };
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
    if (counter) counter.textContent = `Candies: ${runtimeState.candies}${runtimeState.candyCollected ? " (+1/sec)" : ""}`;
    if (status) {
      status.textContent = this.definition.key === "CandyBox" && !runtimeState.candyCollected
        ? "The candy is waiting."
        : "The road is open.";
    }
    if (prompt) prompt.hidden = true;
    this.updateObjectiveUI();

    window.dispatchEvent(new CustomEvent<LocationKey>("candybox:location", {
      detail: this.definition.key,
    }));
  }

  private updateObjectiveUI(): void {
    const candyGoal = document.querySelector<HTMLLIElement>("#goal-candy");
    const fortressGoal = document.querySelector<HTMLLIElement>("#goal-fortress");
    const objective = document.querySelector<HTMLParagraphElement>("#objective-text");
    const completion = document.querySelector<HTMLElement>("#completion-card");
    const candyComplete = runtimeState.candyCollected;
    const fortressComplete = candyComplete && this.definition.key === "FortressEntrance";

    candyGoal?.classList.toggle("complete", candyComplete);
    fortressGoal?.classList.toggle("complete", fortressComplete);
    if (candyGoal) candyGoal.setAttribute("aria-current", candyComplete ? "false" : "step");
    if (fortressGoal) fortressGoal.setAttribute("aria-current", candyComplete && !fortressComplete ? "step" : "false");
    if (objective) {
      objective.textContent = fortressComplete
        ? "Prototype goal complete."
        : candyComplete
          ? "Follow the marked doorways to the Fortress Entrance."
          : "Find the glowing candy in the Candy Box.";
    }
    if (completion) completion.hidden = !fortressComplete;
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
      graphics.fillStyle(0x261a16, 1).fillRect(300, 408, 50, 72);
      this.add.text(325, 500, "FORGE", {
        color: "#fff1bc",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
      }).setOrigin(0.5);
      return;
    }

    if (this.definition.key === "Forge") {
      graphics.fillStyle(0x6e4938, 1).fillRect(150, 150, 1100, 500);
      graphics.fillStyle(0x241713, 1).fillRect(650, 610, 100, 40);
      graphics.fillStyle(0x17100e, 1).fillRect(980, 220, 170, 210);
      graphics.fillStyle(0xf07b32, 0.9).fillCircle(1065, 340, 52);
      graphics.fillStyle(0x33251e, 1).fillCircle(BLACKSMITH.x, BLACKSMITH.y, 28);
      graphics.fillStyle(0xd7a25b, 1).fillRect(BLACKSMITH.x - 20, BLACKSMITH.y - 13, 40, 30);
      this.add.text(BLACKSMITH.x, BLACKSMITH.y + 48, "BLACKSMITH", {
        color: "#fff1bc", fontFamily: "Arial, sans-serif", fontSize: "12px", fontStyle: "bold",
      }).setOrigin(0.5);
      this.add.text(FORGE_EXIT.x, FORGE_EXIT.y, "↓ VILLAGE", {
        color: "#fff1bc", fontFamily: "Arial, sans-serif", fontSize: "18px", fontStyle: "bold",
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
    if (!this.textures.exists("lollipop")) {
      const lollipopGraphics = this.make.graphics({ x: 0, y: 0 }, false);
      lollipopGraphics.fillStyle(0xffeff7, 1).fillCircle(14, 14, 11);
      lollipopGraphics.lineStyle(3, 0xf15f9a, 1).strokeCircle(14, 14, 8);
      lollipopGraphics.lineStyle(4, 0xf3dfb4, 1).lineBetween(14, 25, 14, 46);
      lollipopGraphics.generateTexture("lollipop", 28, 48);
      lollipopGraphics.destroy();
    }
  }

  private collectCandy(): void {
    if (runtimeState.candyCollected || !this.candy) return;
    runtimeState.candyCollected = true;
    runtimeState.candies += 1;
    saveRuntimeState();
    this.candy.disableBody(true, true);
    const counter = document.querySelector<HTMLParagraphElement>("#candy-counter");
    const status = document.querySelector<HTMLParagraphElement>("#game-status");
    if (counter) counter.textContent = `Candies: ${runtimeState.candies} (+1/sec)`;
    if (status) status.textContent = "The first candy is yours.";
    this.updateObjectiveUI();
    publishStateChange();
    this.cameras.main.flash(180, 255, 221, 117, false);
    this.publishDebugState();
  }

  private collectLollipop(): void {
    if (runtimeState.forgeLollipopCollected || !this.lollipop) return;
    runtimeState.forgeLollipopCollected = true;
    runtimeState.lollipops += 1;
    this.lollipop.disableBody(true, true);
    saveRuntimeState();
    publishStateChange();
    const status = document.querySelector<HTMLParagraphElement>("#game-status");
    if (status) status.textContent = "A lollipop was added to your inventory.";
    this.cameras.main.flash(180, 255, 170, 210, false);
  }

  private updateInteraction(): void {
    let kind: typeof this.interactionKind = null;
    if (this.definition.key === "Village"
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, VILLAGE_FORGE_DOOR.x, VILLAGE_FORGE_DOOR.y) <= 85) kind = "forgeDoor";
    if (this.definition.key === "Forge"
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, FORGE_EXIT.x, FORGE_EXIT.y) <= 80) kind = "forgeExit";
    else if (this.definition.key === "Forge"
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, BLACKSMITH.x, BLACKSMITH.y) <= 95) kind = "blacksmith";
    const available = kind !== null;
    if (available === this.interactionAvailable && kind === this.interactionKind) return;
    this.interactionAvailable = available;
    this.interactionKind = kind;
    const prompt = document.querySelector<HTMLParagraphElement>("#interaction-prompt");
    if (prompt) {
      prompt.hidden = !available;
      prompt.textContent = kind === "forgeDoor" ? "Press E to enter the forge"
        : kind === "forgeExit" ? "Press E to return to the village"
          : "Press E to talk to the blacksmith";
    }
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
      candy: { collected: runtimeState.candyCollected },
      candies: runtimeState.candies,
      lollipops: runtimeState.lollipops,
      woodenSwordOwned: runtimeState.woodenSwordOwned,
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

export class ForgeScene extends WorldScene {
  constructor() { super("Forge"); }
}

export class FortressEntranceScene extends WorldScene {
  constructor() { super("FortressEntrance"); }
}
