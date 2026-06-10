// bake_dots_loop.mjs — reproducibly bake the DOTS background loop.
//
// WHY this exists: DOTS rides the continuous MUSIC1.S3M song; libopenmpt splits
// that song into 55 "subsongs" at its 15 +++ skip-markers. Rendering the chosen
// DOTS subsong FROM ITS OWN START gives the section at the correct tempo (unlike
// a cold mid-song seek, which is what made the first GLENZ render too slow). The
// subsong is a self-contained musical phrase, so the loop unit is the whole
// subsong; we only bake an equal-power crossfade across the wrap so the repeat
// is click-free.
//
// HOW: drive the vendored libopenmpt WASM (public/chiptune3/libopenmpt.worklet.js)
// to render subsong N to float PCM, then (1) optionally trim an intro via START_S,
// (2) take LOOP_S seconds (default: to the end), (3) bake an XFADE equal-power
// crossfade into the seam. Output: public/audio/dots_loop.ogg (Opus).
//
// Deterministic: same MUSIC1.S3M + same args -> same dots_loop.ogg.
// Run: node tools/bake_dots_loop.mjs <subsong> [startSec] [loopSec]
//   e.g. node tools/bake_dots_loop.mjs 8           # whole subsong 8 as loop
//        node tools/bake_dots_loop.mjs 8 2.0 12.0  # skip 2s intro, 12s loop

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const S3M = join(here, "..", "public", "audio", "MUSIC1.S3M");
const WASM_JS = join(here, "..", "public", "chiptune3", "libopenmpt.worklet.js");
const OUT = join(here, "..", "public", "audio", "dots_loop.ogg");
const TMP_WAV = "/tmp/dots_loop.wav";

const SUBSONG = parseInt(process.argv[2] ?? "", 10);
if (!Number.isInteger(SUBSONG)) {
  console.error("usage: node tools/bake_dots_loop.mjs <subsong> [startSec] [loopSec]");
  process.exit(2);
}
const START_S = process.argv[3] !== undefined ? parseFloat(process.argv[3]) : 0;
const LOOP_S = process.argv[4] !== undefined ? parseFloat(process.argv[4]) : -1;

const SR = 48000;
const XFADE = 720; // 15ms equal-power crossfade baked into the seam

// ── render the chosen subsong to float PCM via libopenmpt ────────────────────
const { default: libopenmpt } = await import(WASM_JS);
const mod = await libopenmpt();
const data = readFileSync(S3M);
const ptr = mod._malloc(data.length);
mod.HEAPU8.set(data, ptr);
const handle = mod._openmpt_module_create_from_memory(ptr, data.length, 0, 0, 0);
mod._free(ptr);
if (!handle) throw new Error("openmpt: failed to load MUSIC1.S3M");

mod._openmpt_module_select_subsong(handle, SUBSONG);
mod._openmpt_module_set_position_seconds(handle, 0);
mod._openmpt_module_set_repeat_count(handle, 0);
const dur = mod._openmpt_module_get_duration_seconds(handle);
const total = Math.floor(dur * SR);

const FR = 4096;
const lp = mod._malloc(FR * 4), rp = mod._malloc(FR * 4);
const L = new Float32Array(total), R = new Float32Array(total);
let got = 0;
while (got < total) {
  const n = mod._openmpt_module_read_float_stereo(handle, SR, Math.min(FR, total - got), lp, rp);
  if (n <= 0) break;
  for (let k = 0; k < n; k++) {
    L[got + k] = mod.HEAPF32[(lp >> 2) + k];
    R[got + k] = mod.HEAPF32[(rp >> 2) + k];
  }
  got += n;
}
mod._free(lp); mod._free(rp);
mod._openmpt_module_destroy(handle);
console.log(`subsong ${SUBSONG}: rendered ${(got / SR).toFixed(2)}s @ ${SR}Hz`);

// ── cut the loop: [start, start+loop) with an equal-power crossfade seam ──────
const M = new Float32Array(got);
for (let i = 0; i < got; i++) M[i] = 0.5 * (L[i] + R[i]);
const zcAfter = (t) => {
  let i = Math.min(got - 2, Math.max(0, Math.floor(t * SR)));
  while (i < got - 1 && !(M[i] <= 0 && M[i + 1] > 0)) i++;
  return i;
};
const S = zcAfter(START_S);
let E = LOOP_S > 0 ? zcAfter(START_S + LOOP_S) : got - 1;
if (E <= S + XFADE) E = got - 1;
const len = E - S;

const Lo = new Float32Array(len), Ro = new Float32Array(len);
for (let i = 0; i < len; i++) { Lo[i] = L[S + i]; Ro[i] = R[S + i]; }
// crossfade the tail-past-E over the head so the wrap is seamless
for (let i = 0; i < XFADE && E + i < got; i++) {
  const a = (Math.PI / 2) * (i / XFADE), fo = Math.cos(a), fi = Math.sin(a);
  Lo[i] = L[E + i] * fo + L[S + i] * fi;
  Ro[i] = R[E + i] * fo + R[S + i] * fi;
}
console.log(
  `loop S=${(S / SR).toFixed(3)}s E=${(E / SR).toFixed(3)}s len=${(len / SR).toFixed(3)}s ` +
  `seam |L|=${Math.abs(Lo[len - 1] - Lo[0]).toFixed(4)} |R|=${Math.abs(Ro[len - 1] - Ro[0]).toFixed(4)}`,
);

// ── write WAV then encode to Opus-in-Ogg ─────────────────────────────────────
const ba = 4, dl = len * ba, out = Buffer.alloc(44 + dl);
out.write("RIFF", 0); out.writeUInt32LE(36 + dl, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * ba, 28);
out.writeUInt16LE(ba, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(dl, 40);
let o = 44;
for (let i = 0; i < len; i++) {
  const cl = Math.max(-1, Math.min(1, Lo[i])), cr = Math.max(-1, Math.min(1, Ro[i]));
  out.writeInt16LE((cl * 32767) | 0, o); o += 2;
  out.writeInt16LE((cr * 32767) | 0, o); o += 2;
}
writeFileSync(TMP_WAV, out);
const enc = spawnSync("ffmpeg", [
  "-v", "error", "-y", "-i", TMP_WAV,
  "-c:a", "libopus", "-b:a", "128k", "-application", "audio", OUT,
]);
if (enc.status !== 0) throw new Error("ffmpeg encode failed: " + enc.stderr);
unlinkSync(TMP_WAV);
console.log("wrote", OUT);
