// DOTS port — TypeScript reinterpretatie van de DOTS-scene.
// Zie ASM_NOTES.md voor source-vondst en mapping-tabel.

export const DOTS_COUNT = 512;

export interface DotState {
  x: number;
  y: number;
  z: number;
  yadd: number;
}

export interface DotsBuffers {
  state: DotState[];
  // instance-attribuut buffer (3 floats per dot: xyz)
  positions: Float32Array;
  // instance-attribuut buffer (1 float per dot: kleur-bucket 0..3)
  colorBuckets: Float32Array;
}

export function initDots(): DotsBuffers {
  const state: DotState[] = new Array(DOTS_COUNT);
  for (let i = 0; i < DOTS_COUNT; i++) {
    state[i] = { x: 0, y: 0, z: 0, yadd: 0 };
  }
  const positions = new Float32Array(DOTS_COUNT * 3);
  const colorBuckets = new Float32Array(DOTS_COUNT);
  for (let i = 0; i < DOTS_COUNT; i++) {
    colorBuckets[i] = (i * 7919) & 3; // pseudo-random spread over 4 buckets
  }
  return { state, positions, colorBuckets };
}

// Fase 1 — Lissajous opbouw (frame 0..500 in 1993, hier 0..1 in genormaliseerde tijd).
// Originele formule (MAIN.C:204-208): x=sin(f*11)*40, y=cos(f*13)*10-dropper, z=sin(f*17)*40
// "f" is een per-dot teller die rond-robin incrementeert. We mappen naar continue tijd door
// elke dot een eigen fase-offset te geven (f_i = t × snelheid + dot_i × periode/dotnum).
export function emitLissajous(t: number, dot: DotState, dotIndex: number): void {
  const f = t * 30 + dotIndex * 0.6;
  dot.x = Math.sin(f * 0.11) * 1.6;
  dot.y = Math.cos(f * 0.13) * 0.4;
  dot.z = Math.sin(f * 0.17) * 1.6;
  dot.yadd = 0;
}

// Fase 2 — Cirkel met opwaartse stoot + gravity (MAIN.C:209-215).
// Origineel: x=cos(f*15)*55, y=dropper (start hoog), z=sin(f*15)*55, yadd=-260 (omhoog).
// Gravity wordt elke frame opgeteld bij yadd; dot valt na initiële opwaartse impuls.
export function emitCircleWithGravity(t: number, dot: DotState, dotIndex: number): void {
  const f = t * 30 + dotIndex * 0.6;
  dot.x = Math.cos(f * 0.15) * 2.2;
  dot.y = 2.5; // start hoog
  dot.z = Math.sin(f * 0.15) * 2.2;
  dot.yadd = 2.6; // upward impulse (sign flipped — y+ = up in onze conventie)
}

// Per-frame physics step (alle dots). Gravity = constante naar beneden, bounce op floor.
export function stepDots(state: DotState[], dt: number, gravity: number, floor: number): void {
  for (let i = 0; i < state.length; i++) {
    const d = state[i]!;
    d.yadd -= gravity * dt;
    d.y += d.yadd * dt;
    if (d.y < floor) {
      d.y = floor;
      d.yadd *= -0.4; // dempende bounce
    }
  }
}

export function syncPositionBuffer(state: DotState[], out: Float32Array): void {
  for (let i = 0; i < state.length; i++) {
    const d = state[i]!;
    out[i * 3 + 0] = d.x;
    out[i * 3 + 1] = d.y;
    out[i * 3 + 2] = d.z;
  }
}
