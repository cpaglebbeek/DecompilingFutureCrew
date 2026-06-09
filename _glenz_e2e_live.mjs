import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const nf = [];
page.on("response", r => { if (r.status()===404) nf.push(r.url()); });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => (window).__audio.start());
const s = await page.evaluate(async () => {
  const a = (window).__audio; const out = [];
  for (let i=0;i<24;i++){ await new Promise(r=>setTimeout(r,500)); out.push(+a.debugPeak().toFixed(3)); }
  return { peaks: out, state: a.contextState, t: a.currentTime() };
});
console.log("LIVE HC55 GLENZ audio (MUSIC1):");
console.log("  ctxState=", s.state, " musicTime=", s.t.toFixed(2));
console.log("  peaks=", JSON.stringify(s.peaks));
console.log("  maxPeak=", Math.max(...s.peaks), " audible=", s.peaks.filter(p=>p>0.02).length, "/24");
console.log("  404s=", nf.length? nf : "none");
await browser.close();
