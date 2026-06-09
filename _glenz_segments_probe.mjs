import { chromium } from "playwright-core";
const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:4174/DecompilingFutureCrew/";
const subsong = process.argv[3] !== undefined ? +process.argv[3] : null;
const secs = +(process.argv[4]||"50");
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.goto(base+"glenz/index.html", { waitUntil: "domcontentloaded" });
const r = await page.evaluate(async ({base, subsong, secs}) => {
  const ctx=new AudioContext({sampleRate:44100}); await ctx.resume();
  const mod=await import(base+"chiptune3/chiptune3.js");
  const player=new mod.ChiptuneJsPlayer({context:ctx, repeatCount:-1});
  const dest=ctx.createMediaStreamDestination();
  player.gain.connect(dest); player.gain.connect(ctx.destination);
  await new Promise((res)=>{ player.onInitialized(()=>res()); });
  const rec=new MediaRecorder(dest.stream); const chunks=[]; rec.ondataavailable=(e)=>{ if(e.data.size)chunks.push(e.data); };
  const ab=await (await fetch(base+"audio/MUSIC0.S3M")).arrayBuffer();
  player.play(ab);
  await new Promise(r=>setTimeout(r,700));
  if(subsong!==null){ player.selectSubsong(subsong); await new Promise(r=>setTimeout(r,400)); }
  rec.start();
  await new Promise(r=>setTimeout(r,secs*1000));
  const done=new Promise(res=>{ rec.onstop=res; }); rec.stop(); await done;
  const buf=await new Blob(chunks).arrayBuffer();
  const dctx=new (window.OfflineAudioContext)(1,44100,44100);
  const dec=await dctx.decodeAudioData(buf.slice(0));
  const ch=dec.getChannelData(0), sr=dec.sampleRate, N=ch.length;
  const win=Math.floor(sr*0.1);
  // per-10s segment duty
  const segLen=Math.floor(sr*10), segs=[];
  for(let s=0;s*segLen<N;s++){ let nz=0,tot=0; const a=s*segLen,b=Math.min(N,a+segLen);
    for(let w=a; w<b; w+=win){ let m=0; const e=Math.min(b,w+win); for(let i=w;i<e;i++){const v=Math.abs(ch[i]);if(v>m)m=v;} tot++; if(m>0.01)nz++; }
    segs.push(Math.round(100*nz/tot)); }
  return { subsong, recSec:+(N/sr).toFixed(1), segDuty10s:segs };
}, {base, subsong, secs});
console.log("SEGMENTS:", JSON.stringify(r));
await browser.close();
