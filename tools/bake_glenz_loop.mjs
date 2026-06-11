// bake_glenz_loop.mjs — reproducibly bake the GLENZ background loop.
//
// WHY this exists: the original glenz_loop.ogg was cut from the live S3M render
// with a cold seek to order 50, which skipped the tracker's tempo state and
// played the section too slow. Re-rendering with warmup did not work either:
// MUSIC1.S3M's 15 "+++ skip" order-markers split the song into subsongs, so a
// continuous play-from-order-0 stops before order 50 and emits nothing. The
// reliable source of the section AT THE CORRECT TEMPO is the reference capture
// ref_glenz.ogg. This script cuts a seamless loop out of that capture.
//
// HOW: ref_glenz.ogg is a 54s linear passage (intro/build-up then a steady
// techno groove from ~24s). We (1) start at a positive-going zero crossing in
// the fully-steady groove (~26s), (2) find, via a 100ms cross-correlation match,
// the latest near-optimal splice point E so the audio just past E looks like the
// audio just past S (longest near-optimal loop), and (3) bake a 15ms equal-power
// crossfade into the seam so the wrap is click-free even though the groove varies
// slightly bar-to-bar. Output: public/audio/glenz_loop.ogg (Opus, ~25.8s).
//
// Deterministic: same ref_glenz.ogg in -> same glenz_loop.ogg out.
// Run: node tools/bake_glenz_loop.mjs   (needs ffmpeg with libopus on PATH)

import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 48000;
const here = dirname(fileURLToPath(import.meta.url));
const REF = join(here, "..", "public", "audio", "ref_glenz.ogg");
const OUT = join(here, "..", "public", "audio", "glenz_loop.ogg");
const TMP_WAV = "/tmp/glenz_loop_ref.wav";

const START_S = 26.0; // start search inside the fully-steady groove
const MIN_LOOP_S = 12; // minimum loop length to search for
const MATCH_WIN = 4800; // 100ms cross-correlation window
const XFADE = 720; // 15ms equal-power crossfade baked into the seam
const NEAR_OPTIMAL = 1.3; // accept splices within 1.3x of the global-min mismatch

const dec = spawnSync(
  "ffmpeg",
  ["-v", "error", "-i", REF, "-ac", "2", "-ar", String(SR), "-f", "f32le", "-"],
  { maxBuffer: 1 << 30 },
);
if (dec.status !== 0) throw new Error("ffmpeg decode failed: " + dec.stderr);
const b = dec.stdout;
const n = Math.floor(b.length / 8);
const L = new Float32Array(n), R = new Float32Array(n), M = new Float32Array(n);
for (let i = 0; i < n; i++) {
  const l = b.readFloatLE(i * 8), r = b.readFloatLE(i * 8 + 4);
  L[i] = l; R[i] = r; M[i] = 0.5 * (l + r);
}

const zcAfter = (t) => {
  let i = Math.floor(t * SR);
  while (i < n - 1 && !(M[i] <= 0 && M[i + 1] > 0)) i++;
  return i;
};

const S = zcAfter(START_S);
const eMin = S + MIN_LOOP_S * SR;
const eMax = n - MATCH_WIN - 2000;
const mismatch = (E) => {
  let x = 0;
  for (let i = 0; i < MATCH_WIN; i++)
    x += Math.abs(L[E + i] - L[S + i]) + Math.abs(R[E + i] - R[S + i]);
  return x / (MATCH_WIN * 2);
};

let best = { E: -1, mm: Infinity };
const cands = [];
for (let E = eMin; E < eMax; E++) {
  if (!(M[E] <= 0 && M[E + 1] > 0)) continue;
  const mm = mismatch(E);
  cands.push({ E, mm });
  if (mm < best.mm) best = { E, mm };
}
const thr = best.mm * NEAR_OPTIMAL;
let pick = best;
for (const c of cands) if (c.mm <= thr && c.E > pick.E) pick = c;
const E = pick.E, len = E - S;

const Lo = new Float32Array(len), Ro = new Float32Array(len);
for (let i = 0; i < len; i++) { Lo[i] = L[S + i]; Ro[i] = R[S + i]; }
for (let i = 0; i < XFADE; i++) {
  const a = (Math.PI / 2) * (i / XFADE), fo = Math.cos(a), fi = Math.sin(a);
  Lo[i] = L[E + i] * fo + L[S + i] * fi;
  Ro[i] = R[E + i] * fo + R[S + i] * fi;
}

console.log(
  `S=${(S / SR).toFixed(3)}s E=${(E / SR).toFixed(3)}s loop=${(len / SR).toFixed(3)}s ` +
  `seam |L|=${Math.abs(Lo[len - 1] - Lo[0]).toFixed(4)} |R|=${Math.abs(Ro[len - 1] - Ro[0]).toFixed(4)}`,
);

const blockAlign = 4, dataLen = len * blockAlign, out = Buffer.alloc(44 + dataLen);
out.write("RIFF", 0); out.writeUInt32LE(36 + dataLen, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * blockAlign, 28);
out.writeUInt16LE(blockAlign, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(dataLen, 40);
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
