// render_full_stream.mjs — render MUSIC1.S3M as ONE continuous linear stream.
//
// WHY: MUSIC1.S3M ("UnreaL ][", Purple Motion) is one continuous song. The 15
// +++ order-markers are SKIP-markers (S3M order 0xFE) the demo parts sync on via
// DIS's frame counter (_dis_getmframe) — they are NOT separate tracks. libopenmpt
// mis-reads them as 55 "subsongs"; rendering subsong-by-subsong fragments the
// song into SFX stingers = scrambled. Selecting subsong -1 plays ALL orders
// linearly (skipping the +++ markers), which reconstructs the real, continuous,
// non-scrambled music exactly as STMIK played it in 1993.
//
// Usage:
//   node tools/render_full_stream.mjs            # whole song -> /tmp/music1_full.mp3
//   node tools/render_full_stream.mjs 90         # first 90s only
//   node tools/render_full_stream.mjs 30 120     # 30s..120s window
//
// Deterministic: same MUSIC1.S3M + same args -> same output.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const S3M = join(here, "..", "public", "audio", "MUSIC1.S3M");
const WASM_JS = join(here, "..", "public", "chiptune3", "libopenmpt.worklet.js");
const TMP_WAV = "/tmp/music1_full.wav";
const OUT_MP3 = "/tmp/music1_full.mp3";

const startSec = process.argv[2] !== undefined ? parseFloat(process.argv[2]) : 0;
const endSec = process.argv[3] !== undefined ? parseFloat(process.argv[3]) : -1;
const SR = 48000;

const { default: libopenmpt } = await import(WASM_JS);
const mod = await libopenmpt();
const data = readFileSync(S3M);
const ptr = mod._malloc(data.length);
mod.HEAPU8.set(data, ptr);
const handle = mod._openmpt_module_create_from_memory(ptr, data.length, 0, 0, 0);
mod._free(ptr);
if (!handle) throw new Error("openmpt: failed to load MUSIC1.S3M");

// -1 = play ALL subsongs linearly = the continuous original song (not a fragment)
mod._openmpt_module_select_subsong(handle, -1);
mod._openmpt_module_set_repeat_count(handle, 0);
const fullDur = mod._openmpt_module_get_duration_seconds(handle);
console.log(`MUSIC1.S3M continuous stream: ${fullDur.toFixed(1)}s total`);

const from = Math.max(0, startSec);
const to = endSec > 0 ? Math.min(endSec, fullDur) : fullDur;
if (from > 0) mod._openmpt_module_set_position_seconds(handle, from);
const want = Math.floor((to - from) * SR);

const FR = 4096;
const lp = mod._malloc(FR * 4), rp = mod._malloc(FR * 4);
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
mod._free(lp); mod._free(rp);
mod._openmpt_module_destroy(handle);
console.log(`rendered ${(got / SR).toFixed(1)}s (from ${from.toFixed(1)}s to ${to.toFixed(1)}s)`);

// WAV (16-bit stereo) then mp3
const ba = 4, dl = got * ba, out = Buffer.alloc(44 + dl);
out.write("RIFF", 0); out.writeUInt32LE(36 + dl, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * ba, 28);
out.writeUInt16LE(ba, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(dl, 40);
let o = 44;
for (let i = 0; i < got; i++) {
  const cl = Math.max(-1, Math.min(1, Lo[i])), cr = Math.max(-1, Math.min(1, Ro[i]));
  out.writeInt16LE((cl * 32767) | 0, o); o += 2;
  out.writeInt16LE((cr * 32767) | 0, o); o += 2;
}
writeFileSync(TMP_WAV, out);
const enc = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", TMP_WAV, "-c:a", "libmp3lame", "-b:a", "192k", OUT_MP3]);
if (enc.status !== 0) throw new Error("ffmpeg failed: " + enc.stderr);
unlinkSync(TMP_WAV);
console.log("wrote", OUT_MP3);
