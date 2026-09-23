# Corollary Labs — website

A minimal landing page and a native essays publication, built in Astro with GSAP, ScrollTrigger,
SplitText, ScrambleText and Lenis.

## Run it

```bash
cd site && npm install && npm run dev        # http://localhost:4321
```

- `npm start` builds and serves the production build (static, `site/dist`).
- `npm run gate` runs the style-assertion gate: build → serve → read computed styles headless →
  assert against our spec.

## Layout of this folder

| Path | What |
|---|---|
| `site/` | the website (Astro, static output) |
| `site/brand.md` | brand direction, written before the build |
| `site/src/config/site.ts` | **the single config**: name, email placeholder, nav, all landing copy |
| `site/src/content/essays/*.mdx` | essays |
| `clone-workspace/locomotive/`, `clone-workspace/superdark/` | recon + extraction of both references (methodology workspace) |
| `clone-workspace/corollary/03-design-spec/DESIGN.md` | our spec, with the deltas table (§6) |
| `clone-workspace/corollary/03-design-spec/assertions*.json` | the machine-checkable form of the spec |
| `clone-workspace/corollary/06-qa/cycle-N/` | gate runs (`clone-styles.json`, `metrics.json`) |
| `tools/` | headless Playwright recon/extraction/motion/QA scripts + the gate |
| `_method/` | the methodology repo (per-simmons/clone-app-pat-pro-public) |

---

## References

**Reference A: site system.** Locomotive® — https://locomotive.ca/en
Awwwards **Site of the Month (March 2023) + Developer Award**.
Why this one: it is predominantly black type on white, set in a condensed display serif and a tight
grotesk. It has a strict 12-column grid and hairline rules, it is famous for motion (Lenis smooth
scroll, GSAP + SplitText, a letter-shuffle language, a character-scramble preloader, Barba page
transitions), and it is public. It is a benchmark studio site, not an easy target. It was vetted
with the client before the build.
Note: its hero is a full-screen video, and some sections switch to red/blue/black themes. Neither
was carried over (see deltas).

**Reference B: essay reading experience.** "The Superdark Factory", Antikythera Journal
(Agentworld) — https://superdark.antikythera.org/ (abstract) and
https://superdark.antikythera.org/chapter-i-darkness (the chapter template that was studied).
The chapter pages are ink on light grey, which is why they translate naturally to our paper.

## What was kept and what was changed

### From Reference A (Locomotive)

**Kept** (values measured from the live CSSOM and the JS bundle):
- 12/8/4-column grid, 20/10px gutters, 2.667rem/1.333rem margins, 4rem header
- root size steps (15/17/19/21px)
- type scale (huge 7.639vw, h1 4.667rem, medium 1.733rem; line heights 1 / 1.1 / 1.2)
- fluid spacing scale and its clamp formula, and the 10.667rem footer spacing
- header behaviour (hides on scroll down in 0.2s easeOutCubic, shows on scroll up, transparent
  over the hero)
- hero mechanics (fixed background with −25vh·p parallax and a veil rising to 0.75·p)
- the summary block geometry (4 columns wide, 5:7 visual, links outside the visual)
- featured-row geometry and hover (centered huge serif rows on rules, inline visual 0 → 1.5em,
  0.45s enter / 0.2s leave easeOutQuint)
- link underline hover (thickness = border size, offset 0.1em) and "Label →" link rows on rules
- Lenis (lerp 0.1)
- the preloader rhythm (0.25s per block, 0.01s per item, front sweep), the in-word letter shuffle
  (16 steps/s) and its use in page transitions (0.25s leave, 4 steps on enter)
- easeOutCubic / easeOutQuint and the 0.15–0.9s duration set, `power4.out` for line rises

**Changed:**
- palette, fonts and copy
- the hero is a live diffusion field instead of a video of a person
- no statement headline: the name lives inside the field and appears under the cursor
- the preloader is a particle assembly of the name on paper, instead of typed lines on black
- no theme switching (always paper)
- rules are 1px instead of 2px
- removed: 3D staff avatars, store, careers, the L.I.S.A. assistant, the "UNIT" and emoji glyph
  motifs, the blue mobile menu (ours is paper)

