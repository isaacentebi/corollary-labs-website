// One fragment shader draws every state of the site's light.
// Coordinates: p = (fragCoord - res/2) / res.y, so y runs -0.5..0.5 and x runs -aspect/2..aspect/2.
// Colours arrive as sRGB and are composited in linear light. Nothing has an outline: edges come from
// value and hue meeting the wall, never from a drawn line (the one exception is the cut's seam).

export const NODE_COUNT = 56;

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

uniform vec3 wallTop; uniform vec3 wallMid; uniform vec3 wallBot;
uniform float horizon; uniform float horizonSoft;
uniform vec3 horizonGlow; uniform float horizonGlowAmt; uniform float horizonGlowW;
uniform float roomLight; uniform float vignette; uniform float grain;

uniform vec2 volC; uniform vec2 volR; uniform float volN; uniform float volSoft; uniform float dissolve; uniform float pour;
uniform float paint; uniform vec3 coreCol; uniform vec3 edgeCol; uniform float coreSize; uniform float topFade;
uniform float volBody; uniform vec3 glassTint; uniform vec2 litDir; uniform float lit; uniform vec3 litCol; uniform float sheen;
uniform float emitRim; uniform vec3 rimCol; uniform float ringPos; uniform float ringW; uniform float emitCore;
uniform float halo; uniform vec3 haloCol;

uniform float beamIn; uniform float beamInW; uniform vec3 beamInCol; uniform float beamFrom;
uniform float beamOut; uniform float beamOutW; uniform vec3 beamOutCol;

uniform float mixAmt; uniform float mixW; uniform float mixShift; uniform float mixAngle; uniform float mixMid;
uniform vec3 mixL; uniform vec3 mixR; uniform vec3 mixM;

uniform float warp; uniform float warpFreq; uniform float warpPhase; uniform float bend;
uniform float cutAmt; uniform float cutAngle; uniform float cutOffset; uniform float seam;

uniform float field; uniform float fieldProg; uniform float fieldHaze;
uniform vec4 uNodes[NODES];   // x, y, size, arrival (0..1)

vec3 lin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }

// non-directional hash (Dave Hoskins), so grain has no streaks
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float superD(vec2 q, vec2 r, float n){
  vec2 a = abs(q) / max(r, vec2(1e-4));
  return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n) - 1.0;
}

