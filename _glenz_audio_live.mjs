import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on("console", m => console.log("[c]", m.type(), m.text()));
page.on("pageerror", e => console.log("[pageerr]", e.message));
const bad = [];
page.on("response", r => { if (r.status()>=400 && /chiptune|openmpt|MUSIC0|worklet|s3m/i.test(r.url())) bad.push(`${r.status()} ${r.url()}`); });
await page.goto(url, { waitUntil: "networkidle" });
await page.mouse.click(320, 200);
const series = await page.evaluate(async () => {
  const a = window.__audio;
  if (!a) return { err: "no window.__audio", keys: Object.keys(window).filter(k=>k.startsWith("__")) };
  const out = [];
  for (let i=0;i<20;i++){ await new Promise(r=>setTimeout(r,500)); out.push({t:+(a.currentTime?.()||0).toFixed(2), state:a.contextState, peak:+a.debugPeak().toFixed(3)}); }
  return { started:a.isStarted, muted:a.isMuted, series: out };
});
console.log("=== bad assets ===", bad.length?bad:"none");
console.log("=== series ===", JSON.stringify(series, null, 1));
await browser.close();
