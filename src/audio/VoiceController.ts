import type { MusicController } from "./MusicController";

export interface DialogueRequest { src: string; caption: string; }

export class VoiceController {
  private readonly audio: HTMLAudioElement;
  private readonly caption: HTMLElement;

  constructor(private readonly music: MusicController) {
    this.audio = document.createElement("audio");
    this.audio.id = "dialogue-voice";
    this.audio.preload = "auto";
    this.audio.setAttribute("aria-hidden", "true");
    document.body.append(this.audio);
    const caption = document.querySelector<HTMLElement>("#dialogue-caption");
    if (!caption) throw new Error("Dialogue caption element is missing.");
    this.caption = caption;
    this.audio.addEventListener("ended", () => this.finish());
  }

  play(request: DialogueRequest): void {
    this.stop();
    this.audio.src = new URL(request.src, document.baseURI).href;
    this.audio.dataset.dialogue = request.src;
    this.caption.textContent = request.caption;
    this.caption.hidden = false;
    this.music.setDucked(true);
    void this.audio.play().catch(() => this.finish());
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.finish();
  }

  private finish(): void {
    this.caption.hidden = true;
    this.music.setDucked(false);
  }
}
