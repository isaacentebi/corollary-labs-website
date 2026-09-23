# DESIGN.md — Corollary Labs

> Our spec, produced by **transforming** measured values from two references.
> Structural tokens (grid, scale ratios, spacing, measure, easing, durations, staggers) are kept;
> identity tokens (colour, fonts, decorative values, copy, imagery) are replaced.
> Evidence paths are relative to `clone-workspace/`. Every kept value was read from the live CSSOM
> (`getComputedStyle` / authored rules) or from the live JS bundle, never from a screenshot.

- **Ref A — site system:** Locomotive® — https://locomotive.ca/en (Awwwards SOTM Mar 2023 + Developer Award)
- **Ref B — essay template:** The Superdark Factory — https://superdark.antikythera.org/ (Antikythera Journal, Agentworld)

---

## 0. Visual theme

Paper-white, ink-black, condensed display serif set enormous and light, tight grotesk for
everything functional, a mono marginalia layer. Dense 12-column Swiss grid with hairline rules,
wide margins of silence between sections. Motion is textual: letters shuffle, resolve, diffuse.
One accent — phosphor green — exists only on the moving adoption front. Corners are square on the
landing page and softly rounded (0.375rem) on essay panels, as in the references. No shadows,
no gradients, no glow.

---

## 1. Colour

| Token | Value | Ref A value | Ref B value | Evidence |
|---|---|---|---|---|
| `--paper` | `#FAFAF8` | `--color-bg: #FFFFFF` | `main` bg `rgb(238,238,238)` | `locomotive/02-extraction/css-variables.json` · `superdark/…/chapter-i-darkness--desktop.computed.json` (`main#top`) |
| `--ink` | `#0D0D0C` | `--color: #000000` | text `rgb(17,17,17)` | same |
| `--ink-2` | `#56564F` | — (single tone) | `--darkgray: #444` | superdark css vars |
| `--ink-3` | `#8E8E86` | — | `--gray: #66666666` | superdark css vars |
| `--rule` | `#D9D9D3` | rules = `--color` | aside border `--borderColor` | CSSOM |
| `--paper-2` | `#F2F2EF` | — | note marker bg `rgb(250,250,250)` | superdark computed (`tertiary_aside_marker`) |
| `--signal` | `#00A15C` | red `#DA382E`, blue `#312DFB` (themes) | Agentworld blue | replaced (identity) |
| selection | ink bg / paper text | — | annotation chip ink/paper | superdark `.annotation` |

Gradients: none (both references have none in content).

## 2. Typography

### 2a. Families

| Role | Ours | Ref A | Ref B |
|---|---|---|---|
| display | `"Instrument Serif", "Times New Roman", serif` | `LocomotiveNew` (PP Locomotive New Light) | `ReplicaHeavy` (titles) |
| sans | `"Inter Tight Variable", "Helvetica Neue", Arial, sans-serif` | `HelveticaNowDisplay` | `ll-replica`, `ESAllianz-Book` |
| mono | `"Space Mono", ui-monospace, monospace` | — | — |

### 2b. Landing scale (Ref A, kept)

Root size steps (html `font-size`): 15px (<1600) · 17px (1600–1999) · 19px (2000–2399) · 21px (≥2400).

| Token | Desktop (≥1025) | ≤1024 | ≤699 | line-height | family | Evidence |
|---|---|---|---|---|---|---|
| `--fs-huge` | 7.6388888889vw | 7.6388888889vw | 40px | 1 | serif | `.c-featured-links_title` 146.667px @1920 |
| `--fs-h1` | 4.6666666667rem | 3.3333333333rem | 2.4rem | 1.1 | serif | `h1.c-heading.-h1` 79.33px/87.27 @1920 |
| `--fs-medium` | 1.7333333333rem | 1.6rem | 18px | 1.2 | sans | `.c-header` 29.47px/35.36 @1920 |
| `--fs-h3` | 1.4666666667rem | ″ | ″ | 1.2 | sans | CSSOM `.c-heading.-h3` |
| `--fs-h5` | 1.2rem | ″ | ″ | 1.2 | mono (labels) | CSSOM `.c-heading.-h5` |
| `--fs-h6` | 1.0666666667rem | ″ | ″ | 1.2 | mono | CSSOM `.c-heading.-h6` |
| base | 1rem | ″ | ″ | 1.2 | sans | `--font-size` |

Tracking: `normal` everywhere in both refs (measured). Ours keeps `normal` for serif; sans display
uses `-0.01em` (Inter Tight is already tight; see deltas). Weight: 400 everywhere (Ref A measured).

### 2c. Essay scale (Ref B, kept)

