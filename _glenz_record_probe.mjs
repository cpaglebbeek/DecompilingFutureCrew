import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const subsong = process.argv[3] !== undefined ? +process.argv[3] : null;
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base, subsong}) => {
  const ctx=new AudioContext({sampleRate:44100}); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx, repeatCount:-1});
  // route to a MediaStream destination (audio-thread, not main-thread)
  const dest=ctx.createMediaStreamDestination();
  player.gain.connect(dest);
  player.gain.connect(ctx.destination);
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const rec=new MediaRecorder(dest.stream);
  const chunks=[]; rec.ondataavailable=(e)=>{ if(e.data.size)chunks.push(e.data); };
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,800)); // skip startup
  if(subsong!==null){ player.selectSubsong(subsong); await new Promise(r=>setTimeout(r,500)); }
  rec.start();
  await new Promise(r=>setTimeout(r,20000)); // record 20s
  const done=new Promise(res=>{ rec.onstop=res; });
  rec.stop(); await done;
  const blob=new Blob(chunks);
  const buf=await blob.arrayBuffer();
  const dctx=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,44100,44100);
  const decoded=await dctx.decodeAudioData(buf.slice(0));
  const ch=decoded.getChannelData(0); const sr=decoded.sampleRate, N=ch.length;
  const win=Math.floor(sr*0.1); let nz=0,tot=0,maxGap=0,cur=0,peak=0;
  for(let w=0; w*win<N; w++){ let m=0; const s=w*win,e=Math.min(N,s+win); for(let i=s;i<e;i++){const a=Math.abs(ch[i]); if(a>m)m=a;} if(m>peak)peak=m; tot++; if(m>0.01){nz++;cur=0;}else{cur++;if(cur>maxGap)maxGap=cur;} }
  return { subsong, recordedSec:+(N/sr).toFixed(1), dutyPct:Math.round(100*nz/tot), longestGap_ms:maxGap*100, peak:+peak.toFixed(3) };
}, {base, subsong});
console.log("MEDIARECORDER(real audio-thread output, ground truth):", JSON.stringify(r));
await browser.close();
