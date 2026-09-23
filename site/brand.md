# Corollary Labs — Brand Direction (v0.1)

Written before the build. Everything here is implemented from `src/config/site.ts` (name, copy
constants) and `src/styles/tokens.css` (every token below).

---

## 1. Position in one line

Corollary Labs studies and works on how a new general-purpose technology actually spreads —
through firms, institutions and ordinary days. Invention is a moment; the change is the spreading.

The site states a thesis and a direction. It never lists products, customers, prices or plans.

## 2. Voice rules

| Do | Don't |
|---|---|
| Short declaratives. One idea per sentence. | Hype verbs: *revolutionize, supercharge, unlock, transform, empower, 10x*. |
| Talk about adoption, lag, friction, replacement, the uneven arrival of the future. | Talk about "diffusion models", training, or model architectures. We are not that. |
| First-person plural, sparingly: "we think", "we work". | Name, quote, paraphrase-with-credit or cite any thinker, economist or philosopher. |
| Precise nouns: *firm, workflow, institution, habit, tool, process*. | Textbook terms (*creative destruction*, *diffusion of innovations*, *S-curve theory of…*). |
| Leave the business deliberately open ("we work where the spreading happens"). | Business-model statements, audiences, pricing, "for enterprises and consumers". |
| Cold, exact, a little strange — a research note, not a pitch. | Exclamation marks, emoji, rhetorical questions stacked for effect. |
| Mark placeholders visibly: `[EMAIL]`, `PLACEHOLDER ESSAY`. | Invent people, partners, funding, metrics or papers. |

Stylistic note: a faint 90s theory-fiction register is allowed in *typography and cadence*
(numbered sections, mono marginalia, systems language, "the future arriving unevenly"),
never as borrowed ideology or quoted content.

## 3. Palette

White is required everywhere. The palette is ink on paper with a graded set of greys and exactly
one accent that is **never used for text**.

| Token | Hex | Role | Contrast on paper |
|---|---|---|---|
| `--paper` | `#FAFAF8` | page background, everywhere | — |
| `--paper-2` | `#F2F2EF` | sidenote panels, hover wash | — |
| `--ink` | `#0D0D0C` | all primary type, rules, adopted nodes | 18.6 : 1 |
| `--ink-2` | `#56564F` | secondary type (deks, metadata, captions) | 7.1 : 1 (AA) |
| `--ink-3` | `#8E8E86` | tertiary marks, un-adopted nodes, disabled | 3.2 : 1 (non-text only) |
| `--rule` | `#D9D9D3` | hairlines, the "old structure" lattice | decorative |
| `--signal` | `#00A15C` | the adoption **front** only: nodes switching state, the live point on a curve, reading-progress fill | 3.2 : 1 (graphics, ≥3:1 non-text) |

**Why this palette.** Both references are strict two-tone systems (Locomotive `#000/#FFF`; the
Superdark chapter pages `#111` on `#EEE`). We keep that discipline but move the paper a hair warm
(`#FAFAF8`) so long reading is calmer than pure white, and replace their brand accents
(Locomotive's red `#DA382E` / blue `#312DFB`; Antikythera's electric blue) with a cold phosphor
green. Green is chosen for meaning, not decoration: it marks the single thing the site is about —
the moment a node adopts. It appears only on the moving frontier of the diffusion motif and on
reading progress, so it is always *in motion* and never static decoration. It carries a faint
CRT/terminal memory that suits the theory-fiction register, without becoming "hacker green"
because it never touches type.

## 4. Type

All open source (OFL), self-hosted through Fontsource. No reference font files were downloaded.

| Role | Face | Matched to | Why |
|---|---|---|---|
| Display serif | **Instrument Serif** 400 | PP Locomotive New Light (Ref A) | condensed, high-contrast, sharp display serif with the same narrow set width and tall lowercase; used large and light |
| Grotesk (UI + essay body) | **Inter Tight** (variable 100–900) | Helvetica Now Display (Ref A) · Replica / ES Allianz (Ref B) | tight neo-grotesk metrics like Helvetica Now Display; its text cuts cover Replica's role in long reading; one family for both references' sans roles |
| Mono (marginalia) | **Space Mono** 400/700 | — (our own layer) | the identity layer neither reference has: section markers, note numbers, dates, coordinates. Carries the 90s systems register |

Scale ratios are inherited, not invented (see DESIGN.md): landing uses Locomotive's rem scale
(root 15/17/19/21 px, medium 1.7333rem, h1 4.6667rem, huge 7.6389vw); essays use the
Superdark ladder on a stepped base (12→30 px): ×0.857 · ×1 · ×1.43 · ×1.86 · ×2.42 · ×3.14.

## 5. Wordmark

A typographic mark built entirely in code (`src/components/Wordmark.astro`, inline SVG + text).

```
 ·  ·  ● ●●●   Corollary Labs
```

- **Glyph (the "front")** — seven dots on a rising logistic path. Unfilled dots are `--ink-3`
  rings, adopted dots are solid `--ink`, and the dot on the front is `--signal`. Read left to right it
  is an adoption curve; read as a mark it is a corollary — something that follows.
- **Word** — "Corollary" in Inter Tight 500, tracking −0.02em; "Labs" in Space Mono, set as a
  small raised tag. The contrast of grotesk and mono is the brand in miniature: institution + system.
- **Animation** — on load the dots adopt one after another (stagger 0.04 s, Locomotive's char
  stagger), and the letters resolve from shuffled glyphs. On hover the front runs again and the
  word shuffles (Locomotive's in-word shuffle, 16 steps/s). On focus the same, plus a 1px ink ring.
- **Minimum size** — 18 px glyph height; below that the glyph drops to 5 dots.

## 6. Motif — the diffusion field

The one structural idea native to Corollary Labs. A canvas population of nodes (firms, desks,
households — never labelled) sits on a faint rectilinear lattice (the old structure). Adoption
starts from a few seeds and spreads along neighbour links with a logistic rate; as the front passes,
the lattice segments under it dissolve and are replaced by the new links the network drew. It:

- **moves** on its own (slow drift, breathing seeds);
- **spreads** with scroll (scroll progress drives adoption time in pinned sections);
- **reacts** to the cursor (the pointer is a local accelerator: nodes near it adopt sooner and the
  lattice bends away);
- is used **sparingly**: hero background, the thesis sequence, the About visual, tiny live curves in
  the wordmark/footer/essay index, and figures in essays.

## 7. Motion principles

1. **Everything arrives; nothing just appears.** Text resolves from glyph noise, lines rise out of
   masks, rules draw, nodes adopt.
2. **Borrowed timing, our meaning.** Easing, durations and staggers are extracted from the
   references (DESIGN.md §Motion). The *shuffle* is Locomotive's; the *velocity-driven glyph
   diffusion* is Superdark's; the *adoption front* is ours.
3. **Reading is sacred.** Essay body text may resolve as it enters at the viewport rim, and only
   while you are scrolling fast. In the reading zone and at rest it is perfectly still.
4. **Transforms and opacity only.** No layout-animating properties on scroll. Canvas work is
   capped to visible sections and paused offscreen.
5. **Reduced motion is a first-class design**, not an absence: every animated element has a
   composed static end state, the field renders one still frame at a meaningful adoption level,
   and transitions become instant.
