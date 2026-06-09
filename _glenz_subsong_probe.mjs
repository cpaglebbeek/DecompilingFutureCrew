import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
page.on("console", m => console.log("[c]", m.text().slice(0,300)));
await page.goto(url, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async () => {
  const base="/SecondReality/";
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  return await new Promise((resolve)=>{
    const t=setTimeout(()=>resolve({err:"timeout"}),20000);
    player.onMetadata(m=>{
      clearTimeout(t);
      resolve({
        dur:m?.dur, title:m?.title,
        numSubsongs: m?.song?.numSubsongs,
        subsongNames: m?.songs,
        totalOrders: m?.totalOrders, totalPatterns: m?.totalPatterns,
      });
    });
    player.onError(e=>{clearTimeout(t);resolve({err:e.type});});
    player.onInitialized(()=>{
      fetch(base+"audio/MUSIC0.S3M").then(r=>r.arrayBuffer()).then(ab=>player.play(ab));
    });
  });
});
console.log("META:", JSON.stringify(r,null,1));
await browser.close();
