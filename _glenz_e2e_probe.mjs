import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const logs=[]; page.on("console", m => logs.push(`[c] ${m.type()} ${m.text()}`));
page.on("pageerror", e => logs.push(`[pageerr] ${e.message}`));
const failed=[]; page.on("requestfailed", req => failed.push(req.url()));
page.on("response", resp => { if(resp.status()>=400) failed.push(resp.status()+" "+resp.url()); });
await page.goto(url, { waitUntil: "networkidle" });
await page.mouse.click(320, 200);
const r = await page.evaluate(async () => {
  const a = window.__audio; if (!a) return {err:"no __audio"};
  await new Promise(r=>setTimeout(r,4500));
  const peaks=[]; for(let i=0;i<120;i++){ await new Promise(r=>setTimeout(r,100)); peaks.push(a.debugPeak()); }
  const nz = peaks.filter(p=>p>0.01).length;
  let maxGap=0,cur=0; for(const p of peaks){ if(p<0.01){cur++; if(cur>maxGap)maxGap=cur;} else cur=0; }
  return { samples:peaks.length, nonzero: nz, dutyPct:+(100*nz/peaks.length).toFixed(0),
           longestGap_ms: maxGap*100, max:+Math.max(...peaks).toFixed(3),
           started:a.isStarted, state:a.contextState,
           head: peaks.slice(0,20).map(p=>+p.toFixed(2)), tail: peaks.slice(-20).map(p=>+p.toFixed(2)) };
});
console.log("CONSOLE:"); for(const l of logs) console.log(" ",l);
console.log("FAILED:"); for(const f of failed) console.log(" ",f);
console.log("E2E:", JSON.stringify(r));
await browser.close();
