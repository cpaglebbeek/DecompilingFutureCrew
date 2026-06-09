import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const url = "https://horsecloud55.ddns.net/SecondReality/glenz/index.html";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
page.on("console", m => console.log("[c]", m.type(), m.text().slice(0,200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async () => {
  const base = "/SecondReality/";
  const ctx = new AudioContext();
  await ctx.resume();
  const mod = await import(base+"chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx });
  return await new Promise((resolve) => {
    let done=false;
    const t=setTimeout(()=>{ if(!done) resolve({err:"timeout 25s"}); }, 25000);
    player.onError(e=>{ if(!done){done=true;clearTimeout(t);resolve({err:"chiptune error "+e.type});} });
    player.onMetadata(m=>console.log("META dur=",m?.dur, "title=", m?.title));
    player.onFullAudioData(d=>{
      done=true; clearTimeout(t);
      const L=d.data[0], R=d.data[1];
      // continuity: fraction of 128-sample windows with any energy
      let nz=0, win=0; for(let i=0;i<L.length;i+=4410){ win++; let p=0; for(let j=i;j<Math.min(i+4410,L.length);j++){const a=Math.abs(L[j]); if(a>p)p=a;} if(p>0.01)nz++; }
      resolve({ frames:L.length, seconds:+(L.length/ctx.sampleRate).toFixed(1), sampleRate:ctx.sampleRate, nonzeroWindows:nz, totalWindows:win });
    });
    player.onInitialized(()=>{
      player.setRepeatCount(0); // one pass so decodeAll terminates
      fetch(base+"audio/MUSIC0.S3M").then(r=>r.arrayBuffer()).then(ab=>player.decodeAll(ab));
    });
  });
});
console.log("RESULT:", JSON.stringify(r));
await browser.close();
