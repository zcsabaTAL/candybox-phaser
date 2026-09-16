import Phaser from "phaser";
import { CandyBoxScene, FortressEntranceScene, VillageScene } from "./WorldScene";
import { runtimeState } from "./worldState";

class BootstrapScene extends Phaser.Scene {
  constructor() { super("Bootstrap"); }
  create(): void { this.scene.start(runtimeState.location); }
}

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 800,
  height: 480,
  backgroundColor: "#130b1d",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootstrapScene, CandyBoxScene, VillageScene, FortressEntranceScene],
};
