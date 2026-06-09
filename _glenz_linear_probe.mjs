import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:5173/DecompilingFutureCrew/";
const secs = +(process.argv[3] || "60");
const subsong = process.argv[4] !== undefined ? +process.argv[4] : null;
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base + "glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({ base, secs, subsong }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const mod = await import(base + "chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx, repeatCount: -1 });
  await new Promise((res) => { player.onInitialized(() => res()); });
  const ab = await (await fetch(base + "audio/MUSIC0.S3M")).arrayBuffer();
  const orig = player.processNode.port.onmessage;
  const done = new Promise((res) => {
    player.processNode.port.onmessage = (e) => {
      if (e.data && e.data.cmd === "linearResult") res(e.data.data);
      else orig(e);
    };
  });
  player.postMsg("measureLinear", { buf: ab, seconds: secs, subsong });
  return await done;
}, { base, secs, subsong });
console.log("LINEAR-PATH ground truth (repeat=-1, throttle-immune, subsong=" + subsong + "):");
console.log("  " + JSON.stringify(r));
await browser.close();
