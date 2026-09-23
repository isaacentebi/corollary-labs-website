# HANDOFF — Corollary Labs site

This is where the project stands, what's been decided and what comes next. Read it before touching anything.
The first commit, `v1`, snapshots the "story" version of the home page described below.

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

## Current home page (v1)

The whole page is one sticky stage. A single scroll progress `p` drives it:

- **Hero** (`p` 0–0.06). Full-screen diffusion field. "Corollary Labs" sits in it as a faint point cloud. The cursor reveals the name, and clicking plants seeds.
- **Dive** (0.06–0.15). The camera zooms into one node, and that node's outline becomes the firm.
- **Figs 1–4** (0.15–0.62). A plotter diagram:
  - The firm is a big hatched circle holding JUDGEMENT / RISK / RELATIONS, plus an EXECUTION chip wired to three roles.
  - EXECUTION leaves the circle and becomes a green AGENT outside, linked by a green loop. The BUYS/SUPPLIES labels were removed at the user's request.
  - The roles go grey and disappear.
  - The circle contracts.
- **Pull back** (0.62–0.70). The firm shrinks back into its node.
- **Fig 5 diffusion** (0.70–0.84). A green front spreads from that node across the field.
- **Lift + coda** (0.84–1). The field lifts into 3D, then goes through the homotopy (twist → tear → re-glue into a torus).
- **Essays list and footer** follow.

## NEXT: the agreed rework (not started)

The user decided the diagram's premise is wrong. **It is not about replacing humans.** Replacement is a second-order effect at most. The rework should tell a Schumpeterian **new combination** story about **inputs and outputs**:

1. **The combination.** LABOUR · CAPITAL · KNOWLEDGE → FIRM → OUTPUT A. The firm is one particular way of combining inputs, and its operators are wired to execution.
2. **A new combination.** A new input enters, in green: machine inference, the agent. **It enters the firm; it does not leave it.** The internal wiring re-routes through it, and new outputs (B, C) appear, work that wasn't economical before.
3. **Displacement.** The old route to OUTPUT A thins and fades because it's out-competed. **The operators re-attach to the new outputs; they do not vanish.**
4. **Recomposition.** The boundary redraws around the new combination: a different shape, not just a smaller one.
5. **Diffusion.** Pull back: the new combination spreads firm to firm, and old combinations fade as it passes.

Open question for the user: should outputs be generic (A/B/C) or named (e.g. SERVICE / PRODUCT / MARKET)? I recommended generic.

## Copy status

**Not settled.** The captions in `Story.astro` are placeholders from an earlier round and need replacing once the rework lands.

The user wants the tone of **The Superdark Factory** (superdark.antikythera.org): plain, literal, technical definitions, like an engineering manual. The strangeness comes from *what* is asserted, never from wordplay. The format is two uppercase mono lines per figure.

**Hard lessons, so we don't repeat them:**
- **Aphorisms, paradoxes and poetic reversals read as AI slop and were hated.** Examples: "a delay once called judgement", "a decision that has forgotten", "is no longer". Also avoid "once", "no longer", "becomes", "forgets".
- **Explanatory lines were hated**, e.g. "software can now…", "and the firm buys it instead".
- **The "directed inside / bought outside" make-or-buy framing was hated.** It was my framing, not the user's.
- **Don't pollute copy subagents with my framing.** Clean-room briefs that use only the user's own words worked better. Having the agents actually *read the Superdark essay* worked best.
- **Show agent output unedited, side by side, and let the user pick.** Don't blend it into a new set of mine.
- **The user's own description of the company:** "business agents and personal agents; intersection of automation, Schumpeterian ideas, creative destruction and reorganisation; diffusion throughout the economy; diagnostic, dense, high-brow; cybernetic + sophisticated economic + AI terms." Never state the business model literally on the site.

## User preferences, settled

- **No top navbar anywhere.** Navigation lives only in the footer (Home, Essays, Back to top, [EMAIL]).
- **No logo at the top.** The earlier wordmark with dots was disliked.
- **Removed as slop:** "adoption 00.0%" and other readouts, hero slogans, "Write to us", the inline curve glyph in the footer, the thesis beat rows, the summary box, the About section.
- **The hero is full-screen**, with just the field and the name. The name uses a denser point cloud, and on phones it stacks as Corollary / Labs.
- **They love** the diffusion field, the name reveal under the cursor, click-to-seed, the plotter-diagram look (hatching, boil wobble, green only on what changes), and the homotopy drawn in the network style.
- **White/paper site, one green accent.** Fonts: Instrument Serif, Inter Tight, Space Mono.
- **The original brief is overridden where the user says so.** "Ignore the brief" includes the rule against quoting thinkers, so real quotes are now allowed if wanted.
- **Mobile matters.** Check every change at 375px.

## Known loose ends

- `site/src/scripts/home.ts` now only calls `initStory`. `plates.ts`, `morph.ts` and `Plates.astro` are unused leftovers and can be deleted.
- The README's motion and mapping sections describe older versions and should be refreshed after the rework.
- The essays are lorem ipsum, on purpose, until the copy is settled.
