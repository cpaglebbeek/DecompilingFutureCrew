import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = process.argv[2] || "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const logs=[]; page.on("console", m => logs.push(`[c] ${m.type()} ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerr] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
await page.mouse.click(320, 200);
const r = await page.evaluate(async () => {
  const a = window.__audio; if (!a) return {err:"no __audio"};
  await new Promise(r=>setTimeout(r,4000)); // let it spin up
  const peaks=[]; for(let i=0;i<60;i++){ await new Promise(r=>setTimeout(r,100)); peaks.push(a.debugPeak()); }
  const nz = peaks.filter(p=>p>0.01).length;
  return { nonzero_of_60: nz, max:+Math.max(...peaks).toFixed(3), peaks: peaks.map(p=>+p.toFixed(2)) };
});
console.log("CONSOLE:"); for(const l of logs) console.log(" ",l);
console.log("DENSE:", JSON.stringify(r));
await browser.close();
