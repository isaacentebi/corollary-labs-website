// One fragment shader draws every state of the site's light. Everything is frontal: fields, bands, a
// line and a disc of light on the picture plane. No ground, no perspective, no drawn outlines.
// Coordinates: p = (fragCoord - res/2) / res.y, so y runs -0.5..0.5 and x runs -aspect/2..aspect/2.
// Colours arrive as sRGB and are composited in linear light.

export const BAND_COUNT = 11;

export const vert = /* glsl */ `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const frag = /* glsl */ `
precision highp float;
#define BANDS ${BAND_COUNT}

uniform vec2 uRes;
uniform vec2 uPointer;
uniform float uSeed;

// the field: two related colours, and a broad glow radiating from the line (Niesche, Pastine)
uniform vec3 fieldTop; uniform vec3 fieldBot;
uniform vec3 fieldGlowCol; uniform float fieldGlowAmt; uniform vec2 fieldGlowC; uniform vec2 fieldGlowR;
uniform float vignette; uniform float grain;

// the line (the firm's boundary): a vertical band of light, as in Brindle's "Portal" works; its two
// sides glow in related hues. Vertical, so it can never read as a horizon.
uniform float lineX; uniform float lineTop; uniform float lineBot; uniform float lineAmt; uniform float lineW;
uniform vec3 lineColL; uniform vec3 lineColR; uniform float lineSplitY;
uniform vec3 glowUp; uniform vec3 glowDn; uniform float lineGlowAmt; uniform float lineGlowW;
uniform float bend; uniform float bendPhase;
uniform float cutX; uniform float cutGap; uniform float poolAmt; uniform float weld;

// the disc (Pashgian): the field refracted inside it; below the meniscus it fills with light
uniform vec2 lensC; uniform float lensR; uniform float lensAmt; uniform float lensMag;
uniform float menY; uniform float fillAmt; uniform vec3 fillCol; uniform float lensGlow; uniform vec3 lensTint;

// new combinations: three soft fields of light, mixed additively (screen)
uniform float mixAmt;
uniform vec4 blob0; uniform vec4 blob1; uniform vec4 blob2;
uniform vec3 blobCol0; uniform vec3 blobCol1; uniform vec3 blobCol2;

// diffusion: adjacent soft vertical fields that turn colour one after another
uniform float bandAmt; uniform float bandProg; uniform float bandAll; uniform vec3 bandBase;
uniform vec4 uBands[BANDS];      // x0, x1, arrival, how far it turns (0..1)
uniform vec3 uBandHue[BANDS];

vec3 lin(vec3 c){ return pow(max(c, 0.0), vec3(2.2)); }
vec3 srgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float superD(vec2 q, vec2 r, float n){
  vec2 a = abs(q) / max(r, vec2(1e-4));
  return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n) - 1.0;
}
vec3 capLight(vec3 c){
  float m = max(max(c.r, c.g), c.b);
  float knee = 0.72, top = 0.86;
  if (m <= knee) return c;
  return c * ((knee + (top - knee) * (1.0 - exp(-(m - knee) / (top - knee)))) / m);
}

float px;

// the line's position at height y (it can bend without tearing)
float lineAt(float y){ return lineX + bend * 0.07 * sin(y * 3.4 + bendPhase); }

vec3 field(vec2 p){
  vec3 col = mix(lin(fieldBot), lin(fieldTop), smoothstep(-0.55, 0.55, p.y));
  vec2 g = (p - fieldGlowC) / max(fieldGlowR, vec2(0.01));
  col += lin(fieldGlowCol) * fieldGlowAmt * exp(-dot(g, g));
  return col;
}