Stepped base `--e-fs`: 12px · 13 (≥1000) · 14 (≥1200) · 15 (≥1450) · 16 (≥1650) · 18 (≥1850) · 20 (≥2050) · 22 (≥2250) · 24 (≥2450).

| Token | Ratio | @1920 (18px) | line-height | weight | Evidence |
|---|---|---|---|---|---|
| `--e-small` | ×0.857 | 15.43px | 1.28 | 400 | `--smallFontSize` |
| `--e-fs` (notes, UI) | ×1 | 18px | 1.28 | 400 | `aside#tertiary_aside_*` 18px/23.04 |
| `--e-med` (body) | ×1.43 | 25.74px | **1.36** (ref 1.25 — delta) | 400 | `p.mb-[1.28em]` 25.74/32.175 |
| `--e-h3` | ×1.86 | 33.48px | 1.2 | 700 | `--h3FontSize` |
| `--e-h2` (section) | ×2.42 | 43.56px | 1.15 | 700 | `h2#introduction` 43.56/50.09 |
| `--e-large` (pull quote) | ×3.14 | 56.52px | 1.1 | 400 serif (ref 700 sans) | `h1#chapter-i-darkness` 56.52/62.17; `.richtext-centered blockquote` |
| `--e-xl` (essay title) | ×5.2 | 93.6px | 1.0 | 400 serif | `--xlFontSize` |

Paragraph spacing `1.28em` (kept, `p.mb-[1.28em]`); heading gap `calc(var(--e-med)*1.28)`.
Mobile/tablet (<1000): body `17.16px/…`, h2 `29.04px`, title `37.68px` measured — reproduced by the
12px step × ratios.

## 3. Grid, layout, measure

| Token | Value | Evidence |
|---|---|---|
| `--grid-columns` | 12 · 8 (≤1024) · 4 (≤699) | Locomotive `:root` + media |
| `--grid-gutter` | 20px · 10px (≤699) | Locomotive `:root` |
| `--grid-margin` | 2.6666666667rem · 1.3333333333rem (≤1024) | Locomotive `:root` |
| `--header-height` | 4rem | Locomotive `:root` |
| header grid | logo 1/3 · glyph 3/4 · nav 7/11 · cta 11/13 | `.c-header_*` grid-area |
| summary block | 4 cols wide, visual 5:7, labels at `top .5em`, `3.333rem`, `13.333rem` | `.c-home-summary_*` |
| featured row | `padding .666667rem 0`, `border-top var(--border)`, centered, line-height 1, inner span `translateY(.1em)` | `.c-featured-links_*` |
| footer | margin-top 10.6667rem; menu main 1/7 (6 cols) · social 7/10 · external 10/13 | `.c-footer_*` |
| essay text column | grid-column 4 / 10 of 12 (6 cols) | `.richtext-centered { grid-column: 4 / 10 }` |
| essay sidenote column | `width: calc(25% - 1.6875rem)`, right 0 | `.format-centered .richtext-tertiary` |
| essay measure | 913px @1920 ≈ 62–66 characters at `--e-med` | `div.richtext-centered` rect |
| essay page padding | `27px` @1920 (1.5 × `--e-fs`) | `header.block-heading` padding |
| essay rail | fixed, left, width = one quarter column minus gap (`--col1`) | frames `sc1/*` + `--col1` var |

Spacing scale (Ref A, fluid: `clamp(mobile·(1/15)rem, desktop/14.4·1vw, desktop·(1/15)rem)`):

| step | desktop | mobile |
|---|---|---|
| micro | 14 | 8 |
| tiny | 20 | 20 |
| small | 30 | 30 |
| medium | 40 | 40 |
| large | 80 | 52 |
| big | 150 | 80 |
| huge | 200 | 100 |
| enormous | 250 | 140 |

Rules: Ref A `--border-size` 2px (≥1025) / 1px. Ours 1px everywhere (delta).
Radius: landing 0; essay panels `0.375rem`; chips `0.125rem` (Ref B `.annotation`).

## 4. Motion

### 4a. Easing

| Token | Value | Source |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.215, 0.61, 0.355, 1)` (easeOutCubic) | Ref A — most frequent CSS easing (header, buttons, image fades) |
| `--ease-expo` | `cubic-bezier(0.23, 1, 0.32, 1)` (easeOutQuint) | **both refs**: A `--transition-easing`; B aside reveal, catch-up |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` (easeInOutQuart) | Ref B aside positioned / catch-up restore |
| GSAP | `power4.out`, `power2.inOut`, `power1.inOut` | Ref A bundle (`ease:"power4.out"` preview open, 12× `power1.inOut`) |
| Lenis | `lerp: 0.1`, `easing: t => min(1, 1.001 − 2^(−10t))` | Ref A bundle (Lenis defaults instantiated) |

