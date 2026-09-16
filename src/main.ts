import Phaser from "phaser";
import "./style.css";
import { gameConfig } from "./game/config";

document.body.dataset.buildMode = import.meta.env.MODE;

new Phaser.Game(gameConfig);