### From Reference B (Superdark Factory)

**Kept:**
- the 12-column chapter grid (text in columns 4–10, sidenotes in the right quarter, measure
  ≈ 913px at 1920)
- the stepped type base (12 → 30px) and its ladder ×0.857 / 1 / 1.43 / 1.86 / 2.42 / 3.14 / 5.2
- paragraph spacing 1.28em and heading gap
- sidenotes: 1× size, 1.28 line height, 0.375rem panels, placed beside their reference with
  collision shifting, revealed with opacity + 3px over 0.18s easeOutQuint; hovering a note or its
  marker dims the other notes to 0.3
- the numbered note-marker chip and the inverted glossary chip (0.125rem radius, crosshair cursor)
- pull quotes at ×3.14, spanning 150% into the note column
- figures with a 75%-width caption on the right
- the fixed left rail (article card + table of contents)
- the page-fade transition (0.2s ease-in)
- **the velocity diffusion text model**: energy from scroll velocity and acceleration, attack 50/s,
  release 3/s, density 0.5, rim-weighted by scroll direction, glyph phase = scrollY/24

**Changed:**
- the rail is a paper panel with per-section progress bars; there is no DOI, promo card or "More Info"
- the four big chapter tiles became one quiet "Next essay" row
- titles are Instrument Serif at ×5.2 instead of heavy uppercase
- section heads carry a mono `§ 0n` marker with a drawing rule
- diffusion glyphs are the word's own letters reshuffled (A's shuffle fused with B's model), with
  `·` at high energy
- diffusion is confined to the leading 22% rim, so the reading band never changes and text at rest
  is perfectly still

### How the sections map

| Locomotive | Corollary Labs |
|---|---|
| preloader (typed lines + logo) | intro: a lattice of points flows into a full-width "Corollary Labs", hands it to the hero field, then dissolves it left → right |
| hero (video, title at the bottom) | hero: full-screen live diffusion field with no header and no copy. "Corollary Labs" sits in it as a faint point cloud, sharpens into a point network wherever the cursor moves and decays behind it; when idle, a slow "ghost" wanders through it. The header appears once you scroll past the hero |
| summary ("Seven Years / Running", 5:7 ring render, link rows) | summary: a 5:7 field that spreads with scroll and draws its own adoption curve, a paragraph and link rows |
| featured work (huge serif rows) | thesis: the same rows as a **pinned 4-beat sequence** (The lag / The long middle / The dissolve / Why now); scroll drives the active row, its body text and the field (spread → takeover → rewind to "now") |
| indent paragraph + avatar + text + links | about: huge serif statement with an inline lattice glyph, the **reorganisation field**, "how we work", four beliefs, link rows |
| Extras (13) + article list | Essays (3) + recent list |
| store | removed |
| footer (menus + huge address lines with pictogram boxes) | footer: menus, then huge serif lines "Corollary ~ Labs / Write to us [EMAIL]" with an inline curve and a mono box |

| Superdark chapter | Corollary essay page |
|---|---|
| fixed rail card + TOC dropdown | sticky rail card (title, author, date, reading time, placeholder flag, reading progress) + contents with per-section bars |
| chapter heading | kicker (date, reading time) + serif title + dek + placeholder flag + drawn rule |
| richtext + tertiary asides | body + sidenotes generated from Markdown footnotes |
| annotations | `<Term>` chips with a hover definition |
| blockquote | pull quote with a mono index |
| block-media | `<Figure>`: generated SVG charts, drawn in on reveal and scroll-linked (live marker, dissolving lattice, filling cells) |
| chapter tiles | a quiet "Next essay" row |

## Deltas table

The full table is in `clone-workspace/corollary/03-design-spec/DESIGN.md` §6. The main entries:

