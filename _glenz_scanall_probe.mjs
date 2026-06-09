import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:5173/DecompilingFutureCrew/";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base + "glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({ base }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const mod = await import(base + "chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx, repeatCount: 0 });
  await new Promise((res) => { player.onInitialized(() => res()); });
  const ab = await (await fetch(base + "audio/MUSIC0.S3M")).arrayBuffer();
  function decode(subsong) {
    return new Promise((res, rej) => {
      const tm = setTimeout(() => rej(new Error("timeout")), 120000);
      const h = (d) => { clearTimeout(tm); res(d); };
      player.onFullAudioData(h);
      player.decodeAll({ buf: ab.slice(0), subsong });
    });
  }
  const out = [];
  for (let s = 0; s < 17; s++) {
    const data = await decode(s);
    const L = data.data[0], R = data.data[1], sr = 44100, N = L.length;
    const win = Math.floor(sr * 0.1);
    let nz = 0, tot = 0, maxGap = 0, cur = 0, peak = 0, sumsq = 0;
    for (let w = 0; w * win < N; w++) {
      let m = 0; const s0 = w * win, e = Math.min(N, s0 + win);
      for (let i = s0; i < e; i++) { const a = Math.abs(L[i]); if (a > m) m = a; sumsq += L[i] * L[i]; }
      if (m > peak) peak = m; tot++;
      if (m > 0.01) { nz++; cur = 0; } else { cur++; if (cur > maxGap) maxGap = cur; }
    }
    out.push({ s, dur: +(N / sr).toFixed(1), duty: Math.round(100 * nz / tot), rms: +Math.sqrt(sumsq / N).toFixed(3), gap_ms: maxGap * 100, peak: +peak.toFixed(3) });
  }
  return out;
}, { base });
console.log("ALL-SUBSONG offline scan (throttle-immune). Sorted by rms*duty (musical density):");
r.map(o => ({ ...o, score: +(o.rms * o.duty).toFixed(2) }))
 .sort((a, b) => b.score - a.score)
 .forEach(o => console.log("  " + JSON.stringify(o)));
await browser.close();
