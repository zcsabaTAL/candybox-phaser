export type LocationKey = "CandyBox" | "Village" | "Forge" | "FortressEntrance";

interface SaveDataV2 {
  saveVersion: 2; location: LocationKey; position: { x: number; y: number }; candies: number;
  candyCollected: boolean; lollipops: number; forgeLollipopCollected: boolean; woodenSwordOwned: boolean;
}

export interface RuntimeState extends Omit<SaveDataV2, "saveVersion"> { entryFrom?: "left" | "right"; }
export interface CandyBoxDebugState {
  scene: LocationKey; player: { x: number; y: number }; camera: { scrollX: number; scrollY: number };
  candy: { collected: boolean }; candies: number; lollipops: number; woodenSwordOwned: boolean; interactionAvailable: boolean;
}

declare global { interface Window { __CANDYBOX_DEBUG__?: CandyBoxDebugState; } }

const SAVE_KEY = "candyboxPhaserSave";
const resetRequested = new URLSearchParams(window.location.search).has("newGame");
const DEFAULT_STATE: RuntimeState = {
  location: "CandyBox", position: { x: 105, y: 400 }, candies: 0, candyCollected: false,
  lollipops: 0, forgeLollipopCollected: false, woodenSwordOwned: false,
};

function isLocation(value: unknown): value is LocationKey {
  return value === "CandyBox" || value === "Village" || value === "Forge" || value === "FortressEntrance";
}

function hasValidPosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const position = value as { x?: unknown; y?: unknown };
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

function loadState(): RuntimeState {
  if (resetRequested) return structuredClone(DEFAULT_STATE);
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.saveVersion === 1 && isLocation(parsed.location) && parsed.location !== "Forge"
      && hasValidPosition(parsed.position) && (parsed.candyCount === 0 || parsed.candyCount === 1)) {
      return { ...structuredClone(DEFAULT_STATE), location: parsed.location, position: parsed.position,
        candies: parsed.candyCount, candyCollected: parsed.candyCount === 1 };
    }
    if (parsed.saveVersion !== 2 || !isLocation(parsed.location) || !hasValidPosition(parsed.position)
      || !Number.isSafeInteger(parsed.candies) || (parsed.candies as number) < 0
      || typeof parsed.candyCollected !== "boolean"
      || !Number.isSafeInteger(parsed.lollipops) || (parsed.lollipops as number) < 0
      || typeof parsed.forgeLollipopCollected !== "boolean" || typeof parsed.woodenSwordOwned !== "boolean") {
      return structuredClone(DEFAULT_STATE);
    }
    return {
      location: parsed.location, position: parsed.position, candies: parsed.candies as number,
      candyCollected: parsed.candyCollected, lollipops: parsed.lollipops as number,
      forgeLollipopCollected: parsed.forgeLollipopCollected, woodenSwordOwned: parsed.woodenSwordOwned,
    };
  } catch { return structuredClone(DEFAULT_STATE); }
}

export const runtimeState: RuntimeState = loadState();
export function saveRuntimeState(): void {
  const save: SaveDataV2 = {
    saveVersion: 2, location: runtimeState.location, position: runtimeState.position,
    candies: runtimeState.candies, candyCollected: runtimeState.candyCollected,
    lollipops: runtimeState.lollipops, forgeLollipopCollected: runtimeState.forgeLollipopCollected,
    woodenSwordOwned: runtimeState.woodenSwordOwned,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}
export function publishStateChange(): void { window.dispatchEvent(new Event("candybox:state")); }

if (resetRequested) {
  saveRuntimeState();
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("newGame");
  window.history.replaceState({}, "", cleanUrl);
}