| Token | Reference value | Ours | Reason |
|---|---|---|---|
| background | A `#FFF`; B `#EEE` / `#000` | `#FAFAF8` everywhere | white site-wide; calmer for reading |
| text | `#000` / `#111` | `#0D0D0C` | identity |
| accent | A `#DA382E`/`#312DFB`; B blue | `#00A15C`, graphics only | identity; marks the adoption front |
| display font | PP Locomotive New Light | Instrument Serif | open-source match |
| sans | Helvetica Now Display; Replica / ES Allianz | Inter Tight Variable | open-source match |
| mono | — | Space Mono | our marginalia layer |
| border size | 2px desktop | 1px | colder, more precise |
| essay body line height | 1.25 | 1.36 | Inter Tight's taller x-height |
| essay title | ReplicaHeavy uppercase ×3.14 | serif ×5.2 | carries A's display voice |
| pull quote | sans ×3.14 | serif ×3.14 | identity |
| diffusion zone | whole rim | leading 22% only | reading must never be interrupted |
| diffusion glyphs | random Latin | the word's own letters | fuses A + B; distinct texture |
| hero | video + statement | field + the name revealed by the cursor | no people; client removed the statement copy |
| preloader | typed lines on black | particle assembly of the name on paper | white site; client asked for a bigger name intro |
| chapter tiles | 4 tiles | 1 quiet next link | brief |
| themes / store / 3D / assistant | present | removed | not ours |

## Brand direction and palette

See `site/brand.md`. In short: ink on paper, three greys, and one accent that never touches type.
Phosphor green `#00A15C` appears only on the moving adoption front (nodes switching state, links
forming, reading progress), so it is always in motion and always means one thing. Both references
are strict two-tone systems. We keep that discipline, warm the paper a hair for long reading, and
replace their accents.

Contrast on paper: ink 18.6:1, ink-2 7.1:1 (AA text), ink-3 3.2:1 and signal 3.2:1 (non-text only).

The wordmark is seven dots on a logistic path plus "Corollary" (Inter Tight 500) and "Labs"
(Space Mono). It is inline SVG and text. On hover the dots adopt in sequence and the word shuffles.

## Motion system

| What | How | Derived from |
|---|---|---|
| smooth scroll | Lenis, lerp 0.1, on the GSAP ticker | Ref A bundle |
| intro | ~3,000 points on a lattice flow along curved paths into the name; a left → right front with per-point stagger; arrivals flash signal, then ink; the old lattice dissolves behind the front; hand-off to the hero field, which dissolves the name left → right. Skippable; ×2.2 speed on repeat visits | Ref A preloader rhythm (0.25s blocks, 0.01s items, sessionStorage quick mode) |
| hero field | diffusion simulation (innovation + imitation on a lattice graph, resistant pockets, precomputed adoption times, so it can be rendered at any time t); the lattice dissolves under the front; the new network grows parent → child; the cursor accelerates local time and bends the lattice; scroll pushes adoption further; the name point cloud is revealed by a cursor heat trail (Gaussian, ~150px, decays ~1.5s) | ours; hero parallax −25vh·p and veil 0.75·p from Ref A |
| reorganisation field | five formations (lattice → twist → modules → orbits → rotated hex lattice) reached by continuous deformation; outgoing links tear past 1.15× their rest length; incoming links form, some flashing signal; turbulence peaks mid-transition; the cursor tears links; scroll advances the phase | ours |
| thesis | sticky 100svh panel in a 420svh section; scrubbed progress sets the active row, the body (in-word shuffle on change), the progress bar and the field time | Ref A row geometry and hover |
| headings / labels | per-character scramble-in (show at i·0.02s, 5 glyph swaps × 16ms) and ScrambleText labels (0.25s + 0.02s/char) | Ref A preloader and assistant dialog |
| paragraphs | masked line rise (SplitText lines + mask, yPercent 105 → 0, 0.9s power4.out, stagger 0.08) | Ref A SplitText lines/masks, 0.9s |
| rules, rows, visuals | scaleX 0 → 1 over 0.9s easeOutCubic; rows stagger 0.1; visuals fade over 0.6s | Ref A |
| hovers | in-word shuffle (4 steps / 0.25s) on links, nav, rows and wordmark; underline; arrows move 0.25em over 0.3s; row inline glyph 0 → 1.5em (0.45s / 0.2s easeOutQuint); essay rows' curve front runs along | Ref A |
| page transitions | leave: shuffle every visible leaf text + fade the page root (0.25s / 0.2s ease-in); enter: header shuffle | Ref A Barba transitions + Ref B page fade |
| essay text | velocity diffusion (see Ref B above) on words near the leading rim, plus a one-time resolve as each paragraph enters | Ref B |
| sidenotes | 0.18s easeOutQuint reveal, 0.28s positioned transitions, dim to 0.3 | Ref B |
| figures | strokes draw in (1.6s power2.inOut); scroll-linked live marker / dissolving lattice / filling cells | ours, on Ref B's block timing |
| reduced motion | Lenis off, no intro, fields render one composed still frame, thesis unpins into a static list, all text visible, transitions instant | — |

