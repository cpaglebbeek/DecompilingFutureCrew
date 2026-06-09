import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base}) => {
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  // EXACT ASM2Web approach: repeatCount in ctor, play(ab), NO selectSubsong/setPos
  const player=new mod.ChiptuneJsPlayer({context:ctx, repeatCount:-1});
  player.gain.connect(ctx.destination);
  const sp=ctx.createScriptProcessor(4096,2,1);
  let buckets=[]; let posSamples=[];
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const onmsg=player.processNode.port.onmessage;
  let ended=0,lastPos=-1;
  player.processNode.port.onmessage=(e)=>{ if(e.data.cmd==='end')ended++; if(e.data.cmd==='pos'){lastPos=e.data.pos; posSamples.push(+e.data.pos.toFixed(1));} if(onmsg)onmsg(e); };
  sp.onaudioprocess=(e)=>{ const L=e.inputBuffer.getChannelData(0),R=e.inputBuffer.getChannelData(1); let m=0; for(let i=0;i<L.length;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i])); if(a>m)m=a;} buckets.push(m); };
  player.gain.connect(sp); sp.connect(ctx.destination);
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  buckets.length=0;
  await new Promise(r=>setTimeout(r,30000)); // 30s
  const blockMs=4096/ctx.sampleRate*1000;
  const nz=buckets.filter(b=>b>0.01).length;
  let maxGap=0,cur=0; for(const b of buckets){ if(b<0.01){cur++;if(cur>maxGap)maxGap=cur;}else cur=0; }
  // does pos loop (reset to ~0)? count resets
  let resets=0; for(let i=1;i<posSamples.length;i++){ if(posSamples[i]<posSamples[i-1]-0.5) resets++; }
  return { blocks:buckets.length, dutyPct:Math.round(100*nz/buckets.length), longestGap_ms:Math.round(maxGap*blockMs),
           endEvents:ended, lastPos:+lastPos.toFixed(1), posResets:resets, posMax:Math.max(...posSamples), max:+Math.max(...buckets).toFixed(3) };
}, {base});
console.log("PLAIN(ASM2Web-style):", JSON.stringify(r));
await browser.close();
