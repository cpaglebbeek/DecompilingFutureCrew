// render_segments.mjs — render each +++-delimited MUSIC1.S3M segment as ONE clean cue.
//
// WHY: MUSIC1.S3M is not one song but a cue-bank: its 100-order list is split by
// 15 +++ skip-markers (S3M order 0xFE) into 16 segments. Each segment is a
// self-contained musical cue (or an SFX block) that the demo JUMPS to and LOOPS
// per part — it is never played linearly 0->99 (that chains unrelated cues + the
// SFX bank = unrecognisable). Rendering ONE segment (start-order -> its +++
// marker) reproduces exactly the music a single part hears. The right audition
// granularity is these 16 segments, NOT libopenmpt's 55 over-split "subsongs".
//
// HOW: for each segment, select the whole song (-1), seek to the segment's first
// order via set_position_order_row, render until the player crosses the segment's
// +++ marker (get_current_order leaves the range) or a safety CAP elapses
// (segments that loop internally via a Bxx jump never cross their marker).
//
// Output: /tmp/m1_segments/seg_NN.mp3 + index.html audition page.
// Deterministic: same MUSIC1.S3M -> same segments.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const S3M = join(here, "..", "public", "audio", "MUSIC1.S3M");
const WASM_JS = join(here, "..", "public", "chiptune3", "libopenmpt.worklet.js");
const OUTDIR = "/tmp/m1_segments";
const SR = 48000;
const CAP_S = 26;          // safety cap for internally-looping segments
const FR = 4096;

mkdirSync(OUTDIR, { recursive: true });

// ── parse the order list to find the 16 +++-delimited segments ───────────────
const f = readFileSync(S3M);
const u16 = (o) => f[o] | (f[o + 1] << 8);
const ordnum = u16(0x20);
const ord = [];
for (let i = 0; i < ordnum; i++) ord.push(f[0x60 + i]);
// segment = run of real orders [start, marker) ; marker = +++ (254) or --- (255)
const segs = [];
let start = 0;
for (let i = 0; i < ord.length; i++) {
  if (ord[i] === 254 || ord[i] === 255) {
    if (i > start) segs.push({ start, marker: i });
    start = i + 1;
  }
}
console.log(`order list: ${ordnum} orders -> ${segs.length} segments`);

// ── render each segment ──────────────────────────────────────────────────────
const { default: libopenmpt } = await import(WASM_JS);
const mod = await libopenmpt();
const data = readFileSync(S3M);
const ptr = mod._malloc(data.length);
mod.HEAPU8.set(data, ptr);
const handle = mod._openmpt_module_create_from_memory(ptr, data.length, 0, 0, 0);
mod._free(ptr);
if (!handle) throw new Error("openmpt: failed to load MUSIC1.S3M");