// the line at a point. lineColL is its colour above lineSplitY (what comes in), lineColR below it
// (what goes out); glowUp lights its left side, glowDn its right; cutX is the height of the cut.
vec3 lineLight(vec2 p){
  float xl = lineAt(p.y);
  float dist = p.x - xl;
  float ext = smoothstep(lineBot - 0.05, lineBot + 0.02, p.y) * (1.0 - smoothstep(lineTop - 0.02, lineTop + 0.05, p.y));
  vec3 lc = mix(lin(lineColR), lin(lineColL), smoothstep(lineSplitY - 0.06, lineSplitY + 0.06, p.y));
  float gap = 1.0;
  if (cutGap > 0.0001) gap = smoothstep(cutGap, cutGap + px * 2.0, abs(p.y - cutX));
  float core = exp(-pow(dist / (px * lineW), 2.0)) * gap;
  float w = max(lineGlowW, 1e-3);
  vec3 glow = dist < 0.0 ? lin(glowUp) * exp(dist / w) : lin(glowDn) * exp(-dist / w);
  vec3 c = (lc * lineAmt * core + glow * lineGlowAmt * mix(0.25, 1.0, gap)) * ext;
  if (poolAmt > 0.001) {
    vec2 a = vec2(dist, p.y - (cutX - cutGap)), b = vec2(dist, p.y - (cutX + cutGap));
    c += lc * poolAmt * (exp(-dot(a, a) / 0.0003) + exp(-dot(b, b) / 0.0003));
    c += lc * poolAmt * 0.25 * (exp(-dot(a, a) / 0.004) + exp(-dot(b, b) / 0.004));
  }
  if (weld > 0.001) {
    vec2 k = vec2(dist / 0.012, (p.y - cutX) / 0.03);
    c += mix(lc, vec3(1.0), 0.3) * weld * exp(-dot(k, k));
  }
  return c;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  px = 1.0 / uRes.y;
  vec3 col = field(p) + lineLight(p);

  // ---- the disc: no outline; it shows by brightness and by what it does to the field behind it
  if (lensAmt > 0.001) {
    vec2 q = p - lensC;
    float dl = length(q) / max(lensR, 1e-3);
    float e = max(0.012, 2.0 * px / max(lensR, 1e-3));
    float inside = 1.0 - smoothstep(1.0 - e, 1.0 + e, dl);
    vec2 pr = lensC + q * lensMag;
    vec3 seen = field(pr) * 1.06 + lineLight(pr) * 0.9;
    // the meniscus: the surface of the light inside, curving up toward the walls
    float xn = q.x / max(lensR, 1e-3);
    float ym = lensC.y + menY * lensR + 0.1 * lensR * xn * xn;
    float under = ym - p.y;
    float fill = smoothstep(0.0, px * 2.0, under);
    // it dissolves toward the rim (Irwin's discs), so the disc never reads as a solid ball
    float rimFade = 1.0 - smoothstep(0.55, 1.0, dl);
    seen += lin(fillCol) * fillAmt * fill * (0.18 + 0.82 * exp(-under / (lensR * 0.3))) * mix(0.35, 1.0, rimFade);
    vec3 sc = mix(lin(fillCol), vec3(1.0), 0.35);
    seen += sc * fillAmt * (exp(-pow((p.y - ym) / (px * 1.6), 2.0)) * 0.9 + exp(-abs(p.y - ym) / 0.02) * 0.12);
    // light from inside, strongest at the centre (never a ring)
    seen += lin(lensTint) * lensGlow * exp(-dl * dl * 1.6);
    col = mix(col, seen, inside * lensAmt);
    col += lin(lensTint) * lensGlow * lensAmt * 0.12 * exp(-max(dl - 1.0, 0.0) * 3.0) * (1.0 - inside);
  }

  // ---- new combinations: soft fields of light, screened together (overlaps brighter, new hue)
  if (mixAmt > 0.001) {
    for (int k = 0; k < 3; k++) {
      vec4 bl = k == 0 ? blob0 : (k == 1 ? blob1 : blob2);
      vec3 bc = lin(k == 0 ? blobCol0 : (k == 1 ? blobCol1 : blobCol2));
      float d = superD(p - bl.xy, bl.zw, 2.4);
      float a = 1.0 - smoothstep(-0.7, 0.35, d);
      col = 1.0 - (1.0 - col) * (1.0 - bc * a * mixAmt);
    }
  }

  // ---- diffusion: soft vertical fields turning colour, outward from the middle, unevenly
  if (bandAmt > 0.001) {
    vec3 bcol = vec3(0.0); float bw = 0.0;
    for (int i = 0; i < BANDS; i++) {
      vec4 b = uBands[i];
      float s = (b.y - b.x) * 0.22;
      float m = smoothstep(b.x - s, b.x + s, p.x) * (1.0 - smoothstep(b.y - s, b.y + s, p.x));
      float turn = max(clamp((bandProg - b.z) / 0.16, 0.0, 1.0) * b.w, bandAll);
      float reach = turn * 1.25 - abs(p.y) * 1.1;
      float cover = smoothstep(-0.02, 0.14, reach);
      float centre = 1.0 - abs((p.x - 0.5 * (b.x + b.y)) / max(0.5 * (b.y - b.x), 1e-3));
      vec3 c = mix(lin(bandBase), lin(uBandHue[i]), cover) * (0.8 + 0.22 * clamp(centre, 0.0, 1.0));
      bcol += c * m; bw += m;
    }
    col = mix(col, bcol / max(bw, 1e-3) + lineLight(p) * 0.6, bandAmt * clamp(bw, 0.0, 1.0));
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
