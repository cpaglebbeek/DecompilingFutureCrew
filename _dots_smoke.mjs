// _dots_smoke.mjs — headless smoke-test voor de DOTS standalone + viewer.
// Laadt de preview-build, activeert de viewer, test de fase-scrubber + drag,
// en de deterministische ?frame=N preview. Maakt screenshots en rapporteert
// console/page-errors. Run: PORT=4180 node _dots_smoke.mjs
import { chromium } from "playwright-core";

const EXE =
  "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const PORT = process.env.PORT || "4180";
const BASE = `http://localhost:${PORT}/DecompilingFutureCrew`;

const browser = await chromium.launch({
  executablePath: EXE,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--enable-unsafe-swiftshader", // headless WebGL2 via software-rasterizer
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console.error: " + m.text());
});
page.on("response", (r) => {
  if (r.status() === 404) errors.push("404: " + r.url());
});

// 1. Viewer-mode
await page.goto(`${BASE}/dots/`, { waitUntil: "networkidle" });
await page.click("#btn-viewer");
await page.waitForTimeout(1500);
const hudViewer = (await page.textContent("#hud"))?.trim();
const hasCore = await page.evaluate(() => !!(window.__core));

// fase-scrubber: kies fase 2
await page.keyboard.press("2");
await page.waitForTimeout(400);
const hudFase2 = (await page.textContent("#hud"))?.trim();

// drag-rotate
await page.mouse.move(450, 300);
await page.mouse.down();
await page.mouse.move(560, 360, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: "/tmp/dots_viewer.png" });

// 2. deterministische ?frame=N
const errBefore = errors.length;
await page.goto(`${BASE}/dots/?frame=600`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "/tmp/dots_frame600.png" });
const errFrame = errors.length - errBefore;

console.log("HUD(viewer):", hudViewer);
console.log("HUD(fase2) :", hudFase2);
console.log("hasCore    :", hasCore);
console.log("errors     :", errors.length);
for (const e of errors.slice(0, 8)) console.log("  -", e);
console.log("frame-errs :", errFrame);
console.log("screenshots: /tmp/dots_viewer.png /tmp/dots_frame600.png");
await browser.close();
