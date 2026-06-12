// GLENZ2 v0.0.1 — placeholder
// Trouwe port van de bounce + jello-spring physics uit
//   SecondReality_source/GLENZ/MAIN.C:504-535
// Twee scale-modi:
//   mode 1 = origineel-anisotroop (yscale=xscale=120+j/30, zscale=120-j/30)
//   mode 2 = Disney vloer-squash (yscale=120-j/30, xscale=zscale=120+j/60, volumebehoud)
// Vloer = paars schaakbord (XZ-vlak, perspective).
// Pure JS, geen build, draait via file:// of via lokale http-server.

'use strict';

// =========================================================================
// 1. mat4 helpers (column-major, GL-compatible)
// =========================================================================
const M4 = {
  identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  multiply(a, b) {
    const o = new Float32Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },
  translate(x, y, z) {
    const m = M4.identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  },
  scale(x, y, z) {
    const m = new Float32Array(16);
    m[0] = x; m[5] = y; m[10] = z; m[15] = 1;
    return m;
  },
  rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = M4.identity();
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
    return m;
  },
  rotateY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = M4.identity();
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
    return m;
  },
  perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) * nf; m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
  },
  lookAt(eye, center, up) {
    const ex = eye[0], ey = eye[1], ez = eye[2];
    let zx = ex - center[0], zy = ey - center[1], zz = ez - center[2];
    const zl = Math.hypot(zx, zy, zz); zx /= zl; zy /= zl; zz /= zl;
    let xx = up[1] * zz - up[2] * zy,
        xy = up[2] * zx - up[0] * zz,
        xz = up[0] * zy - up[1] * zx;
    const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
    const yx = zy * xz - zz * xy,
          yy = zz * xx - zx * xz,
          yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[4] = xy; m[8]  = xz; m[12] = -(xx * ex + xy * ey + xz * ez);
    m[1] = yx; m[5] = yy; m[9]  = yz; m[13] = -(yx * ex + yy * ey + yz * ez);
    m[2] = zx; m[6] = zy; m[10] = zz; m[14] = -(zx * ex + zy * ey + zz * ez);
    m[15] = 1;
    return m;
  },
};

// =========================================================================
// 2. Mesh — 14-punts stellated cube uit MAIN.C:60-74 (points[])
//    8 hoeken (±1) + 6 axiale spikes op ±1.7 (170/100 ratio uit ZZZ)
//    24 driehoeken in 6 face-groepen uit MAIN.C:176-207 (epolys[])
// =========================================================================
const CUBE_VERTS = new Float32Array([
  -1, -1, -1,    // 0
   1, -1, -1,    // 1
   1,  1, -1,    // 2
  -1,  1, -1,    // 3
  -1, -1,  1,    // 4
   1, -1,  1,    // 5
   1,  1,  1,    // 6
  -1,  1,  1,    // 7
   0,  0, -1.7,  // 8  -Z spike
   0,  0,  1.7,  // 9  +Z spike
   1.7,  0,  0,  // 10 +X spike
  -1.7,  0,  0,  // 11 -X spike
   0,  1.7,  0,  // 12 +Y spike
   0, -1.7,  0,  // 13 -Y spike
]);

// 6 groepen van 4 driehoeken: piramide-faces rond elke spike
const CUBE_FACE_GROUPS = [
  { color: [1.0, 0.0, 0.0], indices: [0,1,8,  1,2,8,  2,3,8,  3,0,8] }, // -Z rood
  { color: [0.0, 1.0, 0.0], indices: [2,1,10, 1,5,10, 5,6,10, 6,2,10] }, // +X groen
  { color: [0.2, 0.4, 1.0], indices: [2,6,12, 6,7,12, 7,3,12, 3,2,12] }, // +Y blauw
  { color: [1.0, 1.0, 0.0], indices: [0,3,11, 3,7,11, 7,4,11, 4,0,11] }, // -X geel
  { color: [0.0, 1.0, 1.0], indices: [5,1,13, 1,0,13, 0,4,13, 4,5,13] }, // -Y cyaan
  { color: [1.0, 0.0, 1.0], indices: [5,4,9,  4,7,9,  7,6,9,  6,5,9] }, // +Z magenta
];

// =========================================================================
// 3. WebGL helpers
// =========================================================================
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || '?';
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}
function link(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link failed: ' + (gl.getProgramInfoLog(p) || '?'));
  }
  return p;
}

// =========================================================================
// 4. Cube renderer — additive blending, 6 draw-calls (1 per face-groep)
// =========================================================================
const CUBE_VS = `#version 300 es
precision highp float;
in vec3 a_pos;
uniform mat4 u_mvp;
void main() { gl_Position = u_mvp * vec4(a_pos, 1.0); }
`;
const CUBE_FS = `#version 300 es
precision highp float;
uniform vec3 u_color;
uniform float u_brightness;
out vec4 fragColor;
void main() {
  // brightness regelbaar per draw zodat secundaire bal dimmer overlapt
  fragColor = vec4(u_color * u_brightness, 1.0);
}
`;

