import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
page.on("console", m => console.log("[c]", m.text().slice(0,200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async () => {
  const base="/SecondReality/";
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  const an=ctx.createAnalyser(); player.gain.connect(an);
  function peak(){const b=new Float32Array(an.fftSize);an.getFloatTimeDomainData(b);let p=0;for(const v of b){const a=Math.abs(v);if(a>p)p=a;}return p;}
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  player.setRepeatCount(-1);
  // load module
  const ab = await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,600));
  player.selectSubsong(-1);     // <-- play ALL subsongs
  player.setPos(0);
  await new Promise(r=>setTimeout(r,1500)); // let it spin
  const peaks=[]; for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,100)); peaks.push(+peak().toFixed(2)); }
  const nz=peaks.filter(p=>p>0.01).length;
  return { nonzero_of_80:nz, max:+Math.max(...peaks).toFixed(3), peaks };
});
console.log("SUBSONG -1 RESULT:", JSON.stringify(r));
await browser.close();
