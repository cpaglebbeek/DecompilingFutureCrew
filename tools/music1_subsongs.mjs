// music1_subsongs.mjs — drive the vendored libopenmpt WASM from Node to
// enumerate (and optionally render) the subsongs of MUSIC1.S3M.
//
// WHY: DOTS rides the continuous MUSIC1.S3M song; libopenmpt splits it into
// subsongs at the 15 "+++ skip" order-markers. We render each subsong from its
// own start (correct tempo, unlike a cold mid-song seek) so the user can verify
// by ear WHICH subsong is the DOTS passage before we bake a loop.
//
// Usage:
//   node tools/music1_subsongs.mjs            # enumerate only (count/name/seconds)
//   node tools/music1_subsongs.mjs render     # + render each subsong to /tmp/m1_NN.wav
//   node tools/music1_subsongs.mjs render 12  # render only subsong index 12
//
// Deterministic enumeration: same MUSIC1.S3M -> same listing.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const S3M = join(here, "..", "public", "audio", "MUSIC1.S3M");
const WASM_JS = join(here, "..", "public", "chiptune3", "libopenmpt.worklet.js");

const arg = process.argv[2] || "";
const onlyIdx = process.argv[3] !== undefined ? parseInt(process.argv[3], 10) : -1;
const SR = 48000;
const PREVIEW_S = 20; // seconds of each subsong to render for verification

const { default: libopenmpt } = await import(WASM_JS);
const mod = await libopenmpt();

const data = readFileSync(S3M);
const ptr = mod._malloc(data.length);
mod.HEAPU8.set(data, ptr);
const handle = mod._openmpt_module_create_from_memory(ptr, data.length, 0, 0, 0);
mod._free(ptr);
if (!handle) throw new Error("openmpt: failed to load MUSIC1.S3M");

const cstr = (p) => {
  if (!p) return "";
  let s = "", i = p;
  while (mod.HEAPU8[i]) s += String.fromCharCode(mod.HEAPU8[i++]);
  return s;
};

const num = mod._openmpt_module_get_num_subsongs(handle);
console.log(`MUSIC1.S3M — ${num} subsongs (orders=${mod._openmpt_module_get_num_orders(handle)})`);

const rows = [];
for (let i = 0; i < num; i++) {
  mod._openmpt_module_select_subsong(handle, i);
  const dur = mod._openmpt_module_get_duration_seconds(handle);
  const nptr = mod._openmpt_module_get_subsong_name(handle, i);
  const name = cstr(nptr);
  if (nptr) mod._openmpt_free_string?.(nptr);
  rows.push({ i, dur, name });
}
for (const r of rows)
  console.log(`  #${String(r.i).padStart(2)}  ${r.dur.toFixed(1).padStart(7)}s  ${r.name}`);

if (arg === "render") {
  const wavHead = (len) => {
    const ba = 4, dl = len * ba, b = Buffer.alloc(44 + dl);
    b.write("RIFF", 0); b.writeUInt32LE(36 + dl, 4); b.write("WAVE", 8);
    b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
    b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * ba, 28);
    b.writeUInt16LE(ba, 32); b.writeUInt16LE(16, 34);
    b.write("data", 36); b.writeUInt32LE(dl, 40);
    return b;
  };
  const FR = 4096;
  const lp = mod._malloc(FR * 4), rp = mod._malloc(FR * 4);
  for (const r of rows) {
    if (onlyIdx >= 0 && r.i !== onlyIdx) continue;
    mod._openmpt_module_select_subsong(handle, r.i);
    mod._openmpt_module_set_position_seconds(handle, 0);
    mod._openmpt_module_set_repeat_count(handle, 0);
    const want = Math.floor(Math.min(PREVIEW_S, r.dur || PREVIEW_S) * SR);
    const Lo = new Float32Array(want), Ro = new Float32Array(want);
    let got = 0;
    while (got < want) {
      const n = mod._openmpt_module_read_float_stereo(handle, SR, Math.min(FR, want - got), lp, rp);
      if (n <= 0) break;
      for (let k = 0; k < n; k++) {
        Lo[got + k] = mod.HEAPF32[(lp >> 2) + k];
        Ro[got + k] = mod.HEAPF32[(rp >> 2) + k];
      }
      got += n;
    }
    const out = wavHead(got);
    let o = 44;
    for (let k = 0; k < got; k++) {
      const cl = Math.max(-1, Math.min(1, Lo[k])), cr = Math.max(-1, Math.min(1, Ro[k]));
      out.writeInt16LE((cl * 32767) | 0, o); o += 2;
      out.writeInt16LE((cr * 32767) | 0, o); o += 2;
    }
    const f = `/tmp/m1_${String(r.i).padStart(2, "0")}.wav`;
    writeFileSync(f, out);
    console.log(`  rendered #${r.i} (${(got / SR).toFixed(1)}s) -> ${f}`);
  }
  mod._free(lp); mod._free(rp);
}

mod._openmpt_module_destroy(handle);