function createCubeRenderer(gl) {
  const prog = link(gl, CUBE_VS, CUBE_FS);
  const uMvp        = gl.getUniformLocation(prog, 'u_mvp');
  const uColor      = gl.getUniformLocation(prog, 'u_color');
  const uBrightness = gl.getUniformLocation(prog, 'u_brightness');
  const aPos        = gl.getAttribLocation(prog, 'a_pos');

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, CUBE_VERTS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  const allIdx = [];
  const ranges = [];
  for (const g of CUBE_FACE_GROUPS) {
    ranges.push({ offset: allIdx.length * 2, count: g.indices.length, color: g.color });
    for (const i of g.indices) allIdx.push(i);
  }
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(allIdx), gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return {
    draw(mvp, brightness, colors) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uMvp, false, mvp);
      gl.uniform1f(uBrightness, brightness);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);     // additive
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);              // niet in depth schrijven, glas-look
      for (let i = 0; i < ranges.length; i++) {
        const r   = ranges[i];
        const col = colors ? colors[i % colors.length] : r.color;
        gl.uniform3fv(uColor, col);
        gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_SHORT, r.offset);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
  };
}

// =========================================================================
// 5. Floor renderer — paars schaakbord op XZ-vlak (y=0)
// =========================================================================
const FLOOR_VS = `#version 300 es
precision highp float;
in vec2 a_xz;
out vec2 v_world;
uniform mat4 u_vp;
void main() {
  v_world = a_xz;
  gl_Position = u_vp * vec4(a_xz.x, 0.0, a_xz.y, 1.0);
}
`;
const FLOOR_FS = `#version 300 es
precision highp float;
in vec2 v_world;
out vec4 fragColor;
void main() {
  // tegelgrootte 1.0 wereldeenheid
  float tile = mod(floor(v_world.x) + floor(v_world.y), 2.0);
  vec3 dark  = vec3(0.10, 0.03, 0.22);  // donker paars
  vec3 light = vec3(0.42, 0.18, 0.66);  // licht paars
  vec3 col   = mix(dark, light, tile);
  // soft edge anti-aliasing per tile
  vec2 f = fract(v_world);
  float ax = min(f.x, 1.0 - f.x);
  float ay = min(f.y, 1.0 - f.y);
  float edge = smoothstep(0.0, 0.04, min(ax, ay));
  col *= mix(0.65, 1.0, edge);
  // afstands-fade naar zwart richting horizon
  float d = length(v_world);
  float fade = 1.0 - smoothstep(5.0, 22.0, d);
  col *= fade;
  fragColor = vec4(col, 1.0);
}
`;

