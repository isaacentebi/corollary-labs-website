# DIRECTIONS — exploring several versions of the site

The brief for the next phase. Read HANDOFF.md first, for the current state and the founder's settled preferences. This file covers what we do next.

## Why

The founder loves the current site. Their boss asked: *"¿podemos probar algo más orgánico? menos 'industrial'?"* ("can we try something more organic? less 'industrial'?").

So we turn the single Vercel site into **several complete versions of the same site**, each one a different design direction. A small hub page lets the founder and their boss move between them.

The founder's words: be super ambitious; go to Awwwards for inspiration again; use subagents; loop a lot until each one is right. Try different colours and different logos.

## What stays the same in every version (the content)

- **The structure.**
  1. Hero: the name inside a living field (cursor reveals, click to seed).
  2. The statement beside an animation of what we do.
  3. Pull back into diffusion.
  4. The isotopy/homotopy coda.
  5. Footer navigation: Home · Essays · About · Team.
- **The argument in the diagram, figures 1–4:**
  1. A firm with coordination.
  2. The agent enters with the inputs.
  3. Its plan becomes a goal.
  4. Coordination is absorbed into a mesh of agents, the boundary is redrawn and opened, and new outputs appear.

  Each version *redraws* the diagram in its own visual language. The events stay the same.
- **Copy.** The Set A captions, the placeholder statement, and the About and Team pages with their placeholders. There is no copy work in this phase.
- **The founder's rules** (see HANDOFF):
  - no top navbar;
  - no slogans or readouts;
  - one accent colour per version;
  - check everything at 375px;
  - respect reduced motion;
  - no historical references on the page.

## What changes per version

Palette, typography, logo/wordmark, how things are drawn (line, form, texture), how motion feels (easing, physics, rhythm), and the hero field's behaviour.

## Versions

| Key | Name | Idea (a starting point; research will sharpen it) |
|---|---|---|
| `plotter` | **Plotter** (the current site, the baseline) | Technical plotter drawing: hatching, a "boil" wobble on lines, mono labels, one green accent. What exists at `v2` and later. |
| `organic` | **Organic** (the boss's request) | Growth, not machinery. The firm is a cell or membrane, not a rectangle. Agents are organelles or nodes that bud and divide. Coordination dissolves like a nucleus dividing into a mycelial mesh. Diffusion looks like growth or spreading ink. Soft curves, warm natural palette (e.g. bone, moss, clay), a humanist serif, springy easing. |
| `proof` | **Proof** (Claude's pick) | The name taken literally: a corollary is what follows from a theorem. The page reads like a mathematical paper: numbered definitions and propositions, LaTeX-like typography (a Computer Modern style serif), diagrams as commutative diagrams (objects and arrows), and the homotopy as the centrepiece. Ink on cream, one accent. The logo is a mathematical mark; see open question 1. |
| `atlas` | **Atlas** (Claude's pick) | The economy as terrain. Contour lines and isolines, the field as a topographic map, diffusion as a front moving across a map, firms as survey points. Map colours (paper, sepia ink, one survey colour), a cartographic sans, slow and smooth camera moves. |

This is at most four versions (Plotter plus three new ones). Add more only if the founder asks.

## How the versions are hosted

- **Code.** One git branch per version: `direction/organic`, `direction/proof`, `direction/atlas`. `master` stays Plotter. Each branch keeps the whole site and restyles or redraws it. There is no shared theming layer, so each version is free to diverge.
- **Deploys.** Each version is its own Vercel project with its own free URL, for example `corollarylabs-organic.vercel.app`. The current `corollarylabs.vercel.app` stays Plotter.
- **Hub.** `corollarylabs-directions.vercel.app` is one page listing every version, with a screenshot of each (hero and the fig 4 moment), a one-line idea, colour swatches, the logo, and a link.
- **Switcher.** Each version gets a small pill in the corner that jumps between versions. It must be easy to remove before launch.

## The process for each version (loop until it's right)

1. **Research.** A subagent goes to Awwwards and finds 3–5 real sites that fit the direction.
   - Record the URL, what to take (motion, layout, type, colour), and why.
   - The founder vets the chosen references before we build. Last time they vetted Locomotive.
   - Capture the references locally only, in `clone-workspace/<site>/`, which is gitignored and never published.
2. **Moodboard and storyboard.** A static page per version: palette swatches, type specimen, 2–3 logo options, the hero frame, and figures 1–4 redrawn in that language. It works like `storyboard/index.html`, which is what finally got agreement on the diagram. **The founder picks before anything is animated.**
3. **Build** on the version's branch. Reuse the story engine (`story.ts`, `field.ts`, `surface.ts`) and change how it draws and moves.
4. **QA loop, at least three rounds.**
   - Take headless screenshots at every figure, on desktop and at 375px (the `tools/story-shots.mjs` pattern).
   - A **critic subagent** that has not seen the build process reviews the screenshots against this brief and the references, and lists concrete problems.
   - Fix them, then repeat.
   - Keep the style checks green, with a per-version spec if needed.
5. **Deploy** and add the version to the hub.

## Logos

Explore 2–3 wordmark or logo options per version, shown in the moodboard.

Past lessons from the founder: they disliked the wordmark with dots and "Labs" as a superscript; the name as a point cloud in the field works. The founder "really likes the math logo". See open question 1.

## Lessons from last time (don't repeat them)

- **Agree the picture before animating.** Static frames first, every time.
- **Don't invent concepts.** Ground the drawing in the agreed argument.
- **Keep subagent briefs clean.** Give the founder's words plus the references, not my framing.
- **Show outputs unedited**, and let the founder choose.

## Open questions for the founder, to settle before building

1. **"The math logo."** Which one did you mean? There's the name drawn as a point cloud, a mathematical symbol such as ∴ ("therefore") or ⊢ ("proves"), or something you saw elsewhere. This decides where it gets used.
2. **Versions.** Organic, Proof and Atlas, or do you want to swap one?
3. **References.** Do you want to vet the Awwwards picks before we build, as last time? (Recommended.)
