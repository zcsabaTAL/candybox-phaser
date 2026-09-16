export type LocationKey = "CandyBox" | "Village" | "FortressEntrance";

export interface RuntimeState {
  candyCount: 0 | 1;
  entryFrom?: "left" | "right";
}

export interface CandyBoxDebugState {
  scene: LocationKey;
  player: { x: number; y: number };
  camera: { scrollX: number; scrollY: number };
  candy: { collected: boolean };
  candyCount: 0 | 1;
}

declare global {
  interface Window {
    __CANDYBOX_DEBUG__?: CandyBoxDebugState;
  }
}

export const runtimeState: RuntimeState = {
  candyCount: 0,
};