const lp = mod._malloc(FR * 4), rp = mod._malloc(FR * 4);
const rows = [];
for (let s = 0; s < segs.length; s++) {
  const { start, marker } = segs[s];
  mod._openmpt_module_select_subsong(handle, -1);
  mod._openmpt_module_set_repeat_count(handle, 0);
  mod._openmpt_module_set_position_order_row(handle, start, 0);
  const cap = Math.floor(CAP_S * SR);
  const L = new Float32Array(cap), R = new Float32Array(cap);
  let got = 0, looped = false;
  while (got < cap) {
    const cur = mod._openmpt_module_get_current_order(handle);
    if (cur >= marker || cur < start) break;          // crossed the +++ -> done
    const n = mod._openmpt_module_read_float_stereo(handle, SR, Math.min(FR, cap - got), lp, rp);
    if (n <= 0) break;
    for (let k = 0; k < n; k++) {
      L[got + k] = mod.HEAPF32[(lp >> 2) + k];
      R[got + k] = mod.HEAPF32[(rp >> 2) + k];
    }
    got += n;
  }
  if (got >= cap) looped = true;                       // hit cap = loops internally
  const dur = got / SR;
  // WAV -> mp3
  const ba = 4, dl = got * ba, out = Buffer.alloc(44 + dl);
  out.write("RIFF", 0); out.writeUInt32LE(36 + dl, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * ba, 28);
  out.writeUInt16LE(ba, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(dl, 40);
  let o = 44;
  for (let i = 0; i < got; i++) {
    const cl = Math.max(-1, Math.min(1, L[i])), cr = Math.max(-1, Math.min(1, R[i]));
    out.writeInt16LE((cl * 32767) | 0, o); o += 2;
    out.writeInt16LE((cr * 32767) | 0, o); o += 2;
  }
  const wav = join(OUTDIR, `seg_${String(s).padStart(2, "0")}.wav`);
  const mp3 = join(OUTDIR, `seg_${String(s).padStart(2, "0")}.mp3`);
  writeFileSync(wav, out);
  const enc = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", mp3]);
  if (enc.status !== 0) throw new Error("ffmpeg failed: " + enc.stderr);
  spawnSync("rm", ["-f", wav]);
  rows.push({ s, start, marker, orders: marker - start, dur, looped });
  console.log(`seg ${String(s).padStart(2)}: orders ${start}-${marker - 1} (${marker - start}) -> ${dur.toFixed(1)}s${looped ? " [loopt]" : ""}`);
}
mod._free(lp); mod._free(rp);
mod._openmpt_module_destroy(handle);

// ── audition page (fetch+decode player; HC55 serves mp3 as octet-stream) ──────
const pad2 = (n) => String(n).padStart(2, "0");
const card = (r) => {
  const big = r.dur >= 8;
  return `<div class="card${big ? " big" : ""}">
    <div class="num">cue #${r.s}${r.looped ? ' <span class="tag">loopt</span>' : ""} <span class="dur">${r.dur.toFixed(1)}s</span></div>
    <div class="ord">orders ${r.start}–${r.marker - 1}</div>
    <button class="play" data-src="seg_${pad2(r.s)}.mp3">▶ speel cue #${r.s}</button>
  </div>`;
};
const html = `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MUSIC1.S3M — segment-audition (16 cues)</title>
<style>
  :root{--bg:#0a0f12;--fg:#cfeef2;--teal:#2ec8d8;--dim:#7fa3a8;--card:#10181c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:16px}
  h1{color:var(--teal);font-size:19px;margin:.2em 0}
  p{color:var(--dim);max-width:56ch}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:14px 0}
  .card{background:var(--card);border:1px solid #1d2a30;border-radius:10px;padding:10px}
  .card.big{border-color:var(--teal)}
  .num{font-weight:700;color:var(--teal)}
  .ord{color:var(--dim);font-size:12px;margin:2px 0 6px}
  .tag{font-size:11px;background:var(--teal);color:#04282c;border-radius:4px;padding:1px 5px;vertical-align:1px}
  .dur{color:var(--dim);font-size:13px;font-weight:400}
  button.play{width:100%;margin-top:6px;padding:10px;border:1px solid var(--teal);background:#04282c;
    color:var(--teal);border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
  button.play.playing{background:var(--teal);color:#04282c}
  #now{position:sticky;top:0;background:var(--bg);padding:6px 0;color:var(--teal);font-weight:600;z-index:2}
</style></head><body>
<h1>MUSIC1.S3M — 16 muziek-cues (per +++-segment)</h1>
<p>Elke knop = één <b>+++-segment</b> uit de order-lijst: precies de muziek die één
demo-part hoort, schoon gerenderd (niet de 55 versplinterde libopenmpt-subsongs,
niet de hele lineaire stream). Cues met <b>[loopt]</b> herhalen intern — zo klinken
ze ook tijdens hun part. Zoek het segment dat past bij <b>DOTS</b> (morphende
puntenwolk) en geef het <b>#nummer</b> door.</p>
<div id="now">Tik een knop om af te spelen…</div>
<div class="grid">${rows.map(card).join("")}</div>
<script>
  const now = document.getElementById("now");
  let ctx=null, src=null, curBtn=null, token=0; const cache=new Map();
  function stop(){ if(src){ try{src.stop();}catch(_){} src.disconnect(); src=null; }
    if(curBtn){ curBtn.classList.remove("playing"); curBtn.textContent=curBtn.dataset.label; curBtn=null; } }
  async function play(btn){
    const file=btn.dataset.src;
    if(curBtn===btn){ stop(); now.textContent="gestopt"; return; }
    stop();
    ctx=ctx||new (window.AudioContext||window.webkitAudioContext)(); await ctx.resume();
    const my=++token; btn.dataset.label=btn.dataset.label||btn.textContent;
    btn.classList.add("playing"); btn.textContent="‖ laden…"; curBtn=btn; now.textContent="laden: "+file;
    try{
      let buf=cache.get(file);
      if(!buf){ const r=await fetch(file); const ab=await r.arrayBuffer(); buf=await ctx.decodeAudioData(ab); cache.set(file,buf); }
      if(my!==token) return;
      const s=ctx.createBufferSource(); s.buffer=buf; s.loop=true; s.connect(ctx.destination); s.start(); src=s;
      btn.textContent="■ stop "+file.replace(/\\.mp3$/,"");
      now.textContent="speelt (loop): "+file+"  ("+buf.duration.toFixed(1)+"s)";
    }catch(e){ btn.classList.remove("playing"); btn.textContent=btn.dataset.label; now.textContent="FOUT bij "+file+": "+e.message; curBtn=null; }
  }
  document.querySelectorAll("button.play").forEach(b=>b.addEventListener("click",()=>play(b)));
</script>
</body></html>`;
writeFileSync(join(OUTDIR, "index.html"), html);
console.log(`\nwrote ${rows.length} segments + index.html to ${OUTDIR}`);
