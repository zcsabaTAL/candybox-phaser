import Phaser from "phaser";
import "./style.css";
import { MusicController } from "./audio/MusicController";
import { gameConfig } from "./game/config";
import type { LocationKey } from "./game/worldState";

document.body.dataset.buildMode = import.meta.env.MODE;

const music = new MusicController();
window.addEventListener("candybox:location", (event) => {
  music.setLocation((event as CustomEvent<LocationKey>).detail);
});

new Phaser.Game(gameConfig);
