import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const mode = process.argv[3] || "B"; // A=no setPos, B=setPos0, C=repeat-after-select, D=no-setPos+repeat-after
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
const logs=[]; page.on("console", m => logs.push(m.text().slice(0,160)));
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base,mode}) => {
  const ctx=new AudioContext(); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx});
  player.gain.connect(ctx.destination);
  const an=ctx.createAnalyser(); player.gain.connect(an);
  function peak(){const b=new Float32Array(an.fftSize);an.getFloatTimeDomainData(b);let p=0;for(const v of b){const a=Math.abs(v);if(a>p)p=a;}return p;}
  let ended=0, lastPos=-1;
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  // hook worklet messages for end/pos (processNode exists now)
  const orig = player.processNode.port.onmessage;
  player.processNode.port.onmessage = (e)=>{ if(e.data.cmd==='end')ended++; if(e.data.cmd==='pos')lastPos=e.data.pos; if(orig)orig(e); };
  player.setRepeatCount(-1);
  const ab = await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,700));
  player.selectSubsong(13);
  if(mode==="B") player.setPos(0);
  if(mode==="C"){ player.setPos(0); player.setRepeatCount(-1); }
  if(mode==="D"){ player.setRepeatCount(-1); }
  await new Promise(r=>setTimeout(r,1200));
  const peaks=[]; for(let i=0;i<150;i++){ await new Promise(r=>setTimeout(r,100)); peaks.push(+peak().toFixed(2)); }
  const nz=peaks.filter(p=>p>0.01).length;
  let maxGap=0,cur=0; for(const p of peaks){ if(p<0.01){cur++;if(cur>maxGap)maxGap=cur;}else cur=0; }
  return { mode, nonzero_of_150:nz, dutyPct:Math.round(100*nz/150), longestGap_ms:maxGap*100,
           endEvents:ended, lastPos:+lastPos.toFixed(1), max:+Math.max(...peaks).toFixed(3) };
}, {base,mode});
console.log("LOGS:", logs.slice(-8).join(" | "));
console.log("RESULT:", JSON.stringify(r));
await browser.close();
