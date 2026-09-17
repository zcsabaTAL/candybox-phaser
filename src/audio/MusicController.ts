import type { LocationKey } from "../game/worldState";

const TRACKS: Record<LocationKey, string> = {
  CandyBox: "music/main-theme.mp3",
  Village: "music/main-theme.mp3",
  Forge: "music/main-theme.mp3",
  FortressEntrance: "music/fortress-entrance.mp3",
};

export class MusicController {
  private readonly audio: HTMLAudioElement;
  private unlocked = false;
  private activeTrack = "";
  private ducked = false;

  constructor() {
    this.audio = document.createElement("audio");
    this.audio.id = "location-music";
    this.audio.loop = true;
    this.audio.preload = "auto";
    this.audio.volume = 0.35;
    this.audio.setAttribute("aria-hidden", "true");
    document.body.append(this.audio);

    const unlock = (): void => {
      this.unlocked = true;
      void this.play();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.audio.volume = ducked ? 0.1225 : 0.35;
  }

  setLocation(location: LocationKey): void {
    const track = TRACKS[location];
    if (track === this.activeTrack) {
      return;
    }

    this.activeTrack = track;
    this.audio.src = new URL(track, document.baseURI).href;
    this.audio.dataset.track = track;
    this.audio.load();

    if (this.unlocked) {
      void this.play();
    }
  }

  private async play(): Promise<void> {
    if (!this.activeTrack) {
      return;
    }

    try {
      this.audio.volume = this.ducked ? 0.1225 : 0.35;
      await this.audio.play();
    } catch (error) {
      console.warn("Music playback is waiting for a browser gesture.", error);
    }
  }
}
