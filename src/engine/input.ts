export class Input {
  onActivate: (() => void) | null = null;
  onSkip: (() => void) | null = null;
  onBack: (() => void) | null = null;
  onPause: (() => void) | null = null;
  onToggleHud: (() => void) | null = null;
  onToggleMute: (() => void) | null = null;

  private pointerDownAt = 0;
  private lastTapAt = 0;
  private holdTimer: number | null = null;
  private static readonly LONG_PRESS_MS = 500;
  private static readonly DOUBLE_TAP_MS = 280;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    canvas.addEventListener("pointercancel", () => this.cancelHold());
    canvas.addEventListener("pointerleave", () => this.cancelHold());
    window.addEventListener("keydown", (e) => this.onKey(e));
  }

  private onPointerDown(_e: PointerEvent): void {
    this.onActivate?.();
    this.pointerDownAt = performance.now();
    this.cancelHold();
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = null;
      this.onPause?.();
    }, Input.LONG_PRESS_MS);
  }

  private onPointerUp(_e: PointerEvent): void {
    const now = performance.now();
    const heldMs = now - this.pointerDownAt;
    this.cancelHold();
    if (heldMs >= Input.LONG_PRESS_MS) return;
    if (now - this.lastTapAt <= Input.DOUBLE_TAP_MS) {
      this.lastTapAt = 0;
      this.onBack?.();
    } else {
      this.lastTapAt = now;
      this.onSkip?.();
    }
  }

  private cancelHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private onKey(e: KeyboardEvent): void {
    this.onActivate?.();
    switch (e.key) {
      case " ":
      case "Escape":
        this.onPause?.();
        break;
      case "ArrowRight":
      case "Enter":
        this.onSkip?.();
        break;
      case "ArrowLeft":
        this.onBack?.();
        break;
      case "h":
      case "H":
        this.onToggleHud?.();
        break;
      case "m":
      case "M":
        this.onToggleMute?.();
        break;
    }
  }
}
