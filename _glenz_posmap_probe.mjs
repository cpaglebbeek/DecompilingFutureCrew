import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const sub = +(process.argv[3] || "13");
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base,sub}) => {
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  const sp=ctx.createScriptProcessor(4096,2,1);
  let buckets=[];
  sp.onaudioprocess=(e)=>{ const L=e.inputBuffer.getChannelData(0),R=e.inputBuffer.getChannelData(1); let m=0; for(let i=0;i<L.length;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i])); if(a>m)m=a;} buckets.push(m); };
  player.gain.connect(sp); sp.connect(ctx.destination);
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  player.setRepeatCount(-1);
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,400));
  player.selectSubsong(sub);
  const blockMs=4096/ctx.sampleRate*1000;
  const positions=[0,15,30,45,60,75,90,120,150,200,300,400,500,600];
  const out=[];
  for(const pos of positions){
    player.setPos(pos);
    await new Promise(r=>setTimeout(r,400));
    buckets=[];
    await new Promise(r=>setTimeout(r,6000)); // 6s window
    const nz=buckets.filter(b=>b>0.01).length;
    let maxGap=0,cur=0; for(const b of buckets){ if(b<0.01){cur++;if(cur>maxGap)maxGap=cur;}else cur=0; }
    out.push({pos, duty:Math.round(100*nz/buckets.length), gap_ms:Math.round(maxGap*blockMs), max:+Math.max(...buckets).toFixed(2)});
  }
  return out;
}, {base,sub});
console.log(`POSITION MAP subsong ${sub} (6s window each):`);
for(const o of r) console.log(`  pos ${String(o.pos).padStart(3)}s: duty ${String(o.duty).padStart(3)}%  gap ${String(o.gap_ms).padStart(4)}ms  max ${o.max}`);
const best=[...r].filter(o=>o.gap_ms<400).sort((a,b)=>b.duty-a.duty)[0];
console.log("BEST CONTINUOUS:", JSON.stringify(best||"none<400ms gap"));
await browser.close();
