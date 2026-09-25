// One fragment shader draws every state of the site's light.
// Coordinates: p = (fragCoord - res/2) / res.y, so y runs -0.5..0.5 and x runs -aspect/2..aspect/2.
// All colours arrive as sRGB and are composited in linear light.

export const NODE_COUNT = 56;

export const vert = /* glsl */ `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const frag = /* glsl */ `
precision highp float;
#define NODES ${NODE_COUNT}

uniform vec2 uRes;
uniform vec2 uPointer;       // in p space
uniform float uSeed;

// wall (the room): three stops and a horizon
uniform vec3 wallTop; uniform vec3 wallMid; uniform vec3 wallBot;
uniform float horizon; uniform float horizonSoft;
uniform vec3 horizonGlow; uniform float horizonGlowAmt; uniform float horizonGlowW; uniform float horizonLine;
uniform float roomLight; uniform float vignette; uniform float grain;

// the volume
uniform vec2 volC; uniform vec2 volR; uniform float volN; uniform float volSoft;
uniform float volBody; uniform vec3 volTint; uniform float paint; uniform float refl;
uniform vec2 litDir; uniform float lit; uniform vec3 litCol;
uniform float emitRim; uniform float emitCore; uniform vec3 rimCol; uniform vec3 coreCol;
uniform float halo; uniform vec3 haloCol; uniform float sheen;
uniform float ringPos; uniform float ringW; uniform float frame; uniform vec3 frameCol;

// light passing through it
uniform float beamIn; uniform float beamInW; uniform vec3 beamInCol; uniform float beamFrom;
uniform float beamOut; uniform float beamOutW; uniform vec3 beamOutCol;

// combinations: three coloured lights
uniform vec3 disc0; uniform vec3 disc1; uniform vec3 disc2;
uniform vec3 discCol0; uniform vec3 discCol1; uniform vec3 discCol2;
uniform float discAmt; uniform float discSoft;

// deformation and the cut
uniform float warp; uniform float warpFreq; uniform float warpPhase; uniform float bend;
uniform float cutAmt; uniform float cutAngle; uniform float cutOffset; uniform float seam;

// diffusion: many small volumes
uniform float field; uniform float fieldProg; uniform float fieldHaze;
uniform vec4 uNodes[NODES];   // x, y, size, arrival (0..1)

vec3 lin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// superellipse distance, normalised so the boundary is 0, inside < 0 and ~1 unit = one radius
float superD(vec2 q, vec2 r, float n){
  vec2 a = abs(q) / max(r, vec2(1e-4));
  float k = pow(pow(a.x, n) + pow(a.y, n), 1.0 / n);
  return k - 1.0;
}

