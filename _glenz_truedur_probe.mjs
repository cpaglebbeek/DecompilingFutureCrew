import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const sub = process.argv[3] || "13";
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
const logs=[]; page.on("console", m => logs.push(m.text().slice(0,140)));
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base,sub}) => {
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  // ScriptProcessor sees EVERY 4096-sample block (~93ms) with no aliasing
  const sp=ctx.createScriptProcessor(4096,2,1);
  const buckets=[]; // per-block max abs
  sp.onaudioprocess=(e)=>{ const L=e.inputBuffer.getChannelData(0),R=e.inputBuffer.getChannelData(1); let m=0; for(let i=0;i<L.length;i++){const a=Math.max(Math.abs(L[i]),Math.abs(R[i])); if(a>m)m=a;} buckets.push(+m.toFixed(3)); };
  player.gain.connect(sp); sp.connect(ctx.destination);
  let ended=0,lastPos=-1;
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const onmsg=player.processNode.port.onmessage;
  player.processNode.port.onmessage=(e)=>{ if(e.data.cmd==='end')ended++; if(e.data.cmd==='pos')lastPos=e.data.pos; if(onmsg)onmsg(e); };
  player.setRepeatCount(-1);
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,500));
  player.selectSubsong(+sub);
  buckets.length=0; // discard pre-select
  await new Promise(r=>setTimeout(r,20000)); // 20s continuous capture
  const total=buckets.length;
  const nz=buckets.filter(b=>b>0.01).length;
  let maxGap=0,cur=0; for(const b of buckets){ if(b<0.01){cur++;if(cur>maxGap)maxGap=cur;}else cur=0; }
  const blockMs=4096/ctx.sampleRate*1000;
  return { sub:+sub, blocks:total, blockMs:+blockMs.toFixed(0), dutyPct:Math.round(100*nz/total),
           longestGap_ms:Math.round(maxGap*blockMs), endEvents:ended, lastPos:+lastPos.toFixed(1),
           max:+Math.max(...buckets).toFixed(3) };
}, {base,sub});
console.log("LOGS:", logs.slice(-5).join(" | "));
console.log("TRUEDUR:", JSON.stringify(r));
await browser.close();
