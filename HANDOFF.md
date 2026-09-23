# HANDOFF — Corollary Labs site

This is where the project stands, what's been decided and what comes next. Read it before touching anything.
Tags: `v1` = the first story version (replacement diagram); `v2` = the reorganisation diagram, green coda, Set A captions and the About page. A rejected attempt is kept in `git stash`.

## Run

```bash
cd site && npm install && npm run dev      # http://localhost:4321
cd site && npm run gate                    # build → serve → headless computed-style read → assert vs our spec
```

- The gate script is `tools/gate.mjs`, the assertions come from `tools/make-assertions.mjs`, and results go to `clone-workspace/corollary/06-qa/cycle-N/`.
- Last run: cycle 15, 270/270 assertions passing.
- `tools/story-shots.mjs`, `tools/motion-check.mjs` and `tools/intro-shots.mjs` are headless screenshot helpers for reviewing motion.
- The original brief and methodology notes are in `README.md` (partly stale since the pivots below).

## Where things live

| What | File |
|---|---|
| Home page (story + essays list) | `site/src/pages/index.astro`, `site/src/components/Story.astro` |
| Story orchestration: one sticky stage, one scroll progress | `site/src/scripts/story.ts`. Phase map `P` at the top; `makeDiagram()` holds the diagram. |
| Diffusion field (hero + fig 5) | `site/src/scripts/field.ts`. Name layer, click seeds, camera. |
| Homotopy surface (coda) | `site/src/scripts/surface.ts`. Drawn in the field's network style. |
| Intro (particles assemble "Corollary Labs") | `site/src/scripts/preloader.ts`, `site/src/scripts/wordmask.ts` |
| Essays index / essay template | `site/src/pages/essays/index.astro`, `site/src/pages/essays/[slug].astro`, `site/src/styles/essay.css`, `site/src/scripts/essay.ts`, `site/src/scripts/diffusionText.ts` |
| Essays (lorem ipsum placeholders) | `site/src/content/essays/*.mdx` |
| Tokens / brand | `site/src/styles/tokens.css`, `site/brand.md` |
| Spec + deltas | `clone-workspace/corollary/03-design-spec/DESIGN.md` |
| Footer (the only navigation) | `site/src/components/Footer.astro` |

## Current home page (v2)

The whole page is one sticky stage driven by one scroll progress `p` (phase map `P` in `story.ts`):

- **Hero** (0–0.06): full-screen diffusion field with "Corollary Labs" as a point cloud (cursor reveals, clicks seed).
- **Dive** (0.06–0.15): the camera falls into one node; it resolves into the firm.
- **Figs 1–4** (0.15–0.62), `makeDiagram()` in `story.ts`. The picture was agreed first as a static storyboard (`storyboard/index.html`), then animated. One timeline unit per figure (fig 4 runs 3.0–4.6); captions follow the timeline clock.
  1. **The firm**: inputs pass through three people in a line to OUTPUT A; each step is tied by a bundle of instructions to COORDINATION.
  2. **Automation enters**: a green streak arrives along the input line (same entrance as the inputs) and settles at the middle step as an AGENT with a pulse; the person steps aside. Nothing else changes.
  3. **What the agent needs**: its instruction bundle dies (grey dashed); one green GOAL line replaces it.
  4. **Reorganisation**: bundles retract; COORDINATION collapses to a point and bursts into five small agents that settle between the steps as a mesh (green dots flow back upstream through it); the wall grows, green spreads to every step, people move to the edges on an unlabelled loop (deliberately open: steering / review / recursion), one person sits on new work (output C); the wall opens; OUTPUT A fades, B and C draw in; throughput speeds up.
- **Pull back** (0.62–0.70) and **fig 5 diffusion** (0.70–0.84) as before.
- **Lift + coda** (0.84–1): homotopy sheet → torus; the re-formed surface turns green as a front sweeps round it (`surface.ts`).
- Phones: the diagram's flow runs top-to-bottom (geometry is written in flow coordinates u/v and mapped by `M()`).