All motion uses transforms, opacity or canvas. Canvases pause when offscreen, and the essay engine
reads no layout per frame (word positions are cached).

## How to add an essay

Drop a file into `site/src/content/essays/`, e.g. `my-essay.mdx`:

```mdx
---
title: The title
date: 2026-10-01
dek: One sentence that appears under the title and in the index.
placeholder: false   # optional; shows the placeholder flag when true
---

Body text in Markdown. A footnote becomes a sidenote automatically.[^1]

## A section head   ← numbered § 01 and listed in the contents rail

> A blockquote becomes a pull quote.

<Figure kind="gap" n={1} caption="Generated figure. Kinds: gap, curve, dissolve, org, layers." />

<Term def="Definition shown on hover.">a term</Term>

[^1]: The note text.
```

The author is always "Corollary Labs" (from `site.ts`). Reading time is computed. The index, the
landing list and the next-essay links update automatically.

## Substitutions

| Reference asset | Substitute | Licence |
|---|---|---|
| PP Locomotive New Light | Instrument Serif | OFL, via Fontsource |
| Helvetica Now Display; Replica; ES Allianz | Inter Tight Variable | OFL, via Fontsource |
| — | Space Mono (our mono layer) | OFL, via Fontsource |
| hero video, 3D renders and avatars, product photos | code-generated canvas fields | ours |
| project thumbnails in hover rows | inline SVG adoption glyph | ours |
| Superdark images and video | generated SVG figures | ours |
| emoji and pictogram glyph boxes | mono text boxes and an inline curve | ours |

No image, video or font file from either reference was downloaded or hotlinked. Fonts and media
were catalogued by URL only (`02-extraction/fonts.json`, `assets.json`). The reference JS bundles
were read only to extract motion parameters.

## Methodology notes (overrides applied)

The workflow follows `_method` (contract, stages, workspace filenames), with these changes:
- headless Playwright replaced the Chrome extension
- the check-in gates were skipped
- recon, extraction and a per-frame motion trace ran on both references at 1920 / 768 / 375
- interaction sweeps covered hover, focus and the mobile menu
- the gate compares against our spec, not the references

Two interactions are logged as `unreached`: Superdark's TOC dropdown (it isn't clickable headless;
it was captured in scroll frames instead) and Locomotive's extras-row hover (selector timeout).
The side-by-side review was done from screenshots at every breakpoint.

## Final assertion results

`npm run gate` → **cycle 5: 378 / 378 style assertions passed, 0 failed, build OK**
(`clone-workspace/corollary/06-qa/cycle-5/metrics.json`).
History: cycles 1–3 passed; cycle 4 failed 3/378 when the full-screen hero added an opacity fade to
the home header. The spec was updated to the new transition (and recorded in the deltas), and cycle 5 passed. Cycle 1 passed 399/399 before the hero
redesign. The assertion count changed because the removed hero headline and header readout
assertions were retired and the hero height and scroll-cue assertions were added.

The assertions cover landing, essay and index pages at desktop (1920), tablet (768) and mobile
(375). They check colours, font families, sizes, line heights, weights, grid-derived widths (summary
block, essay measure, sidenote and pull-quote widths), borders, radii, positioning (fixed / sticky /
absolute) and transition durations and easings.

## Content honesty

- All three essays are placeholders and are flagged as such on the page.
- They contain no real people, quotes, citations, customers, metrics or funding.
- Figure data is synthetic and labelled.
- The contact address is the visible placeholder `[EMAIL]`.
