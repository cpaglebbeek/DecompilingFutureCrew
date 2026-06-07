#version 300 es
// TUNNELI fragment shader — grayscale pipe met depth-shading + groene leading edge.
// Origineel palet uit TUN10.PAS:121-128: (64-x,64-x,64-x) grayscale + setrgb(255,0,63,0).
precision highp float;
in float v_ring;
in float v_depth;
out vec4 frag;

void main() {
  // Cirkel-mask binnen point-sprite.
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  if (r2 > 0.25) discard;
  float core = smoothstep(0.25, 0.0, r2);

  // Depth-shading: verre ringen dimmer.
  float depthShade = clamp(1.0 - (v_depth - 3.0) / 18.0, 0.12, 1.0);

  // Grayscale base.
  vec3 col = vec3(0.92, 0.95, 0.98);

  // Groene leading-edge voor eerste 6 ringen (origineel had `setrgb(255, 0, 63, 0)`).
  float leadMix = smoothstep(6.0, 0.0, v_ring);
  col = mix(col, vec3(0.1, 0.95, 0.2), leadMix * 0.5);

  frag = vec4(col * depthShade * core, core);
}
