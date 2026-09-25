// One fragment shader draws every state of the site's light.
// Coordinates: p = (fragCoord - res/2) / res.y, so y runs -0.5..0.5 and x runs -aspect/2..aspect/2.
// Colours arrive as sRGB and are composited in linear light.
// Vocabulary: a field of light at the scale of the room, and in each scene one precise luminous
// boundary against it (a razor horizon, a lens rim, a glass edge, a cut).

export const NODE_COUNT = 48;

export const vert = /* glsl */ `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const frag = /* glsl */ `
precision highp float;
#define NODES ${NODE_COUNT}

uniform vec2 uRes;
uniform vec2 uPointer;
uniform float uSeed;

// the field: sky above a horizon, ground below it
uniform vec3 wallTop; uniform vec3 wallMid; uniform vec3 groundTop; uniform vec3 groundBot;
uniform float horizon; uniform float horizonSoft;
uniform vec3 glowCol; uniform float glowAmt; uniform float glowW; uniform float glowX; uniform float glowSpread;
uniform vec3 lineCol; uniform float lineAmt; uniform float groundGlow;
uniform float roomLight; uniform float vignette; uniform float grain;

// the volume: a lens (refracts the field, inverted), painted light, or a band
uniform vec2 volC; uniform vec2 volR; uniform float volN; uniform float volSoft;
uniform float lens; uniform float lensMag; uniform float frost; uniform vec3 tint;
uniform float rimAmt; uniform vec3 rimLineCol;
uniform float paint; uniform vec3 coreCol; uniform vec3 edgeCol; uniform float coreSize;
uniform float emitCore; uniform float emitRim; uniform float ringPos; uniform float ringW; uniform vec3 rimCol;
uniform float halo; uniform vec3 haloCol;
uniform vec2 litDir; uniform float lit; uniform vec3 litCol;
uniform float beamIn; uniform float beamInW; uniform vec3 beamInCol; uniform float beamFrom;
uniform float beamOut; uniform float beamOutW; uniform vec3 beamOutCol;
uniform float warp; uniform float warpFreq; uniform float warpPhase; uniform float bend;
uniform float cutAmt; uniform float cutAngle; uniform float cutOffset; uniform float seam;

// coated planes (new combinations): x centre, y centre, half width, half height
uniform float planeAmt;
uniform vec4 plane0; uniform vec4 plane1; uniform vec4 plane2; uniform vec4 plane3;
uniform vec3 planeCol0; uniform vec3 planeCol1; uniform vec3 planeCol2; uniform vec3 planeCol3;
uniform vec3 planeRefl;

// diffusion: lights on the horizon
uniform float field; uniform float fieldProg;
uniform vec4 uNodes[NODES];   // x, y, size, arrival

vec3 lin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float superD(vec2 q, vec2 r, float n){
  vec2 a = abs(q) / max(r, vec2(1e-4));
  return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n) - 1.0;
}
vec3 capLight(vec3 c){
  float m = max(max(c.r, c.g), c.b);
  float knee = 0.78, top = 0.88;
  if (m <= knee) return c;
  return c * ((knee + (top - knee) * (1.0 - exp(-(m - knee) / (top - knee)))) / m);
}

float px;   // one pixel in p units