### 4b. Durations

`0.1s` (B hover) · `0.15s` · `0.18s` (B aside in) · `0.2s` (A header, B page fade) · `0.25s` (A page transition) ·
`0.28s` (B catch-up) · `0.3s` (A default) · `0.45s` (A row hover enter) · `0.6s` (A image fade) · `0.9s` (A long fade).

### 4c. Text motion vocabulary

| Pattern | Parameters (extracted) | Where we use it |
|---|---|---|
| **Preloader scramble** (A `ioe()`) | per char: show at `line·0.25 + i·0.01` s; 5 random glyph swaps × 16 ms; hide at `+0.5 s` (+1 s on last line); logo chars fade with stagger 0.05 at 0.25 s; `sessionStorage` quick mode on revisit (stagger 0.025) | first-visit intro |
| **In-word shuffle** (A `ld/lg`) | shuffles letters within each word, step every 1/16 s; page leave: 16 steps/s for 0.25 s; enter: 4 steps across 0.25 s, then restore | page transitions, link/row hover, wordmark hover |
| **Scramble-in** (A Lisa dialog) | chars appear with ink bg flash, stagger 0.02, `scrambleText` 0.25 s per char, lowercase set | headings, labels, section markers |
| **Velocity diffusion** (B `diffusion-ch`) | energy = clamp(0.7·|v|/1800 + 0.55·max(|a|/14000, wheel/140)); attack 50/s, release 3/s; density 0.5; rim ratio 0.5 (leading edge of scroll); element opacity `1 − 0.72·energy`; glyph set case-preserving Latin + digits; glyph phase `scrollY/24`; catch-up opacity 0.3 → 1 over 0.28 s | essay body (rim only, while scrolling) and landing paragraphs |
| **Sidenote reveal** (B `data-tertiary-reveal`) | opacity 0 → 1, translate 3px → 0, 0.18 s `--ease-expo`; positioned 0.28 s `--ease-in-out`; siblings dim to 0.3 on marker hover | sidenotes |
| **Header auto-hide** (A) | `translate3d(0, −header-height, 0)` scrolling down, 0 up, 0.2 s `--ease-out`; `mix-blend-mode: difference` over hero | global header |
| **Hero parallax** (A `.c-home-hero`) | background `translateY(−25vh · p)`, veil opacity `0.75 · p`, `p = (progress − 0.5)/0.5` | hero field |
| **Row hover** (A featured links) | inline visual width 0 → 1.5em, enter 0.45 s / leave 0.2 s `--ease-expo` | beat rows, essay rows |
| **Underline hover** (A) | `text-decoration-thickness: var(--border-size)`, `text-underline-offset: 0.1em` | all text links |
| **Focus** (A) | `outline` auto, offset 5px | all focusables (ours: 1px ink, offset 4px) |
| **Tile hover** (B) | `scale(0.99)`, 0.1 s | next-essay block |
| **Image fade** (A `.c-image`) | opacity 0 → 1, 0.6 s `--ease-out` | figures |
| **Page fade** (B `.onpage-navigating`) | blocks opacity → 0, 0.2 s ease-in | page transitions (combined with A shuffle) |

Staggers used: 0.01 (chars), 0.02, 0.025, 0.04 (dots/rows), 0.05, 0.08 (lines), 0.1, 0.2 — all present in Ref A bundle.

## 5. States

| Element | Rest | Hover | Focus-visible | Active |
|---|---|---|---|---|
| text link | no underline | underline 1px, offset 0.1em + in-word shuffle | 1px ink outline, offset 4px | translateY(1px) |
| header nav link | — | underline + shuffle | outline | — |
| beat / essay row | rule top | inline glyph 0 → 1.5em, title shuffle, `--paper-2` wash | same as hover + outline | scale(0.995) |
| wordmark | adopted dots | front re-runs, word shuffles | ring | — |
| sidenote marker | chip `--paper-2` | linked note full opacity, others 0.3 | outline | — |
| term chip | ink bg / paper text | crosshair cursor, definition note highlights | outline | — |
| next essay | — | scale(0.99) 0.1 s, title shuffle | outline | — |

## 6. Deltas table (every intentional difference)