**Captions** (`Story.astro`): Set A from one clean-room writer, verbatim, to be polished line by line with the founder. Known issues: "Step 2" in fig 3 (steps are not numbered in the drawing); fig 5 line 2 claims an output-mix shift the field doesn't draw.

**About** (`/about/`, `pages/about.astro`, `styles/about.css`): band with "About" in the field → statement "Corollary Labs is a company." + two placeholder sentences → static drawing of the reorganised firm → colophon (entity, founded, location, contact). Placeholders in [brackets], set in ink-3. The founder rejected numbered sections (Object/Method/…) and a terms glossary.

## How we got here (so we don't loop)

- Rejected diagram concepts: replacement story (execution leaves the firm) · labour/capital/knowledge + an AUTOMATION input (category error: automation is not a factor) · blob boundary · OBJECTIVE/PLAN/EXECUTION chips gliding inside (too abstract, agent invisible) · loop topology (invented).
- Grounding that stuck: Superdark ontology (a firm is defined by inputs/outputs; automation = a supplied input moving inside; execution needs plans, plan-making needs objectives; feedback loops) + the historical pattern that gains come from reorganising around a general-purpose technology, not dropping it in. **No historical references on the page** (no electricity/line shafts): founder's call. No "superdark" speculation (enterprise company).
- The box is **COORDINATION** (founder's choice over CONTROL / ORCHESTRATION).
- Process that works: static storyboard frames first → agree → animate. Copy: one clean-room writer (founder's words + the Superdark file at ~/Downloads/Superdark Factory.md), shown unedited; don't blend sets.

## Copy status

Captions are Set A (see above), pending a polish pass with the founder.

The user wants the tone of **The Superdark Factory** (superdark.antikythera.org): plain, literal, technical definitions, like an engineering manual. The strangeness comes from *what* is asserted, never from wordplay. The format is two uppercase mono lines per figure.

**Hard lessons, so we don't repeat them:**
- **Aphorisms, paradoxes and poetic reversals read as AI slop and were hated.** Examples: "a delay once called judgement", "a decision that has forgotten", "is no longer". Also avoid "once", "no longer", "becomes", "forgets".
- **Explanatory lines were hated**, e.g. "software can now…", "and the firm buys it instead".
- **The "directed inside / bought outside" make-or-buy framing was hated.** It was my framing, not the user's.
- **Don't pollute copy subagents with my framing.** Clean-room briefs that use only the user's own words worked better. Having the agents actually *read the Superdark essay* worked best.
- **Show agent output unedited, side by side, and let the user pick.** Don't blend it into a new set of mine.
- **The user's own description of the company:** "business agents and personal agents; intersection of automation, Schumpeterian ideas, creative destruction and reorganisation; diffusion throughout the economy; diagnostic, dense, high-brow; cybernetic + sophisticated economic + AI terms." Never state the business model literally on the site.

## User preferences, settled

- **No top navbar anywhere.** Navigation lives only in the footer (Home, Essays, About, Back to top, [EMAIL]).
- **No logo at the top.** The earlier wordmark with dots was disliked.
- **Removed as slop:** "adoption 00.0%" and other readouts, hero slogans, "Write to us", the inline curve glyph in the footer, the thesis beat rows, the summary box, the About section.
- **The hero is full-screen**, with just the field and the name. The name uses a denser point cloud, and on phones it stacks as Corollary / Labs.
- **They love** the diffusion field, the name reveal under the cursor, click-to-seed, the plotter-diagram look (hatching, boil wobble, green only on what changes), and the homotopy drawn in the network style.
- **White/paper site, one green accent.** Fonts: Instrument Serif, Inter Tight, Space Mono.
- **The original brief is overridden where the user says so.** "Ignore the brief" includes the rule against quoting thinkers, so real quotes are now allowed if wanted.
- **Mobile matters.** Check every change at 375px.

## Known loose ends

- `plates.ts`, `morph.ts`, `Plates.astro`, `InlineCurve` in the footer and the `summary/beats/about` exports in `config/site.ts` are unused leftovers.
- The README's motion and mapping sections describe older versions and should be refreshed after the rework.
- The essays are lorem ipsum, on purpose, until the copy is settled.
