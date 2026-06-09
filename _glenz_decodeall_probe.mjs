import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
const logs=[]; page.on("console", m => logs.push(m.text().slice(0,120)));
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base}) => {
  const ctx=new AudioContext({sampleRate:44100}); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx, repeatCount:0}); // play-once so decodeAll terminates
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  const data=await new Promise((res,rej)=>{
    const tm=setTimeout(()=>rej(new Error("decodeAll timeout 60s")),60000);
    player.onFullAudioData((d)=>{ clearTimeout(tm); res(d); });
    player.decodeAll(ab.slice(0));
  });
  // data.data = [leftArray, rightArray]
  const left = data.data[0], right = data.data[1];
  const N = left.length, sr=44100;
  const durSec = +(N/sr).toFixed(2);
  // silence structure over 100ms windows
  const win = Math.floor(sr*0.1);
  let nzWin=0, totWin=0, maxGapWin=0, cur=0, peak=0;
  for(let w=0; w*win<N; w++){
    let m=0; const s=w*win, e=Math.min(N,s+win);
    for(let i=s;i<e;i++){ const a=Math.max(Math.abs(left[i]),Math.abs(right[i])); if(a>m)m=a; }
    if(m>peak)peak=m;
    totWin++; if(m>0.01){ nzWin++; cur=0; } else { cur++; if(cur>maxGapWin)maxGapWin=cur; }
  }
  return { samples:N, durSec, dutyPct:Math.round(100*nzWin/totWin), longestGap_ms:maxGapWin*100,
           peak:+peak.toFixed(3), meta_dur: data.meta && data.meta.dur };
}, {base});
console.log("LOGS:", logs.slice(-4).join(" | "));
console.log("DECODEALL(default subsong, ground truth):", JSON.stringify(r));
await browser.close();
