import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base}) => {
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  const an=ctx.createAnalyser(); player.gain.connect(an);
  function peak(){const b=new Float32Array(an.fftSize);an.getFloatTimeDomainData(b);let p=0;for(const v of b){const a=Math.abs(v);if(a>p)p=a;}return p;}
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  player.setRepeatCount(-1);
  const ab = await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,700));
  const out=[];
  for(let s=0;s<17;s++){
    player.selectSubsong(s);
    await new Promise(r=>setTimeout(r,500)); // let it settle into the subsong
    const peaks=[]; for(let i=0;i<90;i++){ await new Promise(r=>setTimeout(r,100)); peaks.push(peak()); } // 9s window
    const nz=peaks.filter(p=>p>0.01).length;
    let maxGap=0,cur=0; for(const p of peaks){ if(p<0.01){cur++;if(cur>maxGap)maxGap=cur;}else cur=0; }
    out.push({s, duty:Math.round(100*nz/90), gap_ms:maxGap*100, max:+Math.max(...peaks).toFixed(2)});
  }
  return out;
}, {base});
console.log("SUBSONG SCAN (9s window each):");
for(const o of r) console.log(`  subsong ${String(o.s).padStart(2)}: duty ${String(o.duty).padStart(3)}%  longestGap ${String(o.gap_ms).padStart(4)}ms  max ${o.max}`);
const best=[...r].sort((a,b)=>b.duty-a.duty||a.gap_ms-b.gap_ms).slice(0,4);
console.log("BEST:", JSON.stringify(best));
await browser.close();
