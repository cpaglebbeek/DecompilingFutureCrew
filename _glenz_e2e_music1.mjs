import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "http://localhost:5173/DecompilingFutureCrew/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errs = [];
page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
page.on("pageerror", e => errs.push("PAGEERROR: "+e.message));
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => (window).__audio.start());
const samples = await page.evaluate(async () => {
  const a = (window).__audio;
  const out = [];
  for (let i=0;i<24;i++){ await new Promise(r=>setTimeout(r,500)); out.push(+a.debugPeak().toFixed(3)); }
  return { peaks: out, state: a.contextState, started: a.isStarted, t: a.currentTime() };
});
const peaks = samples.peaks;
const maxP = Math.max(...peaks);
const audible = peaks.filter(p=>p>0.02).length;
console.log("e2e MUSIC1 live (headless, ~12s):");
console.log("  ctxState=", samples.state, " started=", samples.started, " musicTime=", samples.t.toFixed(2));
console.log("  peaks=", JSON.stringify(peaks));
console.log("  maxPeak=", maxP, " audible_windows=", audible, "/24");
console.log("  errors=", errs.length ? errs.slice(0,5) : "none");
await browser.close();