function createFloor(gl) {
  const prog = link(gl, FLOOR_VS, FLOOR_FS);
  const uVp  = gl.getUniformLocation(prog, 'u_vp');
  const aXz  = gl.getAttribLocation(prog, 'a_xz');

  const S = 30;
  const verts = new Float32Array([
    -S, -S,   S, -S,   S,  S,
    -S, -S,   S,  S,  -S,  S,
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aXz);
  gl.vertexAttribPointer(aXz, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  return {
    draw(vp) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.uniformMatrix4fv(uVp, false, vp);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    },
  };
}

// =========================================================================
// 6. Physics — directe port van MAIN.C:504-535 (integer-truncatie behouden)
//
//    Eenheden = MAIN.C-units. 100*ZZZ (= 5000) representeert "1 cube-half".
//    Schaal naar wereld via /5000. Y-as is in MAIN.C "down-positive"; wij
//    spiegelen bij rendering (world_y = -(ypos)/5000).
//
//    Grond in 1993: ypos > -300.  In wereld: -ypos/5000 < 0.06 → onze
//    grond-positie. Met cube half-grootte 1.7 (spike) en model-schaal 0.45,
//    sluit bal-bodem aan op vloer-y=0 via dynamic offset (zie render()).
// =========================================================================
function createPhysics() {
  const INIT = { ypos: -9000, yposa: 0, jello: 0, jelloa: 0,
                 boingm: 6, boingd: 7, bounces: 0, settleTicks: 0 };
  const s = Object.assign({}, INIT);
  const tdiv = (a, b) => Math.trunc(a / b);    // C99-truncatie

  // MAIN.C-restitutie groeit boven 1.0 vanaf bounce 2 (8/8 → 10/9 → 12/10…).
  // Origineel cut off bouncing op frame 710. Wij loopen continu, dus cap
  // het effectieve verlies op 0.85 zodat we naar nul decayen i.p.v. chaos.
  const RESTITUTION_CAP = 0.85;

  function step() {
    s.yposa += 31;
    s.ypos  += tdiv(s.yposa, 40);
    if (s.ypos > -300) {                       // collision met grond
      s.ypos  -= tdiv(s.yposa, 40);            // undo de move
      const rawRatio = s.boingm / s.boingd;
      const ratio    = Math.min(rawRatio, RESTITUTION_CAP);
      s.yposa = Math.trunc(-s.yposa * ratio);
      s.boingm += 2;
      s.boingd += 1;
      s.bounces++;
    }
    if (s.ypos > -900 && s.yposa > 0) {        // anticipatie-puff vlak boven grond
      s.jello  = tdiv((s.ypos + 900) * 5, 3);
      s.jelloa = 0;
    }
    const prev = s.jello;
    s.jello += s.jelloa;
    if ((prev < 0 && s.jello > 0) || (prev > 0 && s.jello < 0)) {
      s.jelloa = tdiv(s.jelloa * 5, 6);        // damping bij zero-crossing
    }
    s.jelloa -= tdiv(s.jello, 20);             // veer naar 0

    // settle-detectie: na 2 sec rust op de vloer → loop-reset
    if (Math.abs(s.yposa) < 60 && s.ypos > -500) {
      s.settleTicks++;
      if (s.settleTicks > 140) { Object.assign(s, INIT); }
    } else {
      s.settleTicks = 0;
    }
  }

  function reset() { Object.assign(s, INIT); }
  return {
    step, reset,
    get ypos()    { return s.ypos; },
    get yposa()   { return s.yposa; },
    get jello()   { return s.jello; },
    get bounces() { return s.bounces; },
  };
}

// =========================================================================
// 7. Main loop
// =========================================================================
(function main() {
  const canvas = document.getElementById('c');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    document.body.innerHTML =
      '<p style="color:#f44;font-family:monospace;padding:1em">WebGL2 niet beschikbaar in deze browser.</p>';
    return;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.floor(canvas.clientWidth  * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const cube  = createCubeRenderer(gl);
  const floor = createFloor(gl);
  const phys  = createPhysics();

  const state = {
    mode: 1,             // 1 = origineel, 2 = Disney
    paused: false,
    bal2: true,          // tweede (omhullende) ster-kubus aan/uit
    rx: 0, ry: 0,        // rotatie primaire bal
    tickCount: 0,        // tellen 70Hz-ticks voor orbit-sin van bal-2
    accumulator: 0,
    lastT: performance.now(),
  };

  const hud = {
    mode:  document.getElementById('mode'),
    ypos:  document.getElementById('ypos'),
    vel:   document.getElementById('vel'),
    jello: document.getElementById('jello'),
    bn:    document.getElementById('bn'),
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space')   { state.paused = !state.paused; e.preventDefault(); }
    else if (e.code === 'Digit1') state.mode = 1;
    else if (e.code === 'Digit2') state.mode = 2;
    else if (e.code === 'KeyR')   phys.reset();
    else if (e.code === 'KeyB')   state.bal2 = !state.bal2;
  });
  // tap op mobiel → reset
  canvas.addEventListener('pointerdown', () => phys.reset());

  // MAIN.C:420 — rotatie in tenths-of-degree per 70Hz-tick.
  const PHYS_HZ = 70;
  const PHYS_DT = 1000 / PHYS_HZ;
  const ROT_X_PER_STEP = 32 * 0.1 * Math.PI / 180;
  const ROT_Y_PER_STEP =  7 * 0.1 * Math.PI / 180;

  const BALL_SCALE = 0.45;    // wereld-eenheid per mesh-eenheid (bal 1)
  const SPIKE      = 1.7;     // mesh max half-extent
  // Bal-2 (omhullend) — MAIN.C pointsb is 60*QQQ/100*ZZZ = 1.188× geometrie,
  // en bscale_max/xscale = 180/120 = 1.5×. Combined ≈ 1.78. We pakken 1.80.
  const BAL2_REL    = 1.80;
  // MAIN.C-orbit: sin1024[]≈±128 op mesh ±5000 = 0.0256 in wereld-units.
  // Origineel = subtiele wobble, geen baan — eerder had ik 10× te groot.
  const BAL2_ORBIT  = 0.026;
  const BAL2_OFFSET_Z = -0.020; // +ozb bias uit MAIN.C:471 (+128 → naar -Z in onze coords)
  // Bal-2 palet — epolysb alterneert 0x4002/0x4004; wij doen 2 kleuren
  // ALTERNEREND per face-groep (rood/goud-violet contrast tov bal-1's RGB+CMY).
  const BAL2_COLORS = [
    [1.00, 0.72, 0.10],  // goud
    [0.45, 0.10, 1.00],  // violet
    [1.00, 0.72, 0.10],
    [0.45, 0.10, 1.00],
    [1.00, 0.72, 0.10],
    [0.45, 0.10, 1.00],
  ];
  const BAL1_COLORS = CUBE_FACE_GROUPS.map(g => g.color);

  function frame(now) {
    const dt = Math.min(now - state.lastT, 250);
    state.lastT = now;
    if (!state.paused) {
      state.accumulator += dt;
      while (state.accumulator >= PHYS_DT) {
        phys.step();
        state.rx += ROT_X_PER_STEP;
        state.ry += ROT_Y_PER_STEP;
        state.tickCount++;
        state.accumulator -= PHYS_DT;
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  function render() {
    gl.clearColor(0.015, 0.005, 0.030, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / Math.max(canvas.height, 1);
    const proj   = M4.perspective(58 * Math.PI / 180, aspect, 0.1, 100);
    const view   = M4.lookAt([0, 1.25, 5.5], [0, 0.6, 0], [0, 1, 0]);
    const vp     = M4.multiply(proj, view);

    floor.draw(vp);

    // wereld-Y voor bal: MAIN.C Y-down → onze Y-up; ground at world_y = 0.
    // Bij ypos=-300 (grond), bal-bodem moet vloer-y=0 raken → centrum op
    // y = SPIKE * BALL_SCALE * sy (afhankelijk van current Y-schaal).
    const j = phys.jello;
    let sx, sy, sz;
    if (state.mode === 1) {
      // 1:1 MAIN.C:526-527
      sx = (120 + j / 30) / 120;
      sy = (120 + j / 30) / 120;
      sz = (120 - j / 30) / 120;
    } else {
      // Disney-vloer: Y compressie + ECHT volumebehoud over X+Z via 1/sqrt(sy).
      // Linear /60 underconserveert 6% bij sy=0.7; sqrt klopt exact (volume = sx*sy*sz).
      sy = Math.max(0.30, (120 - j / 30) / 120);
      const horiz = 1 / Math.sqrt(sy);
      sx = horiz;
      sz = horiz;
    }

    const groundOffset = SPIKE * BALL_SCALE * sy;
    const ballY = (-phys.ypos - 300) / 5000 + groundOffset;

    // --- Bal 1 (primair, bouncing + jello) -----------------------
    // RGB+CMY palet uit MAINTRAN.C:60-69 (additive bit-OR).
    const T1 = M4.translate(0, ballY, 0);
    const R1 = M4.multiply(M4.rotateY(state.ry), M4.rotateX(state.rx));
    const S1 = M4.scale(BALL_SCALE * sx, BALL_SCALE * sy, BALL_SCALE * sz);
    const model1 = M4.multiply(T1, M4.multiply(R1, S1));
    cube.draw(M4.multiply(vp, model1), 0.55, BAL1_COLORS);

    // --- Bal 2 (omhullend, counter-rotate + sin-wobble) --------
    //   MAIN.C:621  cmatrix_yxz(3600-rx/3, 3600-ry/3, ...) → -1/3 rotatie
    //   MAIN.C:463-471 oxb/oyb/ozb = -sin1024[a*6/7/8]   → freq 6/7/8 per 1024 ticks
    //   MAIN.C:471 ozb = sin+128 (altijd positief) → bal-2 zit verder van camera
    //   MAIN.C:209-240 epolysb alterneert 0x4002/0x4004 → 2-kleur "stained-glass"
    //
    //   Volumebehoud-squash uit mode 2 niet toegepast — bal-2 bscale is
    //   uniform in origineel, dus wij doen ook isotroop.
    if (state.bal2) {
      const t  = state.tickCount;
      const k  = 2 * Math.PI / 1024;
      const ox = Math.sin(t * 6 * k) * BAL2_ORBIT;
      const oy = Math.sin(t * 7 * k) * BAL2_ORBIT;
      const oz = Math.sin(t * 8 * k) * BAL2_ORBIT + BAL2_OFFSET_Z;
      const T2 = M4.translate(ox, ballY + oy, oz);
      const R2 = M4.multiply(M4.rotateY(-state.ry / 3), M4.rotateX(-state.rx / 3));
      const s2 = BALL_SCALE * BAL2_REL;
      const S2 = M4.scale(s2, s2, s2);
      const model2 = M4.multiply(T2, M4.multiply(R2, S2));
      cube.draw(M4.multiply(vp, model2), 0.30, BAL2_COLORS);
    }

    hud.mode.textContent  = state.mode;
    hud.ypos.textContent  = phys.ypos;
    hud.vel.textContent   = phys.yposa;
    hud.jello.textContent = phys.jello;
    hud.bn.textContent    = phys.bounces;
  }

  requestAnimationFrame(frame);
})();
