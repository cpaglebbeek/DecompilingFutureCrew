// vga.ts — minimal VGA model: a 320x200 indexed framebuffer + 256-colour
// 6-bit palette, presented pixelated to a canvas. Replaces direct VGA memory
// (0xA0000) and port I/O (3c8h/3c9h DAC) with web abstractions.
//
// The indexed layer (Uint8Array + palette) is the authentic mode-13h model.
// On top of it the renderer accumulates the translucent glenz polygons
// additively into an RGBA buffer (the original achieves additivity via a
// palette-OR trick; additive RGBA is the sanctioned semantic equivalent).

import { WIDTH, HEIGHT } from "./glenz_data.js";

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

export class VGA {
  readonly width = WIDTH;
  readonly height = HEIGHT;

  // Authentic mode-13h state.
  readonly indexed = new Uint8Array(WIDTH * HEIGHT);
  readonly palette = new Uint8Array(256 * 3); // 6-bit (0..63) per channel

  // Presentation buffer (8-bit RGBA) + offscreen for nearest-neighbour scaling.
  private readonly rgba: Uint8ClampedArray;
  private readonly image: ImageData;
  private readonly off: HTMLCanvasElement;
  private readonly offCtx: CanvasRenderingContext2D;

  constructor() {
    this.image = new ImageData(WIDTH, HEIGHT);
    this.rgba = this.image.data;
    this.off = document.createElement("canvas");
    this.off.width = WIDTH;
    this.off.height = HEIGHT;
    const ctx = this.off.getContext("2d");
    if (!ctx) throw new Error("VGA: 2D context unavailable");
    this.offCtx = ctx;
    // sensible default greyscale ramp so an un-set palette is still visible
    for (let i = 0; i < 256; i++) {
      const v = (i >> 2) & 63;
      this.palette[i * 3] = v;
      this.palette[i * 3 + 1] = v;
      this.palette[i * 3 + 2] = v;
    }
  }

  // Port 3c8h/3c9h DAC write: set one palette entry (6-bit components).
  setPaletteEntry(i: number, r: number, g: number, b: number): void {
    const p = i * 3;
    this.palette[p] = r & 63;
    this.palette[p + 1] = g & 63;
    this.palette[p + 2] = b & 63;
  }

  clearIndexed(idx = 0): void {
    this.indexed.fill(idx);
  }

  // Rasterise the indexed framebuffer into the RGBA presentation buffer,
  // expanding 6-bit DAC values to 8-bit (web = round(vga*255/63)).
  composeBackground(): void {
    const { indexed, palette, rgba } = this;
    for (let i = 0, j = 0; i < indexed.length; i++, j += 4) {
      const c = indexed[i]! * 3;
      rgba[j] = Math.round((palette[c]! * 255) / 63);
      rgba[j + 1] = Math.round((palette[c + 1]! * 255) / 63);
      rgba[j + 2] = Math.round((palette[c + 2]! * 255) / 63);
      rgba[j + 3] = 255;
    }
  }

  // Additive plot into the presentation buffer (clamped). x,y already integers
  // inside bounds — the renderer clips before calling.
  addPixel(x: number, y: number, r: number, g: number, b: number): void {
    const j = (y * WIDTH + x) * 4;
    const d = this.rgba;
    d[j] = clamp8(d[j]! + r);
    d[j + 1] = clamp8(d[j + 1]! + g);
    d[j + 2] = clamp8(d[j + 2]! + b);
  }

  // Blit to the visible canvas, scaled with no smoothing (pixelated look).
  present(ctx: CanvasRenderingContext2D, dstW: number, dstH: number): void {
    this.offCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dstW, dstH);
    ctx.drawImage(this.off, 0, 0, WIDTH, HEIGHT, 0, 0, dstW, dstH);
  }
}
