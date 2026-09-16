export type LocationKey = "CandyBox" | "Village" | "FortressEntrance";

interface SaveData {
  saveVersion: 1;
  location: LocationKey;
  position: { x: number; y: number };
  candyCount: 0 | 1;
}

export interface RuntimeState {
  location: LocationKey;
  position: { x: number; y: number };
  candyCount: 0 | 1;
  entryFrom?: "left" | "right";
}

export interface CandyBoxDebugState {
  scene: LocationKey;
  player: { x: number; y: number };
  camera: { scrollX: number; scrollY: number };
  candy: { collected: boolean };
  candyCount: 0 | 1;
  interactionAvailable: boolean;
}

declare global {
  interface Window { __CANDYBOX_DEBUG__?: CandyBoxDebugState; }
}

const SAVE_KEY = "candyboxPhaserSave";
const DEFAULT_STATE: RuntimeState = {
  location: "CandyBox",
  position: { x: 105, y: 400 },
  candyCount: 0,
};

function isLocation(value: unknown): value is LocationKey {
  return value === "CandyBox" || value === "Village" || value === "FortressEntrance";
}

function loadState(): RuntimeState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (
      parsed.saveVersion !== 1 || !isLocation(parsed.location) || !parsed.position
      || !Number.isFinite(parsed.position.x) || !Number.isFinite(parsed.position.y)
      || (parsed.candyCount !== 0 && parsed.candyCount !== 1)
    ) return structuredClone(DEFAULT_STATE);
    return {
      location: parsed.location,
      position: { x: parsed.position.x, y: parsed.position.y },
      candyCount: parsed.candyCount,
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export const runtimeState: RuntimeState = loadState();

export function saveRuntimeState(): void {
  const save: SaveData = {
    saveVersion: 1,
    location: runtimeState.location,
    position: runtimeState.position,
    candyCount: runtimeState.candyCount,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetRuntimeState(): void {
  runtimeState.location = DEFAULT_STATE.location;
  runtimeState.position = { ...DEFAULT_STATE.position };
  runtimeState.candyCount = DEFAULT_STATE.candyCount;
  runtimeState.entryFrom = undefined;
  saveRuntimeState();
}