| Token / element | Reference value | Our value | Reason |
|---|---|---|---|
| page background | A `#FFFFFF`; B `#EEEEEE` (chapters) / `#000` (abstract) | `#FAFAF8` everywhere | brief: white/near-white site-wide; one calm paper for landing + reading |
| text colour | A `#000`; B `#111` | `#0D0D0C` | identity; softer than pure black on warm paper |
| accent | A red `#DA382E`/blue `#312DFB` themes; B blue | `#00A15C`, graphics only | identity; meaning = adoption front |
| theme switching | A swaps bg to red/blue/black per section | none — always paper | brief requires white; themes are A's identity |
| display font | PP Locomotive New Light | Instrument Serif 400 | open-source match (condensed high-contrast display serif) |
| sans | Helvetica Now Display; Replica; ES Allianz | Inter Tight Variable | open-source match; one family for both sans roles |
| mono layer | none | Space Mono | our identity layer (section markers, notes, dates) |
| `--border-size` | 2px (≥1025) / 1px | 1px | colder, more precise hairline; keeps rule rhythm |
| sans display tracking | normal | −0.01em at ≥ `--fs-medium` | Inter Tight's default spacing is looser than Helvetica Now Display at display sizes |
| essay body line-height | 1.25 | 1.36 | Inter Tight x-height (~0.55) > Replica (~0.50): 1.25 × 1.09 keeps the same optical leading |
| essay title | ReplicaHeavy 700 uppercase at ×3.14 | Instrument Serif 400 sentence case at ×5.2 (`--xlFontSize`) | carries Ref A's display voice into the essay; stays on B's ladder |
| essay section heads | 700 sans, no marker | 700 sans + mono `§ 0n` marker | numbered sections = our theory-fiction register |
| pull quote | B blockquote ×3.14 sans, width 150% | ×3.14 serif, width 150% + 1rem, hanging mono index | identity; keeps size/width |
| rail card | black card on grey page, logo, DOI, "More Info", Agentworld promo | paper panel, 1px rule, wordmark, date, reading time, per-section adoption bars | white site; no DOI/promo; progress bars are ours |
| chapter tiles | 4 big tiles (15rem high, bg ink / 11% white) | one quiet "Next essay" row | brief: quiet next link; tiles are B's signature |
| diffusion glyphs | random Latin + digits (case-preserving) | letters of the same word shuffled, with `·` at high energy | fuses A's in-word shuffle with B's velocity model; distinct texture |
| diffusion zone | whole viewport rim with overscan | leading 22% rim only; never in reading band | brief: motion must never interrupt reading |
| hero media | fullscreen video (people) | live diffusion-field canvas; the name lives inside it as a point cloud revealed by the cursor's heat trail | no people/imagery; our motif |
| home header over hero | always visible, blended over video | hidden (opacity 0, −30% y, 0.45s easeOutCubic) until you scroll past the hero; hide-on-scroll-down kept | client direction: full-screen hero |
| hero statement | serif h1 statement bottom-left ("Digital-first Design Agency") | none — the name itself, in the field (h1 kept for screen readers) | client direction: no slogan copy |
| preloader content | typed lines above/below a small logo | a lattice of points flows into a full-width "Corollary Labs", handed to the hero field, then dissolved left→right | client direction: bigger name intro; keeps A's front/stagger rhythm |
| about visual (2nd motif) | 3D staff avatar | reorganisation field: lattice → twist → modules → orbits → new lattice, links tearing and re-forming | our motif |
| summary visual | 3D ring render (5:7) | live S-curve canvas (5:7) | our motif |
| about visual | 3D scanned staff avatar | field in "dissolve" mode | no people |
| featured-row inline visual | project video thumbnail | mini adoption glyph (SVG) | our motif |
| footer coords | address with pictogram boxes | live adoption readout + [EMAIL] in the same huge serif lines with inline mono boxes | our copy; keeps the typographic idea at our scale |
| preloader | black screen, white type | paper screen, ink type | white site |
| mobile menu | full-bleed blue `#312DFB` | full-bleed paper, ink serif links | white site |
| store, careers, 3D, L.I.S.A. | present | removed | not our content |
| cursor | default (A); crosshair on B annotations | crosshair on terms, notes and the field; field reacts to pointer | presence where B has it; field is ours |

## 7. Guardrails

- Never add colour beyond the tokens; never put `--signal` on type.
- Headlines: serif, weight 400, large. Never bold the serif.
- Functional text: sans at `--fs-medium`; labels mono uppercase-free, sentence case.
- Hairlines only; no shadows, no cards with shadows, no gradients, no glow, no blur.
- Every section starts on a rule or a label; whitespace is taken from the spacing scale only.
- Motion uses the easing tokens; nothing bounces; nothing loops unless it is the field.

## 8. Agent prompt guide

Build in this system by: importing `tokens.css`; laying out on `.o-grid` (12/8/4 columns);
setting display type with `.t-huge` / `.t-h1` (serif) and running text with `.t-medium` (sans);
marking any text with `data-reveal="lines|chars|scramble"` so the motion layer animates it;
using `<Figure kind=…>` for charts (they are generated, never images). Essays are MDX in
`src/content/essays/` with `title`, `date`, `dek` frontmatter.
