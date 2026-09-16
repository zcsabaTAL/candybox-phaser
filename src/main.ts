import Phaser from "phaser";
import "./style.css";
import { MusicController } from "./audio/MusicController";
import { VoiceController, type DialogueRequest } from "./audio/VoiceController";
import { gameConfig } from "./game/config";
import { resetRuntimeState, saveRuntimeState, type LocationKey } from "./game/worldState";

document.body.dataset.buildMode = import.meta.env.MODE;

const music = new MusicController();
const voice = new VoiceController(music);
let resettingGame = false;
window.addEventListener("candybox:location", (event) => {
  voice.stop();
  music.setLocation((event as CustomEvent<LocationKey>).detail);
});
window.addEventListener("candybox:dialogue", (event) => {
  voice.play((event as CustomEvent<DialogueRequest>).detail);
});

document.querySelector<HTMLButtonElement>("#new-game")?.addEventListener("click", () => {
  if (window.confirm("Start a new game and erase the current prototype save?")) {
    resettingGame = true;
    resetRuntimeState();
    window.location.reload();
  }
});

window.addEventListener("pagehide", () => {
  if (!resettingGame) saveRuntimeState();
});

new Phaser.Game(gameConfig);
