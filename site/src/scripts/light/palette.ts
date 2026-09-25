// Each idea has its own key, taken from the works (see directions/light/ROUND4.md). Deep, saturated
// grounds; the light is the only bright thing.
import { hex } from './params';

export const C = {
  // Ando, "Meditation Blue Black" (2013): blue-black field, electric blue band (first screen)
  abyss: hex('#0b1522'), abyssLow: hex('#130f29'), bandBlue: hex('#2a6fe0'), bandViolet: hex('#4a33b8'), bandCore: hex('#c4e6ff'),
  // Ando, "Hakanai" (2013), deepened: steel blue with silver light (inputs and outputs)
  steel: hex('#13222f'), steelLow: hex('#18263a'), silverBlue: hex('#8fb3cc'), silverCore: hex('#dfeefa'),
  warmIn: hex('#e8a45c'),
  // Brindle, "Veil VI" in ember; Pashgian's resin (automation)
  emberBlack: hex('#1c0805'), emberLow: hex('#2a0c07'), ember: hex('#d9542a'), emberCore: hex('#ffc08a'), emberFill: hex('#ff8a4c'),
  // Niesche, "Atoms Encode" / "Schein Blossom"; Vieux (new combinations)
  violetDeep: hex('#150a26'), violetLow: hex('#1d0c2c'), lilac: hex('#8f6fe6'), rose: hex('#d9588f'), cyan: hex('#3f8fe0'),
  // Pashgian's smoky green, with amber light (continuous deformation)
  smoke: hex('#0d1a14'), smokeLow: hex('#142219'), smokeGlow: hex('#3f6e52'), amber: hex('#f0a84e'), amberCore: hex('#ffdca0'),
  // Evertz (diffusion): a dark neutral ground the bands turn from
  neutral: hex('#141417'), neutralBand: hex('#1e1e23'),
  // reading surfaces: Ando, "Hakanai" (pale)
  paleTop: hex('#e3e8ec'), paleBot: hex('#d5dce2'), paleGlow: hex('#f4f7f9'),
  white: hex('#ffffff'),
};
