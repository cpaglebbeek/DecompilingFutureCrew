export class Input {
  onActivate: (() => void) | null = null;
  onSkip: (() => void) | null = null;
  onPause: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const activate = () => this.onActivate?.();
    const skip = () => this.onSkip?.();
    canvas.addEventListener("pointerdown", () => { activate(); skip(); });
    window.addEventListener("keydown", (e) => {
      activate();
      if (e.key === "Escape" || e.key === " ") this.onPause?.();
      if (e.key === "ArrowRight" || e.key === "Enter") skip();
    });
  }
}
