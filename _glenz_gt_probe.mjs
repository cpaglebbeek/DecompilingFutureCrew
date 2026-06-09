import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:5173/DecompilingFutureCrew/";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
const logs=[]; page.on("console", m => logs.push(m.text().slice(0,120)));
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base}) => {
  const ctx=new AudioContext({sampleRate:44100}); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx, repeatCount:0});
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  async function decode(subsong){
    const data=await new Promise((res,rej)=>{
      const tm=setTimeout(()=>rej(new Error("timeout")),90000);
      const h=(d)=>{ clearTimeout(tm); res(d); };
      player.onFullAudioData(h);
      player.decodeAll({buf: ab.slice(0), subsong});
    });
    const left=data.data[0]; const sr=44100, N=left.length;
    const win=Math.floor(sr*0.1); let nz=0,tot=0,maxGap=0,cur=0,peak=0;
    for(let w=0; w*win<N; w++){ let m=0; const s=w*win,e=Math.min(N,s+win); for(let i=s;i<e;i++){const a=Math.abs(left[i]);if(a>m)m=a;} if(m>peak)peak=m; tot++; if(m>0.01){nz++;cur=0;}else{cur++;if(cur>maxGap)maxGap=cur;} }
    return { subsong, durSec:+(N/sr).toFixed(1), dutyPct:Math.round(100*nz/tot), longestGap_ms:maxGap*100, peak:+peak.toFixed(3) };
  }
  const out=[];
  for(const s of [null,4,7,12,13]){ out.push(await decode(s)); }
  return out;
}, {base});
console.log("LOGS:", logs.slice(-3).join(" | "));
console.log("GROUND-TRUTH decodeAll per subsong (offline, throttle-immune):");
for(const o of r) console.log("  ", JSON.stringify(o));
await browser.close();
