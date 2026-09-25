// Colours pulled from the works (see directions/light/REFERENCES.md). One accent family (ember, from
// black through ember to pale gold), the silvery greys of anodised metal, and the deep dark.
import { hex } from './params';

export const C = {
  // the deep dark (Brindle's grounds; Turrell's rooms)
  night: hex('#0b0b0d'), charcoal: hex('#151619'), smoke: hex('#24262b'),
  // black into ember (Brindle, "Refracting Twilight", "Veil VI"; Witmer, "Onekama Beach")
  emberDeep: hex('#3d140a'), ember: hex('#b3441d'), hot: hex('#e3692e'), amber: hex('#eca257'), gold: hex('#f3d9ac'), goldPale: hex('#f7e8cc'),
  // silvery blue-grey metal (Ando, "Meditation Blue Black", "Hakanai"; Bell's coated glass)
  silverHi: hex('#e4e7e9'), silver: hex('#d4d9dc'), silverLow: hex('#c6ccd1'), steel: hex('#98a2ab'), steelDark: hex('#343a41'),
  coolLight: hex('#bccbd6'),
  // coated planes (Bell's cubes, Alexander's resin, Pashgian's smoky green and amber)
  planeEmber: hex('#d2683a'), planeGreen: hex('#86a08a'), planeSteel: hex('#93a6bb'), planeAmber: hex('#e9b56a'), filmViolet: hex('#b5a3d6'),
  white: hex('#ffffff'),
};