// highlight shoulder: keeps additive light luminous without hard clipping
vec3 shoulder(vec3 c){
  vec3 over = max(c - 0.82, 0.0);
  return min(c, 0.82) + 0.18 * (1.0 - exp(-over / 0.18));
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float y = p.y;

  // ---- wall above the horizon, floor (or water) below it; the horizon can carry a band of light
  vec3 wt = lin(wallTop), wm = lin(wallMid), wb = lin(wallBot);
  float hs = max(horizonSoft, 1e-4);
  float above = smoothstep(horizon - hs, horizon + hs, y);
  vec3 sky = mix(wm, wt, pow(smoothstep(horizon, 0.55, y), 0.75));
  vec3 ground = mix(wb, wb * 0.78, smoothstep(horizon, -0.6, y));
  vec3 col = mix(ground, sky, above);
  float hd = abs(y - horizon);
  col += lin(horizonGlow) * horizonGlowAmt * exp(-hd / max(horizonGlowW, 1e-3));
  col += lin(horizonGlow) * horizonLine * exp(-pow(hd / 0.0018, 2.0));
  // the room brightens toward its centre, as in a lit volume of haze
  float rr = length(p * vec2(0.8, 1.0));
  col *= 1.0 + roomLight * (0.35 - rr * 0.6);

  // a gloss floor: the volume's light reflected below the horizon (Brindle's installation floors),
  // and the coloured, not grey, pool of light it throws down (Pashgian's tinted shadows)
  if (refl > 0.001 && y < horizon) {
    float depth = horizon - y;
    vec2 pm = vec2(p.x, 2.0 * horizon - y) - volC;
    pm.x *= 1.0 + depth * 1.5;
    float dm = superD(pm, volR, volN);
    float radm = clamp(length(pm / max(volR, vec2(1e-4))), 0.0, 1.5);
    vec3 pc = mix(lin(coreCol), lin(volTint), smoothstep(0.12, 0.98, radm));
    pc = mix(pc, lin(rimCol), exp(-pow((radm - ringPos) / max(ringW, 0.01), 2.0)) * 0.85);
    float fade = exp(-depth * 9.0);
    col = mix(col, pc, (1.0 - smoothstep(-0.15, 0.25, dm)) * refl * 0.5 * fade);
    vec2 pool = vec2((p.x - volC.x) / (volR.x * 1.6), depth / 0.05);
    col += lin(haloCol) * refl * 0.18 * exp(-dot(pool, pool)) * paint;
  }

  // ---- light entering and leaving the volume (soft, atmospheric)
  vec2 q0 = p - volC;
  float bandIn = exp(-pow(q0.y / max(beamInW, 1e-3), 2.0));
  float leftOf = smoothstep(volR.x * 0.35, -volR.x * 1.15, q0.x);
  float reachIn = smoothstep(max(beamFrom, -0.5 * uRes.x / uRes.y) - 0.1, volC.x - volR.x, p.x);
  col += lin(beamInCol) * beamIn * bandIn * leftOf * mix(0.35 + 0.65 * reachIn, reachIn, step(-0.45, beamFrom));
  float bandOut = exp(-pow(q0.y / max(beamOutW, 1e-3), 2.0));
  float rightOf = smoothstep(-volR.x * 0.35, volR.x * 1.15, q0.x);
  float fadeOut = 1.0 - smoothstep(volR.x, 0.5 * uRes.x / uRes.y + 0.2, q0.x) * 0.55;
  col += lin(beamOutCol) * beamOut * bandOut * rightOf * fadeOut;

  // ---- the volume, deformed continuously, possibly cut
  vec2 q = q0;
  // homotopy: a smooth warp and an S-shaped bend, never tearing
  vec2 hw = q;
  hw.x += warp * volR.x * 0.35 * sin(q.y / max(volR.y, 1e-3) * warpFreq + warpPhase);
  hw.y += warp * volR.y * 0.3 * sin(q.x / max(volR.x, 1e-3) * warpFreq * 0.8 - warpPhase * 1.3);
  float xn = hw.x / max(volR.x, 1e-3);
  hw.y -= bend * volR.x * 0.42 * (xn * xn * xn - xn * 0.6);
  float d0 = superD(hw, volR, volN);   // the shape before any cut: its glow never breaks
  // cut: points on one side of a line slide along it (only the body is cut)
  vec2 cd = vec2(cos(cutAngle), sin(cutAngle));
  vec2 cn = vec2(-cd.y, cd.x);
  float side = dot(q0, cn);
  float sgn = smoothstep(-0.0015, 0.0015, side) * 2.0 - 1.0;
  q = hw - cd * cutOffset * 0.5 * sgn * cutAmt;

  float d = superD(q, volR, volN);
  float soft = max(volSoft, 0.002);
  float inside = 1.0 - smoothstep(-soft, soft, d);
  vec2 qn = q / max(volR, vec2(1e-4));
  float rad = clamp(length(qn), 0.0, 1.5);

  // body: translucent, tinting what is behind it
  vec3 body = mix(col, col * lin(volTint) * 1.35, 0.55);
  // lit from outside: a crescent on the side facing the light
  float facing = dot(normalize(qn + 1e-5), normalize(litDir + 1e-5));
  float crescent = smoothstep(0.1, 1.0, facing) * smoothstep(0.15, 1.0, rad);
  body += lin(litCol) * lit * (0.25 + crescent * 1.1);
  col = mix(col, body, inside * volBody);

  // painted light (Niesche): core colour easing to the edge colour, with a pale ring where they cross
  // (Pastine: the crossing of two colours carries a neutral lighter than both)
  float ringG = exp(-pow((rad - ringPos) / max(ringW, 0.01), 2.0));
  vec3 painted = mix(lin(coreCol), lin(volTint), smoothstep(0.12, 0.98, rad));
  painted = mix(painted, lin(rimCol), ringG * 0.85);
  painted *= 1.0 + emitCore * 0.45 * (1.0 - smoothstep(0.0, 0.7, rad));
  col = mix(col, painted, inside * paint);

  // light produced inside: first at the rim, then from the core
  float rimZone = ringG * inside;
  float coreZone = pow(1.0 - smoothstep(0.0, 1.05, rad), 1.6) * inside;
  float addK = 1.0 - paint * 0.85;
  col += lin(rimCol) * emitRim * rimZone * 1.2 * addK;
  col += lin(coreCol) * emitCore * (coreZone * 1.6 + inside * 0.35) * addK;
  // a hairline frame at the boundary (Niesche's brass edge)
  col = mix(col, lin(frameCol), frame * exp(-pow(d / 0.012, 2.0)) * 0.8);
  // spill onto the room
  float outside = max(d0, 0.0);
  float glowAmt = halo * (emitRim * 0.6 + emitCore + lit * 0.25);
  col += lin(haloCol) * glowAmt * exp(-outside * 3.2) * (1.0 - inside) * 0.55;
  col += lin(haloCol) * glowAmt * exp(-outside * 0.9) * 0.12;

  // thin-film sheen at the rim that shifts with the viewer (pointer)
  if (sheen > 0.001) {
    vec2 pv = uPointer - volC;
    float ang = atan(q.y, q.x) - atan(pv.y, pv.x);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (ang / 6.2831 * 1.5 + vec3(0.0, 0.33, 0.67)));
    float rimLine = smoothstep(-0.18, -0.02, d) * (1.0 - smoothstep(-0.02, soft + 0.01, d));
    col += lin(film) * rimLine * sheen * 0.35;
  }

  // the seam where the volume was cut and re-joined
  if (cutAmt > 0.001 || seam > 0.001) {
    float sd = abs(dot(q0, cn));
    float along = abs(dot(q0, cd));
    float seamMask = exp(-pow(sd / 0.0022, 2.0)) * (1.0 - smoothstep(-soft * 2.0, soft * 2.0, d));
    col += vec3(1.0, 0.97, 0.93) * seamMask * seam * 1.4;
    col += lin(haloCol) * exp(-sd / 0.03) * seam * 0.10 * inside;
  }

  // ---- combinations: three translucent panes (Zimmermann's resin layers, Bell's coated glass).
  // Each adds its colour; where two overlap a colour appears that neither has; each rim is a lighter
  // hairline, and where two rims cross the point is brightest.
  if (discAmt > 0.001) {
    float s = max(discSoft, 0.003);
    vec3 light = vec3(0.0);
    float fsum = 0.0, fprod = 1.0, fpair = 0.0;
    for (int k = 0; k < 3; k++) {
      vec3 dsc = k == 0 ? disc0 : (k == 1 ? disc1 : disc2);
      vec3 dcol = lin(k == 0 ? discCol0 : (k == 1 ? discCol1 : discCol2));
      float dd = superD(p - dsc.xy, vec2(dsc.z * 0.92, dsc.z * 1.08), 3.0);
      float fill = 1.0 - smoothstep(-s, s, dd);
      float grad = mix(1.0, 0.55, smoothstep(-1.0, 0.0, dd));   // brighter toward its own core
      float rim = exp(-pow(dd / 0.018, 2.0));
      light += dcol * (fill * grad * 0.7 + rim * 0.5);
      light += dcol * exp(-max(dd, 0.0) * 5.0) * 0.06;
      fpair += fill * fsum;
      fsum += fill;
      fprod *= fill;
    }
    // where panes overlap, a pale light that none of them carries (Pastine's lighter neutral crossing)
    light += vec3(1.0, 0.93, 0.86) * (fpair * 0.22 + fprod * 0.35);
    col += light * discAmt;
  }

  // ---- diffusion: small volumes across the plain, lighting unevenly
  if (field > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < NODES; i++) {
      vec4 n = uNodes[i];
      vec2 dq = p - n.xy;
      float on = smoothstep(n.w, n.w + 0.07, fieldProg);
      float dn2 = superD(dq, vec2(n.z * 1.1, n.z), 3.4);
      float b = 1.0 - smoothstep(-0.08, 0.08, dn2);
      float g = exp(-max(dn2, 0.0) * 1.6);
      float r2 = length(dq / vec2(n.z * 1.1, n.z));
      // each firm takes the light differently: its own strength and a slight shift of hue
      float hv = hash(vec2(float(i) * 7.13, 3.7));
      vec3 core_ = mix(lin(coreCol), lin(haloCol), hv * 0.6);
      vec3 lit_ = mix(core_, lin(rimCol), smoothstep(0.1, 1.0, r2)) * (0.55 + 0.6 * hash(vec2(float(i) * 1.9, 8.1)));
      // unlit: dark glass with a faint rim; lit: the painted light and its spill
      acc += vec3(0.01, 0.013, 0.03) * b * (1.0 - on) + lin(rimCol) * 0.018 * exp(-pow(dn2 / 0.06, 2.0)) * (1.0 - on);
      acc += lit_ * on * (b * 1.1 + g * 0.18);
      // reflection in the wet ground below each light
      vec2 rq = vec2(dq.x / (n.z * 1.1), (p.y - (n.y - n.z * 2.2)) / (n.z * 2.2));
      float rf = exp(-rq.x * rq.x * 2.2) * exp(-rq.y * rq.y * 1.5) * step(p.y, n.y - n.z);
      acc += lit_ * on * 0.12 * rf;
    }
    col += acc * field;
    col += lin(haloCol) * field * fieldHaze * fieldProg * exp(-abs(y - horizon) / 0.1) * 0.2;
  }

  // ---- surface: vignette, coloured grain (Montiel), dither
  vec2 vq = (gl_FragCoord.xy / uRes) - 0.5;
  col *= 1.0 - vignette * dot(vq, vq) * 1.6;
  col = shoulder(col);
  vec3 outc = srgb(col);
  float n1 = hash(gl_FragCoord.xy + uSeed);
  float n2 = hash(gl_FragCoord.yx * 1.37 + uSeed * 1.7);
  float n3 = hash(gl_FragCoord.xy * 0.73 + uSeed * 3.1);
  outc += (vec3(n1, n2, n3) - 0.5) * grain * vec3(0.8, 0.9, 1.25);
  outc += (n1 + n2 - 1.0) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}
`;
