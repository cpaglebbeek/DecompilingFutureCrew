// Decode EVERY subsong of MUSIC1.S3M (and MUSIC0) offline, write each to wav.
// Goal: find which subsong is the GLENZ techno track by later spectral compare
// against the reference YouTube audio. Runs headless via the proven chiptune3
// decodeAll path. Usage: node _glenz_subsong_match.mjs [baseURL] [MODULE]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const EXEC = "/Users/christian/Library/Caches/ms-playwright/chromium-1223/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const base = process.argv[2] || "http://localhost:5173/DecompilingFutureCrew/";
const MODULE = process.argv[3] || "MUSIC1.S3M";

function f32ToWav(left, right, sr) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    let l = Math.max(-1, Math.min(1, left[i])), r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE((l * 32767) | 0, o); o += 2;
    buf.writeInt16LE((r * 32767) | 0, o); o += 2;
  }
  return buf;
}

const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ["--ignore-certificate-errors"] });
const page = await browser.newPage();
page.on("console", m => { const t = m.text(); if (t.startsWith("PROBE")) console.log(t); });

await page.goto(base + "glenz/index.html", { waitUntil: "domcontentloaded" });

const meta = await page.evaluate(async ({ base, MODULE }) => {
  const ctx = new AudioContext({ sampleRate: 44100 }); await ctx.resume();
  const mod = await import(base + "chiptune3/chiptune3.js");
  const player = new mod.ChiptuneJsPlayer({ context: ctx, repeatCount: 0 });
  await new Promise((res) => player.onInitialized(() => res()));
  const ab = await (await fetch(base + "audio/" + MODULE)).arrayBuffer();
  window.__AB = ab;
  player.onError((e) => console.log("PROBE ERR " + JSON.stringify(e)));
  const m = await new Promise((res) => { player.onMetadata((mm) => res(mm)); player.play(ab.slice(0)); });
  player.stop();
  window.__player = player;
  return { numSubsongs: (m.song && m.song.numSubsongs) || 1, dur: m.dur, title: m.title,
           songs: m.songs || [],
           totalOrders: m.totalOrders };
}, { base, MODULE });

console.log("PROBE META", JSON.stringify(meta));
const N = Math.max(1, meta.numSubsongs);

for (let i = 0; i < N; i++) {
  const r = await page.evaluate(async (i) => {
    const player = window.__player, ab = window.__AB;
    const data = await new Promise((res, rej) => {
      const tm = setTimeout(() => rej(new Error("timeout")), 90000);
      player.onFullAudioData((d) => { clearTimeout(tm); res(d); });
      player.decodeAll({ buf: ab.slice(0), subsong: i });
    });
    const left = data.data[0], right = data.data[1], sr = 44100;
    // transfer as plain arrays in chunks via returning typed-array-likes
    let peak = 0, sumsq = 0;
    for (let k = 0; k < left.length; k++) { const a = Math.max(Math.abs(left[k]), Math.abs(right[k])); if (a > peak) peak = a; sumsq += left[k] * left[k]; }
    const rms = Math.sqrt(sumsq / Math.max(1, left.length));
    window.__pcm = { left: Array.from(left), right: Array.from(right) };
    return { len: left.length, dur: +(left.length / sr).toFixed(2), peak: +peak.toFixed(3), rms: +rms.toFixed(4) };
  }, i);
  const pcm = await page.evaluate(() => window.__pcm);
  const wav = f32ToWav(Float32Array.from(pcm.left), Float32Array.from(pcm.right), 44100);
  const tag = MODULE.replace(".S3M", "").toLowerCase();
  writeFileSync(`/tmp/glenz_ref/${tag}_ss${i}.wav`, wav);
  console.log("PROBE SS", i, JSON.stringify(r), "-> wav");
}

await browser.close();
console.log("PROBE DONE");