// highlights compress toward ~94% without losing hue: the brightest channel is capped, the others
// keep their ratio to it, so light never clips to white
vec3 capLight(vec3 c){
  float m = max(max(c.r, c.g), c.b);
  float knee = 0.78, top = 0.88;
  if (m <= knee) return c;
  float nm = knee + (top - knee) * (1.0 - exp(-(m - knee) / (top - knee)));
  return c * (nm / m);
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float y = p.y;
  float aspect = uRes.x / uRes.y;

  // ---- the room: a vertical shift of value with no line in it
  vec3 wt = lin(wallTop), wm = lin(wallMid), wb = lin(wallBot);
  float hs = max(horizonSoft, 1e-3);
  vec3 sky = mix(wm, wt, pow(smoothstep(horizon, 0.55, y), 0.8));
  vec3 ground = mix(wm, wb, smoothstep(horizon + hs * 0.2, horizon - hs, y));
  vec3 col = mix(ground, sky, smoothstep(horizon - hs, horizon + hs, y));
  col += lin(horizonGlow) * horizonGlowAmt * exp(-pow((y - horizon) / max(horizonGlowW, 1e-3), 2.0));
  float rr = length(p * vec2(0.8, 1.0));
  col *= 1.0 + roomLight * (0.35 - rr * 0.6);

  // ---- the volume: warp (homotopy), then the cut
  vec2 q0 = p - volC;
  vec2 hw = q0;
  hw.x += warp * volR.x * 0.35 * sin(q0.y / max(volR.y, 1e-3) * warpFreq + warpPhase);
  hw.y += warp * volR.y * 0.3 * sin(q0.x / max(volR.x, 1e-3) * warpFreq * 0.8 - warpPhase * 1.3);
  float xn = clamp(hw.x / max(volR.x, 1e-3), -1.25, 1.25);
  hw.y -= bend * volR.x * 0.42 * (xn * xn * xn - xn * 0.6);
  float d0 = superD(hw, volR, volN);
  vec2 cd = vec2(cos(cutAngle), sin(cutAngle));
  vec2 cn = vec2(-cd.y, cd.x);
  float sgn = smoothstep(-0.0015, 0.0015, dot(q0, cn)) * 2.0 - 1.0;
  vec2 q = hw - cd * cutOffset * 0.5 * sgn * cutAmt;
  float d = superD(q, volR, volN);
  vec2 qn = q / max(volR, vec2(1e-4));
  float rs = d + 1.0;                              // 0 at the centre, 1 at the boundary
  float soft = max(volSoft, 0.002);
  float inside = 1.0 - smoothstep(-soft, soft, d);
  // painted light fades into the wall before the boundary (Pashgian, Irwin: the edge is not drawn)
  float veil = 1.0 - smoothstep(1.0 - max(dissolve, 0.01), 1.0 + soft, rs);
  // the top dissolves into the wall while the sides stay (Alexander's wedges; Pashgian's columns,
  // where light pours in from a white top)
  veil *= 1.0 - topFade * smoothstep(0.1, 1.0, qn.y);

  // glass body, lit from outside (inputs and outputs)
  if (volBody > 0.001) {
    vec3 body = mix(col, col * lin(glassTint) * 1.3, 0.55);
    float facing = dot(normalize(qn + 1e-5), normalize(litDir + 1e-5));
    float crescent = smoothstep(0.1, 1.0, facing) * smoothstep(0.2, 1.0, length(qn));
    body += lin(litCol) * lit * (0.2 + crescent * 0.9);
    // a thin-film sheen that shifts with the viewer (Bell's coated glass), inside the edge only
    vec2 pv = uPointer - volC;
    float ang = atan(q.y, q.x) - atan(pv.y, pv.x);
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (ang / 6.2831 * 1.5 + vec3(0.0, 0.33, 0.67)));
    body += lin(film) * sheen * 0.12 * smoothstep(0.55, 0.98, rs) * inside;
    col = mix(col, body, inside * volBody * (1.0 - smoothstep(0.9, 1.0 + soft, rs) * 0.5));
  }

  // painted light: two neighbouring hues, the core a little behind the surface (it shifts against
  // the edge as the viewer moves), brighter toward the top as if poured in from above
  if (paint > 0.001) {
    vec2 par = clamp((uPointer - volC) * 0.1, vec2(-0.04), vec2(0.04));
    float rc = clamp(length((q - par * volR / 0.2) / max(volR, vec2(1e-4))), 0.0, 1.6);
    float rsc = mix(rs, rc, 0.7);
    // a coloured core suspended inside a frosted body, not touching its edges
    vec3 painted = mix(lin(coreCol), lin(edgeCol), smoothstep(coreSize * 0.2, coreSize, rsc));
    painted *= 1.0 + pour * qn.y * 0.35;
    painted *= 1.0 + emitCore * 0.5 * (1.0 - smoothstep(0.0, 0.75, rsc));
    col = mix(col, painted, veil * paint);
  }

  // new combinations: two fields of light meet inside the volume; between them a colour neither has
  if (mixAmt > 0.001) {
    vec2 md = vec2(cos(mixAngle), sin(mixAngle));
    float s = dot(qn, md) - mixShift;
    float w = max(mixW, 0.02);
    vec3 c = mix(lin(mixL), lin(mixR), smoothstep(-w, w, s));
    c = mix(c, lin(mixM), exp(-pow(s / (w * 0.8), 2.0)) * mixMid);
    c *= 1.0 + 0.25 * (1.0 - smoothstep(0.0, 0.9, rs));
    col = mix(col, c, veil * mixAmt);
  }

  // light produced inside: first at the rim (execution), then from the core (planning)
  float ringG = exp(-pow((rs - ringPos) / max(ringW, 0.01), 2.0)) * veil;
  col += lin(rimCol) * emitRim * ringG * 0.9;
  col += lin(coreCol) * emitCore * pow(1.0 - smoothstep(0.0, 1.0, rs), 1.4) * veil * 1.2 * (1.0 - paint * 0.7);
  // spill onto the room, from the uncut shape so the glow never breaks
  float outside = max(d0, 0.0);
  float glowAmt = halo * (emitRim * 0.5 + emitCore + paint * 0.6 + mixAmt * 0.5);
  float fall = max(d0 + 0.35, 0.0);  // starts inside the body, so the spill has no edge of its own
  col += lin(haloCol) * glowAmt * (exp(-fall * 2.6) * 0.16 + exp(-fall * 0.8) * 0.07) * (1.0 - veil * max(paint, mixAmt) * 0.85);

  // the seam where the volume was cut and re-joined: the one hard line on the site
  if (seam > 0.001) {
    float sd = abs(dot(q0, cn));
    float seamMask = exp(-pow(sd / 0.0018, 2.0)) * (1.0 - smoothstep(0.85, 1.02, rs));
    col += lin(mix(coreCol, vec3(1.0), 0.6)) * seamMask * seam * 0.9;
    col += lin(haloCol) * exp(-sd / 0.025) * seam * 0.08 * inside;
  }

  // ---- light entering and leaving: bands through haze that brighten toward the volume and fade
  // inside it; every edge is a smooth ramp, so there is no step where they meet the body
  float edgeL = volC.x - volR.x, edgeR = volC.x + volR.x;
  float fromX = max(beamFrom, -0.5 * aspect - 0.25);
  float inX = smoothstep(fromX - 0.12, fromX + 0.12, p.x) * (1.0 - smoothstep(edgeL - volR.x * 0.1, volC.x + volR.x * 0.15, p.x));
  inX *= 0.45 + 0.55 * smoothstep(fromX, edgeL, p.x);
  col += lin(beamInCol) * beamIn * exp(-pow(q0.y / max(beamInW, 1e-3), 2.0)) * inX;
  float outX = smoothstep(volC.x - volR.x * 0.15, edgeR + volR.x * 0.1, p.x) * (1.0 - 0.6 * smoothstep(edgeR, 0.5 * aspect + 0.2, p.x));
  col += lin(beamOutCol) * beamOut * exp(-pow(q0.y / max(beamOutW, 1e-3), 2.0)) * outX;

  // ---- diffusion: soft, rimless lights at different depths, reached unevenly
  if (field > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < NODES; i++) {
      vec4 n = uNodes[i];
      vec2 dq = (p - n.xy) / n.z;
      float on = smoothstep(n.w, n.w + 0.08, fieldProg);
      float h1 = hash(vec2(float(i) * 7.13, 3.7));
      float h2 = hash(vec2(float(i) * 1.9, 8.1));
      float r2 = dot(dq, dq * vec2(0.8, 1.0));
      // some are bright, some barely there; far ones are hazier
      float strength = on * (0.25 + 0.75 * h2 * h2);
      vec3 lc = mix(lin(coreCol), lin(haloCol), h1 * 0.7);
      acc += lc * strength * (exp(-r2 * 1.6) * 0.9 + exp(-r2 * 0.18) * 0.12);
    }
    col += acc * field;
    col += lin(haloCol) * field * fieldHaze * fieldProg * exp(-pow((y - horizon) / 0.12, 2.0)) * 0.12;
  }

  // ---- surface: vignette, coloured grain (Montiel), dither
  vec2 vq = (gl_FragCoord.xy / uRes) - 0.5;
  col *= 1.0 - vignette * dot(vq, vq) * 1.6;
  col = capLight(col);
  vec3 outc = srgb(col);
  vec2 fc = gl_FragCoord.xy + uSeed;
  float n1 = hash(fc), n2 = hash(fc + 17.31), n3 = hash(fc + 41.7);
  outc += (vec3(n1, n2, n3) - 0.5) * grain * vec3(0.8, 0.9, 1.25);
  outc += (n1 + n2 - 1.0) / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}
`;
