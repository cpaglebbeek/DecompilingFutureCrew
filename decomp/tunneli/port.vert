#version 300 es
// TUNNELI vertex shader — berekent pipe-snake-positie op basis van (ring, point, t).
// Origineel TUN10.PAS had pcalc[radius][angle] LUT — hier real-time in shader.
layout(location=0) in vec2 a_idx;  // x=ringIdx (0..79), y=pointIdx (0..63)
uniform float u_t;
uniform mat4 u_mvp;
uniform float u_basePointSize;
out float v_ring;
out float v_depth;

const float RINGS = 80.0;
const float POINTS = 64.0;
const float TAU = 6.28318530718;

void main() {
  float r = a_idx.x;
  float p = a_idx.y;

  // Z marcheert vanaf camera (r=0) naar in de verte (r=RINGS-1).
  // We laten de snake "naar ons toe komen" via een tijd-offset op de ring-positie.
  float ringPhase = r + u_t * 8.0;
  float z = -(r * 0.45);

  // Lissajous-pad voor het centrum van elke ring — modulatie via ringPhase.
  vec2 center = vec2(
    sin(ringPhase * 0.16 + u_t * 0.7) * 1.6,
    cos(ringPhase * 0.13 + u_t * 0.5) * 1.0
  );

  // Variabele radius — sin-modulated zodat de pipe ademt.
  float radius = 0.45 + 0.18 * sin(ringPhase * 0.5 + u_t * 1.4);

  // 64 punten gelijkmatig verdeeld rond de cirkel.
  float angle = (p / POINTS) * TAU;
  vec2 ringOffset = vec2(cos(angle), sin(angle)) * radius;

  vec4 pos = vec4(center + ringOffset, z, 1.0);
  vec4 clip = u_mvp * pos;
  gl_Position = clip;
  gl_PointSize = max(1.5, u_basePointSize / clip.w);

  v_ring = r;
  v_depth = clip.w;
}
