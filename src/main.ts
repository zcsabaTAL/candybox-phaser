import Phaser from "phaser";
import "./style.css";
import { MusicController } from "./audio/MusicController";
import { VoiceController, type DialogueRequest } from "./audio/VoiceController";
import { gameConfig } from "./game/config";
import { publishStateChange, runtimeState, saveRuntimeState, type LocationKey } from "./game/worldState";

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

const inventoryPanel = document.querySelector<HTMLElement>("#inventory-panel");
const inventoryItems = document.querySelector<HTMLUListElement>("#inventory-items");
const shopPanel = document.querySelector<HTMLElement>("#shop-panel");
const shopMessage = document.querySelector<HTMLParagraphElement>("#shop-message");
const buySword = document.querySelector<HTMLButtonElement>("#buy-wooden-sword");

function renderState(): void {
  const counter = document.querySelector<HTMLElement>("#candy-counter");
  if (counter) counter.textContent = `Candies: ${runtimeState.candies}${runtimeState.candyCollected ? " (+1/sec)" : ""}`;
  if (inventoryItems) {
    const items: string[] = [];
    if (runtimeState.woodenSwordOwned) items.push("<li><strong>Wooden Sword</strong><span>Weapon</span></li>");
    if (runtimeState.lollipops > 0) items.push(`<li><strong>Lollipop × ${runtimeState.lollipops}</strong><span>Sweet resource</span></li>`);
    inventoryItems.innerHTML = items.length > 0 ? items.join("") : '<li class="empty-inventory">Nothing yet.</li>';
  }
  if (buySword) {
    buySword.disabled = runtimeState.woodenSwordOwned || runtimeState.candies < 150;
    buySword.textContent = runtimeState.woodenSwordOwned
      ? "Wooden Sword owned"
      : runtimeState.candies < 150 ? `Need ${150 - runtimeState.candies} more candies` : "Buy for 150 candies";
  }
}

window.addEventListener("candybox:state", renderState);
window.addEventListener("candybox:shop", () => {
  if (shopPanel) shopPanel.hidden = false;
  if (shopMessage) shopMessage.textContent = "";
  renderState();
});
window.addEventListener("candybox:location", (event) => {
  if ((event as CustomEvent<LocationKey>).detail !== "Forge" && shopPanel) shopPanel.hidden = true;
});
document.querySelector<HTMLButtonElement>("#inventory-toggle")?.addEventListener("click", () => {
  if (inventoryPanel) inventoryPanel.hidden = !inventoryPanel.hidden;
  renderState();
});
document.querySelector<HTMLButtonElement>("#inventory-close")?.addEventListener("click", () => {
  if (inventoryPanel) inventoryPanel.hidden = true;
});
buySword?.addEventListener("click", () => {
  if (runtimeState.woodenSwordOwned || runtimeState.candies < 150) return;
  runtimeState.candies -= 150;
  runtimeState.woodenSwordOwned = true;
  saveRuntimeState();
  publishStateChange();
  if (shopMessage) shopMessage.textContent = "The Wooden Sword was added to your inventory.";
  window.dispatchEvent(new CustomEvent<DialogueRequest>("candybox:dialogue", { detail: {
    src: "audio/blacksmith-purchase.wav",
    caption: "Thanks for buying! This wooden sword is quite weak, but it's a start.",
  } }));
});

window.setInterval(() => {
  if (!runtimeState.candyCollected) return;
  runtimeState.candies += import.meta.env.MODE === "development" ? 100 : 1;
  saveRuntimeState();
  publishStateChange();
}, 1_000);
renderState();

document.querySelector<HTMLButtonElement>("#new-game")?.addEventListener("click", () => {
  if (window.confirm("Start a new game and erase the current prototype save?")) {
    resettingGame = true;
    const restartUrl = new URL(window.location.href);
    restartUrl.searchParams.set("newGame", Date.now().toString());
    window.location.replace(restartUrl);
  }
});

window.addEventListener("pagehide", () => {
  if (!resettingGame) saveRuntimeState();
});

new Phaser.Game(gameConfig);
