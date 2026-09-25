// Colours taken from the reference works (see directions/light/REFERENCES.md).
import { hex } from './params';

export const C = {
  // gallery wall and floor (Niesche, Pashgian and Bell installation photographs: warm white wall, grey floor)
  wall: hex('#eeebe6'), wallHi: hex('#f4f2ee'), floor: hex('#d9d4cc'),
  // the volume by day (Niesche, "Schein Blossom, Spring Has No Border", 2022: orange core, pink, lilac edge)
  core: hex('#ff8a47'), ring: hex('#f6a08c'), lilac: hex('#c3a6ec'), paleRing: hex('#fbf1ea'),
  // dusk (Brindle, "Refracting Twilight", 2016: lavender sky, saturated blue band, dark water)
  duskTop: hex('#5a5cb4'), duskMid: hex('#2a3bb4'), duskBand: hex('#2f5bff'), duskLow: hex('#0a0f2c'), night: hex('#060818'),
  // dawn (Witmer, "Onekama Beach", 2022: amber over navy with a thin coral line at the join)
  dawnTop: hex('#1d2033'), dawnAmber: hex('#e09e1d'), dawnCoral: hex('#d2715e'),
  // Turrell, "Breathing Light", 2013: magenta room, red-hot inner rectangle
  magenta: hex('#d21fbf'), hot: hex('#ff2a5a'),
  // Brindle, "Light Glyph (Teal)": cyan emitted light
  cyan: hex('#58e8f2'),
  // Pashgian spheres: resin green
  resin: hex('#1fc9a0'),
  // warm light entering (Menchelli, "Parallelogram Sunrise", 2024)
  sun: hex('#ffc46b'), amber: hex('#ff9d3c'),
  white: hex('#ffffff'),
  // contact: apricot Ganzfeld
  apricot: hex('#ffb489'), peach: hex('#ffd9bf'), rose: hex('#ff7f86'),
};