// the field at a point (called twice inside a lens: once for the point seen through it)
vec3 room(vec2 p){
  float y = p.y;
  float hs = max(horizonSoft, px);
  vec3 sky = mix(lin(wallMid), lin(wallTop), pow(smoothstep(horizon, 0.6, y), 0.7));
  vec3 ground = mix(lin(groundTop), lin(groundBot), smoothstep(horizon, -0.6, y));
  float above = smoothstep(horizon - hs, horizon + hs, y);
  vec3 col = mix(ground, sky, above);
  // the light rising from the horizon, strongest near glowX
  float gx = exp(-pow((p.x - glowX - uPointer.x * 0.04) / max(glowSpread, 0.05), 2.0));
  float up = max(y - horizon, 0.0);
  col += lin(glowCol) * glowAmt * exp(-up / max(glowW, 1e-3)) * above * mix(0.35, 1.0, gx);
  // its reflection on the ground, short and dim
  float dn = max(horizon - y, 0.0);
  col += lin(glowCol) * glowAmt * groundGlow * exp(-dn / max(glowW * 0.35, 1e-3)) * (1.0 - above) * mix(0.3, 1.0, gx);
  // the precise boundary: a hairline of light exactly at the horizon
  col += lin(lineCol) * lineAmt * exp(-pow((y - horizon) / (px * 1.1), 2.0)) * mix(0.55, 1.0, gx);
  return col;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  px = 1.0 / uRes.y;
  float aspect = uRes.x / uRes.y;
  vec3 col = room(p);
  float rr = length(p * vec2(0.8, 1.0));
  col *= 1.0 + roomLight * (0.35 - rr * 0.6);

  // ---- the volume: warp (homotopy), then the cut
  vec2 q0 = p - volC;
  vec2 hw = q0;
  hw.x += warp * volR.x * 0.35 * sin(q0.y / max(volR.y, 1e-3) * warpFreq + warpPhase);
  hw.y += warp * volR.y * 0.6 * sin(q0.x / max(volR.x, 1e-3) * warpFreq * 0.8 - warpPhase * 1.3);
  float xn = clamp(hw.x / max(volR.x, 1e-3), -1.25, 1.25);
  hw.y -= bend * volR.y * 2.2 * (xn * xn * xn - xn * 0.6);
  float d0 = superD(hw, volR, volN);
  vec2 cd = vec2(cos(cutAngle), sin(cutAngle));
  vec2 cn = vec2(-cd.y, cd.x);
  float sgn = smoothstep(-px, px, dot(q0, cn)) * 2.0 - 1.0;
  vec2 q = hw - cd * cutOffset * 0.5 * sgn * cutAmt;
  float d = superD(q, volR, volN);
  vec2 qn = q / max(volR, vec2(1e-4));
  float rs = d + 1.0;
  float edgePx = px / max(min(volR.x, volR.y), 1e-3);            // one pixel in normalised units
  float inside = 1.0 - smoothstep(-max(volSoft, edgePx), max(volSoft, edgePx), d);

  // lens: the field seen through it, inverted and drawn in, frosted a little
  if (lens > 0.001) {
    float r2 = dot(qn, qn);
    vec2 pr = volC - q * lensMag * (1.0 - 0.25 * r2);
    vec3 seen = room(pr) * lin(tint);
    seen = mix(seen, lin(mix(wallMid, tint, 0.5)) * 0.9, frost);
    // lit from outside on one side (inputs and outputs)
    float facing = dot(normalize(qn + 1e-5), normalize(litDir + 1e-5));
    seen += lin(litCol) * lit * smoothstep(0.2, 1.0, facing) * smoothstep(0.3, 1.0, length(qn)) * 0.8;
    col = mix(col, seen, inside * lens);
  }
  // painted light: a coloured core suspended in the body
  if (paint > 0.001) {
    vec3 painted = mix(lin(coreCol), lin(edgeCol), smoothstep(coreSize * 0.15, coreSize, rs));
    painted *= 1.0 + emitCore * 0.5 * (1.0 - smoothstep(0.0, 0.7, rs));
    col = mix(col, painted, inside * paint);
  }
  // light produced inside: first at the rim (execution), then the core (planning)
  col += lin(rimCol) * emitRim * exp(-pow((rs - ringPos) / max(ringW, 0.01), 2.0)) * inside;
  col += lin(coreCol) * emitCore * pow(1.0 - smoothstep(0.0, 1.0, rs), 1.4) * inside * (1.0 - paint * 0.6);
  // the rim: a precise hairline of light where the body meets the field (Irwin's disc rim)
  col += lin(rimLineCol) * rimAmt * exp(-pow(d / (edgePx * 1.2), 2.0));
  // spill onto the field
  float fall = max(d0 + 0.2, 0.0);
  float glowK = halo * (emitRim * 0.5 + emitCore + paint * 0.5);
  col += lin(haloCol) * glowK * (exp(-fall * 2.6) * 0.16 + exp(-fall * 0.8) * 0.06) * (1.0 - inside * 0.85);
  // the seam where it was cut and re-joined
  if (seam > 0.001) {
    float sd = abs(dot(q0, cn));
    float seamMask = exp(-pow(sd / (px * 1.4), 2.0)) * (1.0 - smoothstep(0.9, 1.0 + edgePx * 3.0, rs));
    col += lin(mix(coreCol, vec3(1.0), 0.65)) * seamMask * seam * 1.1;
  }

  // ---- light entering and leaving (the lens: warm in, cool out)
  float edgeL = volC.x - volR.x, edgeR = volC.x + volR.x;
  float fromX = max(beamFrom, -0.5 * aspect - 0.25);
  float inX = smoothstep(fromX - 0.12, fromX + 0.12, p.x) * (1.0 - smoothstep(edgeL - volR.x * 0.1, volC.x + volR.x * 0.15, p.x));
  inX *= 0.45 + 0.55 * smoothstep(fromX, edgeL, p.x);
  col += lin(beamInCol) * beamIn * exp(-pow(q0.y / max(beamInW, 1e-3), 2.0)) * inX;
  float outX = smoothstep(volC.x - volR.x * 0.15, edgeR + volR.x * 0.1, p.x) * (1.0 - 0.6 * smoothstep(edgeR, 0.5 * aspect + 0.2, p.x));
  col += lin(beamOutCol) * beamOut * exp(-pow(q0.y / max(beamOutW, 1e-3), 2.0)) * outX;

  // ---- coated planes: each passes one colour (multiplies what is behind it), returns a faint
  // other colour from its face, and catches light on one vertical edge. Overlaps multiply, so where
  // two planes cross there is a colour neither has, and never white.
  if (planeAmt > 0.001) {
    for (int k = 0; k < 4; k++) {
      vec4 pl = k == 0 ? plane0 : (k == 1 ? plane1 : (k == 2 ? plane2 : plane3));
      vec3 pc = lin(k == 0 ? planeCol0 : (k == 1 ? planeCol1 : (k == 2 ? planeCol2 : planeCol3)));
      vec2 b = abs(p - pl.xy) - pl.zw;
      float m = (1.0 - smoothstep(-px, px, b.x)) * (1.0 - smoothstep(-px, px, b.y)) * planeAmt;
      col = mix(col, col * pc * 1.15, m);
      col += lin(planeRefl) * 0.035 * m * (0.5 + 0.5 * (p.y - pl.y) / max(pl.w, 1e-3));
      float edgeX = p.x - (pl.x - pl.z);
      col += lin(vec3(1.0, 0.95, 0.88)) * 0.45 * exp(-pow(edgeX / (px * 1.1), 2.0)) * (1.0 - smoothstep(-px, px, b.y)) * planeAmt;
    }
  }

  // ---- diffusion: small, precise lights along the horizon, coming on one after another
  if (field > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < NODES; i++) {
      vec4 n = uNodes[i];
      vec2 dq = p - n.xy;
      float on = smoothstep(n.w, n.w + 0.03, fieldProg);
      float h2 = hash(vec2(float(i) * 1.9, 8.1));
      float dd = superD(dq, vec2(n.z * 1.6, n.z * 0.62), 5.0);
      float aa = px / max(n.z * 0.55, 1e-4);
      float fill = 1.0 - smoothstep(-aa, aa, dd);
      float glow = exp(-max(dd, 0.0) * 1.4) * 0.06;
      vec3 lc = mix(lin(coreCol), lin(haloCol), hash(vec2(float(i) * 7.1, 3.7)) * 0.6);
      acc += lc * on * (0.35 + 0.65 * h2) * (fill + glow);
    }
    col += acc * field;
  }

  // ---- surface
  vec2 vq = (gl_FragCoord.xy / uRes) - 0.5;
  col *= 1.0 - vignette * dot(vq, vq) * 1.6;
  col = capLight(col);
  vec3 outc = srgb(col);
  vec2 fc = gl_FragCoord.xy + uSeed;
  float n1 = hash(fc), n2 = hash(fc + 17.31), n3 = hash(fc + 41.7);
  outc += (vec3(n1, n2, n3) - 0.5) * grain * vec3(0.9, 0.95, 1.1);
  outc += (n1 + n2 - 1.0) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}
`;
