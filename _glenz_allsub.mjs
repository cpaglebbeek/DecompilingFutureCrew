import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = "http://localhost:5173/DecompilingFutureCrew/";
const file = process.argv[2] || "MUSIC0.S3M";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base + "glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({ base, file }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const mod = await import(base + "chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx, repeatCount: 0 });
  await new Promise((res) => { player.onInitialized(() => res()); });
  const ab = await (await fetch(base + "audio/" + file)).arrayBuffer();
  const data = await new Promise((res, rej) => {
    const tm = setTimeout(() => rej(new Error("timeout")), 240000);
    player.onFullAudioData((d) => { clearTimeout(tm); res(d); });
    player.decodeAll({ buf: ab.slice(0), subsong: -1 }); // -1 = play ALL subsongs in sequence
  });
  const L = data.data[0], sr = 44100, N = L.length, win = Math.floor(sr * 0.1);
  let nz = 0, tot = 0, maxGap = 0, cur = 0, peak = 0, sumsq = 0;
  for (let w = 0; w * win < N; w++) {
    let mx = 0; const s0 = w * win, e = Math.min(N, s0 + win);
    for (let i = s0; i < e; i++) { const a = Math.abs(L[i]); if (a > mx) mx = a; sumsq += L[i] * L[i]; }
    if (mx > peak) peak = mx; tot++;
    if (mx > 0.01) { nz++; cur = 0; } else { cur++; if (cur > maxGap) maxGap = cur; }
  }
  const rms = Math.sqrt(sumsq / N);
  return { title: data.meta && data.meta.title, dur: +(N/sr).toFixed(1), duty: Math.round(100*nz/tot), rms:+rms.toFixed(4), peak:+peak.toFixed(3), crest:+(peak/(rms||1e-9)).toFixed(1), gap_ms: maxGap*100 };
}, { base, file });
console.log(file + " select_subsong(-1) ALL: " + JSON.stringify(r));
await browser.close();
