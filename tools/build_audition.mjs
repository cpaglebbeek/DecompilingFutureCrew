// build_audition.mjs — generate the DOTS subsong audition page.
// Enumerates MUSIC1.S3M subsongs (durations) and emits /tmp/m1_verify/index.html
// with an <audio> player per subsong so the user can pick the DOTS segment by ear
// from a browser (e.g. on HC55 when not at the Mac).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const S3M = join(here, "..", "public", "audio", "MUSIC1.S3M");
const WASM_JS = join(here, "..", "public", "chiptune3", "libopenmpt.worklet.js");
const OUT = "/tmp/m1_verify/index.html";

const { default: libopenmpt } = await import(WASM_JS);
const mod = await libopenmpt();
const data = readFileSync(S3M);
const ptr = mod._malloc(data.length);
mod.HEAPU8.set(data, ptr);
const handle = mod._openmpt_module_create_from_memory(ptr, data.length, 0, 0, 0);
mod._free(ptr);
const num = mod._openmpt_module_get_num_subsongs(handle);
const rows = [];
for (let i = 0; i < num; i++) {
  mod._openmpt_module_select_subsong(handle, i);
  rows.push({ i, dur: mod._openmpt_module_get_duration_seconds(handle) });
}
mod._openmpt_module_destroy(handle);

const SUBSTANTIAL = 5; // sec — DOTS-muziek is een aangehouden passage
const pad2 = (n) => String(n).padStart(2, "0");
// Speelknop i.p.v. <audio src>: HC55 serveert .mp3 als application/octet-stream
// (+nosniff), dus <audio> weigert af te spelen. We laden net als de echte app via
// fetch()+decodeAudioData en spelen via Web Audio — werkt ongeacht server-MIME.
const card = (r) => {
  const big = r.dur >= SUBSTANTIAL;
  return `<div class="card${big ? " big" : ""}">
    <div class="num">#${r.i}${big ? ' <span class="tag">langer</span>' : ""} <span class="dur">${r.dur.toFixed(1)}s</span></div>
    <button class="play" data-src="m1_${pad2(r.i)}.mp3">▶ speel #${r.i}</button>
  </div>`;
};

const big = rows.filter((r) => r.dur >= SUBSTANTIAL);
const small = rows.filter((r) => r.dur < SUBSTANTIAL);

const html = `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DOTS subsong-audition — MUSIC1.S3M</title>
<style>
  :root{--bg:#0a0f12;--fg:#cfeef2;--teal:#2ec8d8;--dim:#7fa3a8;--card:#10181c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:16px}
  h1{color:var(--teal);font-size:19px;margin:.2em 0}
  p{color:var(--dim);max-width:54ch}
  .ref{background:#161f24;border:1px solid var(--teal);border-radius:10px;padding:12px;margin:14px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:10px 0 22px}
  .card{background:var(--card);border:1px solid #1d2a30;border-radius:10px;padding:10px}
  .card.big{border-color:var(--teal)}
  .num{font-weight:700;color:var(--teal)}
  .tag{font-size:11px;background:var(--teal);color:#04282c;border-radius:4px;padding:1px 5px;vertical-align:1px}
  .dur{color:var(--dim);font-size:13px;font-weight:400}
  h2{font-size:15px;color:var(--fg);border-bottom:1px solid #1d2a30;padding-bottom:4px;margin-top:24px}
  button.play{width:100%;margin-top:8px;padding:10px;border:1px solid var(--teal);background:#04282c;
    color:var(--teal);border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
  button.play.playing{background:var(--teal);color:#04282c}
  #now{position:sticky;top:0;background:var(--bg);padding:6px 0;color:var(--teal);font-weight:600;z-index:2}
</style></head><body>
<h1>DOTS subsong-audition — welke is de DOTS-part?</h1>
<p>MUSIC1.S3M ("UnreaL ][", Purple Motion) is één doorlopende song; libopenmpt
splitst 'm in ${num} subsongs op de +++ skip-markers. DOTS rijdt mee op het
segment dat klinkt tijdens de DOTS-part (morphende puntenwolk). Beluister hieronder
en onthoud het <b>#nummer</b> dat past. De GLENZ-referentie klinkt ánders (ander
segment) — gebruik 'm als contrast.</p>
<div id="now">Tik een knop om af te spelen…</div>
<div class="ref">
  <div class="num">GLENZ-referentie (ter contrast — NIET DOTS)</div>
  <button class="play" data-src="_glenz_ref.ogg">▶ speel GLENZ-ref</button>
</div>
<h2>Langere passages (≥${SUBSTANTIAL}s) — meest waarschijnlijke kandidaten</h2>
<div class="grid">${big.map(card).join("")}</div>
<h2>Korte fragmenten (&lt;${SUBSTANTIAL}s) — meestal overgangen/stingers</h2>
<div class="grid">${small.map(card).join("")}</div>
<p>Gevonden? Geef het #nummer door, dan bak ik <code>dots_loop.ogg</code> en koppel 'm.</p>
<script>
  const now = document.getElementById("now");
  let ctx = null, src = null, curBtn = null, token = 0;
  const cache = new Map();
  function stop(){ if(src){ try{src.stop();}catch(_){} src.disconnect(); src=null; }
    if(curBtn){ curBtn.classList.remove("playing"); curBtn.textContent = curBtn.dataset.label; curBtn=null; } }
  async function play(btn){
    const file = btn.dataset.src;
    if(curBtn === btn){ stop(); now.textContent="gestopt"; return; }
    stop();
    ctx = ctx || new (window.AudioContext||window.webkitAudioContext)();
    await ctx.resume();
    const my = ++token;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.classList.add("playing"); btn.textContent="‖ laden…"; curBtn=btn;
    now.textContent = "laden: "+file;
    try{
      let buf = cache.get(file);
      if(!buf){ const r = await fetch(file); const ab = await r.arrayBuffer();
        buf = await ctx.decodeAudioData(ab); cache.set(file, buf); }
      if(my !== token) return; // ander geluid gestart tijdens laden
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop=false;
      s.connect(ctx.destination); s.start(); src=s;
      btn.textContent="■ stop "+file.replace(/\\.(mp3|ogg)$/,"");
      now.textContent="speelt: "+file+"  ("+buf.duration.toFixed(1)+"s)";
      s.onended = ()=>{ if(src===s){ stop(); now.textContent="klaar: "+file; } };
    }catch(e){ btn.classList.remove("playing"); btn.textContent=btn.dataset.label;
      now.textContent="FOUT bij "+file+": "+e.message; curBtn=null; }
  }
  document.querySelectorAll("button.play").forEach(b=>b.addEventListener("click",()=>play(b)));
</script>
</body></html>`;
writeFileSync(OUT, html);
console.log("wrote", OUT, `(${big.length} lang, ${small.length} kort)`);
