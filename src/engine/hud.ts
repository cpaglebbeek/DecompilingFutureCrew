export class Hud {
  private el: HTMLDivElement;
  private fpsEl: HTMLSpanElement;
  private sceneEl: HTMLSpanElement;
  private statusEl: HTMLSpanElement;
  private frames = 0;
  private fpsTimer = 0;
  private visible = true;

  constructor() {
    const el = document.createElement("div");
    el.id = "hud-top";
    el.style.cssText = [
      "position:fixed",
      "top:12px",
      "left:12px",
      "font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace",
      "color:#ddd",
      "opacity:0.7",
      "pointer-events:none",
      "user-select:none",
      "text-shadow:0 1px 2px #000",
      "letter-spacing:0.05em",
    ].join(";");
    const fps = document.createElement("span");
    const scene = document.createElement("span");
    const status = document.createElement("span");
    fps.textContent = "·· fps";
    scene.textContent = "—";
    status.textContent = "";
    scene.style.marginLeft = "10px";
    status.style.marginLeft = "10px";
    status.style.color = "#ffa";
    el.append(fps, scene, status);
    document.body.appendChild(el);
    this.el = el;
    this.fpsEl = fps;
    this.sceneEl = scene;
    this.statusEl = status;
  }

  tick(dt: number, sceneName: string, paused: boolean): void {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.frames / this.fpsTimer);
      this.fpsEl.textContent = `${fps.toString().padStart(2, "0")} fps`;
      this.frames = 0;
      this.fpsTimer = 0;
    }
    if (this.sceneEl.textContent !== sceneName) this.sceneEl.textContent = sceneName;
    const status = paused ? "[PAUSE]" : "";
    if (this.statusEl.textContent !== status) this.statusEl.textContent = status;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? "" : "none";
  }
}
