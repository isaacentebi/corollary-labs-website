// Colours taken from the reference works (see directions/light/REFERENCES.md).
import { hex } from './params';

export const C = {
  // pale gallery wall for reading pages (Niesche, Pashgian and Bell installation photographs)
  wall: hex('#eeebe6'), wallHi: hex('#f3f1ed'), wallLow: hex('#e4e0da'),
  // the lit room of the first screen: a warm grey wall, lit mainly by the object in it
  // (Pashgian's columns shown in dim rooms; Turrell's walls carrying the field's hue at low value)
  roomHi: hex('#dcd8d3'), room: hex('#d2cdc6'), roomLow: hex('#c4beb6'),
  // the object: two neighbouring hues, apricot core easing to coral (Pastine, "Blue (Orange)",
  // hues edging into each other; Alexander, "Green Wedge", colour deepening with thickness)
  apricot: hex('#ffbf8a'), coral: hex('#f48a7a'), spill: hex('#ffb892'),
  // the frosted body the light is suspended in: a little lighter than the room around it
  frostDay: hex('#ece6df'), frostDusk: hex('#8d8ac8'),
  // ignition: amber at the rim first, then the core (Menchelli, "Parallelogram (Sunrise)", 2024)
  amber: hex('#ffab5c'), sun: hex('#ffc97a'),
  // dusk, muted (Turrell, "Twilight Epiphany": lilac-grey canopy, deep blue sky; Ando, "Meditation Blue Black")
  duskTop: hex('#5c5a98'), duskMid: hex('#2c3790'), duskLow: hex('#0e1330'), duskGlow: hex('#4a64d6'),
  night: hex('#07091a'), nightMid: hex('#1a2052'), nightLow: hex('#0a0c1c'),
  // glass lit from outside, and the cool light that leaves it
  glass: hex('#a3a9dc'), cool: hex('#8fd3ee'),
  // new combinations: rose and blue fields; where they meet, a violet neither has
  rose: hex('#ff7d9c'), blue: hex('#5f7cf2'), violet: hex('#b98cf5'),
  // dawn (Witmer, "Onekama Beach", 2022: amber over navy)
  dawnSky: hex('#4d56a8'), dawnPale: hex('#efe6dc'), dawnAmber: hex('#e09e1d'), dawnLow: hex('#1d2033'),
  // contact: the whole room is the light (Turrell, "Breathing Light": hue turns, value barely moves)
  gPeach: hex('#ffd6c2'), gApricot: hex('#ffbfa3'), gRose: hex('#ffabb6'),
  // research: pale silver (Brindle, "Distant Light")
  silver: hex('#e9ebf0'), silverLow: hex('#e1e4ea'), faintBlue: hex('#5a78e6'),
  white: hex('#ffffff'),
};
