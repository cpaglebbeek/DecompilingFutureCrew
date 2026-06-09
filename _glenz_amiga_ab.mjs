import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
// which = "asm2web" (Amiga resampler ON, working reference) | "glenz" (Amiga OFF)
const which = process.argv[2] || "glenz";
const cfg = which === "asm2web"
  ? { page: "http://localhost:8086/", mod: "/vendor/chiptune3/chiptune3.js", s3m: "/assets/music0.s3m" }
  : { page: "http://localhost:5173/DecompilingFutureCrew/glenz/index.html", mod: "/DecompilingFutureCrew/chiptune3/chiptune3.js", s3m: "/DecompilingFutureCrew/audio/MUSIC0.S3M" };
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(cfg.page, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({ mod, s3m }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const m = await import(mod);
  // repeatCount 0 so decodeAll's read-loop terminates at song end (default subsong, plain)
  const player = new m.ChiptuneJsPlayer({ context: ctx, repeatCount: 0 });
  await new Promise((res) => { player.onInitialized(() => res()); });
  const ab = await (await fetch(s3m)).arrayBuffer();
  const data = await new Promise((res, rej) => {
    const tm = setTimeout(() => rej(new Error("timeout")), 120000);
    player.onFullAudioData((d) => { clearTimeout(tm); res(d); });
    player.decodeAll(ab); // RAW arraybuffer = default subsong, no selection
  });
  const L = data.data[0], R = data.data[1], sr = 44100, N = L.length;
  const win = Math.floor(sr * 0.1);
  let nz = 0, tot = 0, maxGap = 0, cur = 0, peak = 0, sumsq = 0;
  for (let w = 0; w * win < N; w++) {
    let mx = 0; const s0 = w * win, e = Math.min(N, s0 + win);
    for (let i = s0; i < e; i++) { const a = Math.abs(L[i]); if (a > mx) mx = a; sumsq += L[i] * L[i]; }
    if (mx > peak) peak = mx; tot++;
    if (mx > 0.01) { nz++; cur = 0; } else { cur++; if (cur > maxGap) maxGap = cur; }
  }
  const rms = Math.sqrt(sumsq / N), crest = peak / (rms || 1e-9);
  return { dur: +(N / sr).toFixed(1), duty: Math.round(100 * nz / tot), rms: +rms.toFixed(4), peak: +peak.toFixed(3), crest: +crest.toFixed(1), gap_ms: maxGap * 100, meta_title: data.meta && data.meta.title };
}, cfg);
console.log(which.toUpperCase() + " plain default-subsong decode (Amiga " + (which === "asm2web" ? "ON" : "OFF") + "):");
console.log("  " + JSON.stringify(r));
await browser.close();
