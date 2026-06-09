import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errs = [];
page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
page.on("pageerror", e => errs.push("PAGEERR "+e.message));
for (const f of process.argv.slice(2)) {
  await page.goto(`${base}?frame=${f}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const out = `/tmp/glenz_live_${f}.png`;
  await page.screenshot({ path: out });
  console.log("wrote", out);
}
if (errs.length) console.log("CONSOLE ERRORS:\n"+errs.join("\n")); else console.log("no console errors");
await browser.close();
