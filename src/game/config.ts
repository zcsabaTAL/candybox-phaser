import Phaser from "phaser";
import { CandyBoxScene, FortressEntranceScene, VillageScene } from "./WorldScene";

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
  scene: [CandyBoxScene, VillageScene, FortressEntranceScene],
};
