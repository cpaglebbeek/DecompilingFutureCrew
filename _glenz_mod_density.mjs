import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = "http://localhost:5173/DecompilingFutureCrew/";
const file = process.argv[2] || "MUSIC1.S3M";
const nsub = +(process.argv[3] || "20");
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base + "glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({ base, file, nsub }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const mod = await import(base + "chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx, repeatCount: 0 });
  await new Promise((res) => { player.onInitialized(() => res()); });
  const ab = await (await fetch(base + "audio/" + file)).arrayBuffer();
  function decode(subsong) {
    return new Promise((res, rej) => {
      const tm = setTimeout(() => rej(new Error("timeout")), 180000);
      player.onFullAudioData((d) => { clearTimeout(tm); res(d); });
      if (subsong === null) player.decodeAll(ab.slice(0));
      else player.decodeAll({ buf: ab.slice(0), subsong });
    });
  }
  function measure(data) {
    const L = data.data[0], sr = 44100, N = L.length, win = Math.floor(sr * 0.1);
    let nz = 0, tot = 0, maxGap = 0, cur = 0, peak = 0, sumsq = 0;
    for (let w = 0; w * win < N; w++) {
      let mx = 0; const s0 = w * win, e = Math.min(N, s0 + win);
      for (let i = s0; i < e; i++) { const a = Math.abs(L[i]); if (a > mx) mx = a; sumsq += L[i] * L[i]; }
      if (mx > peak) peak = mx; tot++;
      if (mx > 0.01) { nz++; cur = 0; } else { cur++; if (cur > maxGap) maxGap = cur; }
    }
    const rms = Math.sqrt(sumsq / N);
    return { dur: +(N / sr).toFixed(1), duty: Math.round(100 * nz / tot), rms: +rms.toFixed(4), peak: +peak.toFixed(3), crest: +(peak / (rms || 1e-9)).toFixed(1), gap_ms: maxGap * 100 };
  }
  const out = { title: null, default: null, subsongs: [] };
  const d0 = await decode(null);
  out.title = d0.meta && d0.meta.title;
  out.default = measure(d0);
  for (let s = 0; s < nsub; s++) {
    try { out.subsongs.push({ s, ...measure(await decode(s)) }); }
    catch (e) { out.subsongs.push({ s, err: String(e.message || e) }); break; }
  }
  return out;
}, { base, file, nsub });
console.log("DENSITY scan of " + file + "  title=" + JSON.stringify(r.title));
console.log("  default: " + JSON.stringify(r.default));
r.subsongs.sort((a,b)=> (b.rms*b.duty)-(a.rms*a.duty)).forEach(o=>console.log("  " + JSON.stringify(o)));
await browser.close();
