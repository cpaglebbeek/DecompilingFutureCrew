import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "http://localhost:4173/DecompilingFutureCrew/glenz/index.html";
const sub = +process.argv[2];
const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async (sub) => {
  const base="/DecompilingFutureCrew/";
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  const an=ctx.createAnalyser(); player.gain.connect(an);
  const peak=()=>{const b=new Float32Array(an.fftSize);an.getFloatTimeDomainData(b);let p=0;for(const v of b){const a=Math.abs(v);if(a>p)p=a;}return p;};
  await new Promise(res=>player.onInitialized(()=>res()));
  player.setRepeatCount(-1);
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,500));
  player.selectSubsong(sub); player.setPos(0);
  await new Promise(r=>setTimeout(r,1500));
  const peaks=[]; for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));peaks.push(+peak().toFixed(2));}
  return { sub, nonzero_of_80:peaks.filter(p=>p>0.01).length, max:+Math.max(...peaks).toFixed(2), peaks };
}, sub);
console.log(`SUBSONG ${sub}:`, JSON.stringify(r));
await browser.close();
