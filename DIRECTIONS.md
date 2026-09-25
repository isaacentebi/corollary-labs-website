# DIRECTIONS — exploring several versions of the site

The brief for the next phase. Read HANDOFF.md first, for the current state and the founder's settled preferences. This file covers what we do next.

## Why

The founder loves the current site. Their boss asked: *"¿podemos probar algo más orgánico? menos 'industrial'?"* ("can we try something more organic? less 'industrial'?").

So we turn the single Vercel site into **several complete, independent sites for the same company**, each one a different creative direction (structure, story, diagrams and identity included). A small hub page lets the founder and their boss move between them.

The founder's words: be super ambitious; go to Awwwards for inspiration again; use subagents; loop a lot until each one is right. Try different colours and different logos.

## Creative freedom (founder, explicitly)

> "They should be more creative with even the structure, with even the diagrams and the way to propose the company… You guys have amazing creativity. Don't try to dumb it down."

Each version is **not** a reskin. It may reinvent everything:
- the page structure;
- the story and its order;
- how many scenes or figures there are, or whether there are figures at all;
- the diagrams and the metaphor behind them;
- how the company introduces itself;
- the navigation model;
- the logo.

The current site (Plotter) is one answer, not the template.

**Fixed (keep this list short):**
- **What the company is about.** Agents entering firms; a firm understood through its inputs and outputs; reorganisation, not replacement ("more Schumpeterian… replacement is a second-order effect"); how that change spreads through the economy; cybernetic, economic and AI thinking. Never state the business model literally.
- **Copy quality.** No slogans, no aphorisms or paradoxes, no AI slop. Every claim literally true. Placeholders in [brackets] are fine where copy isn't settled. New copy goes through one clean-room writer and is shown to the founder unedited.
- **Craft.** Awwwards-level quality. Works at 375px. Respects reduced motion. Fast.
- **Pages that exist in some form:** Home, Essays (the MDX essays), About, Team, Contact.
- **Nothing published that isn't ours.** Reference captures stay local and gitignored.

Everything else the founder previously settled (no navbar, one accent colour, footer-only navigation, and so on) is a **default for Plotter**. Other versions may break it if the idea is better, and must say why in their pitch.

## Versions

| Key | Name | Seed idea (a prompt for the creative team, not a spec; each team may take it anywhere) |
|---|---|---|
| `plotter` | **Plotter** (the current site, the baseline) | Technical plotter drawing: hatching, a "boil" wobble on lines, mono labels, one green accent. What exists at `v2` and later. |
| `organic` | **Organic** (the boss's request) | Growth, not machinery. The firm is a cell or membrane, not a rectangle. Agents are organelles or nodes that bud and divide. Coordination dissolves like a nucleus dividing into a mycelial mesh. Diffusion looks like growth or spreading ink. Soft curves, warm natural palette (e.g. bone, moss, clay), a humanist serif, springy easing. |
| `proof` | **Proof** (Claude's pick) | The name taken literally: a corollary is what follows from a theorem. The page reads like a mathematical paper: numbered definitions and propositions, LaTeX-like typography (a Computer Modern style serif), diagrams as commutative diagrams (objects and arrows), and the homotopy as the centrepiece. Ink on cream, one accent. The logo is a mathematical mark; see open question 1. |
| `atlas` | **Atlas** (Claude's pick) | The economy as terrain. Contour lines and isolines, the field as a topographic map, diffusion as a front moving across a map, firms as survey points. Map colours (paper, sepia ink, one survey colour), a cartographic sans, slow and smooth camera moves. |

This is at most four versions (Plotter plus three new ones). Add more only if the founder asks.

## How the versions are hosted

- **Code.** One git branch per version: `direction/organic`, `direction/proof`, `direction/atlas`. `master` stays Plotter. Each branch may rebuild the site from scratch or reuse any part of it (the story engine, field, surface, essays). There is no shared theming layer; versions are free to diverge completely.
- **Deploys.** Each version is its own Vercel project with its own free URL, for example `corollarylabs-organic.vercel.app`. The current `corollarylabs.vercel.app` stays Plotter.
- **Hub.** `corollarylabs-directions.vercel.app` is one page listing every version, with a screenshot of each (hero and the fig 4 moment), a one-line idea, colour swatches, the logo, and a link.
- **Switcher.** Each version gets a small pill in the corner that jumps between versions. It must be easy to remove before launch.

## The process for each version (loop until it's right)

Each version is owned by its own **creative lead**, a subagent with real autonomy. It gets the fixed list above, the founder's own words, and the Superdark file. It does not get my framing or the current site's design decisions. It is told to be ambitious and to propose, not to copy Plotter.

1. **Research.** The creative lead, or a research subagent, goes to Awwwards (and beyond: studios, experimental sites, scientific and mathematical visualisation) and finds 3–5 real references.
   - Record the URL, what to take, and why.
   - The founder vets them.
   - Capture references locally only, in `clone-workspace/<site>/`, which is gitignored.
2. **Pitch.** A static page per version: the concept in a paragraph; the proposed page structure; how the company introduces itself; palette, type and 2–3 logo options; key frames of the main visual story. It works like `storyboard/index.html`, which is what got agreement last time. **The founder picks and redirects before anything is animated.**
3. **Build** on the version's branch.
4. **Critique loop, at least three rounds, more if needed.**
   - Take headless screenshots of every scene, on desktop and at 375px.
   - A **critic subagent**, separate and blind to the build process, judges the result against the pitch, the references and Awwwards quality, and lists concrete problems.
   - The creative lead fixes them, then repeat.
   - The founder sees the result only after it survives the critic.
5. **Deploy** to the version's Vercel URL and add it to the hub.

## Logos

Explore 2–3 wordmark or logo options per version, shown in the moodboard.

Past lessons from the founder: they disliked the wordmark with dots and "Labs" as a superscript; the name as a point cloud in the field works. The founder "really likes the math logo". See open question 1.

## Lessons from last time (don't repeat them)

- **Agree the picture before animating.** Static frames and a pitch first, every time.
- **Be inventive with form, not with facts.** Metaphors and structures are free; the ideas they carry must be real (Superdark ontology, the economics of reorganisation and diffusion).
- **Keep subagent briefs clean.** Give the founder's words plus the references, not my framing.
- **Show outputs unedited**, and let the founder choose.

## Founder's go-ahead (2026-09-24)

> "Let's keep the one we currently have because I do quite like it. And then we can do the next versions and then we can do some mergers between those. Have creativity… I want this to be a pleasant surprise. But sometimes they pick really shitty websites that are like very 2010 SaaS. And also like it's okay to choose very creative and abstract websites because the best websites there are not landing pages… They're sometimes more abstract from very creative designers. It's okay if we choose that as inspiration. And then do our spin. Understanding this is a startup."

What this settles:
- **Plotter stays** exactly as it is, on `master` at https://corollarylabs.vercel.app.
- **The new versions are a surprise.** The founder does not vet references or pitches in advance. The creative leads decide, and the blind critic loop is the quality gate.
- **Reference taste.** Draw on abstract, experimental, designer-led and portfolio sites, and on art, science and mathematical visualisation. **Not** product or landing pages, and nothing that looks like SaaS from around 2010: no hero-with-CTA, feature grids, testimonial carousels, gradient blobs or stock 3D. Then add our own spin, remembering this is a startup.
- **Mergers come later.** Once the versions exist, the founder will pick parts to combine, so each version should have strong, separable ideas.
- **The logo is open.** The founder "really likes the math logo". It's unclear which one they meant, so leads may explore mathematical marks alongside wordmarks.
- **Where files go.**
  - Reference captures (screenshots, HTML, extracts) go in `research/` (gitignored, never published).
  - Written reference notes with URLs go in `directions/<key>/REFERENCES.md`.
  - Pitch pages go in `directions/<key>/pitch.html`.

## Status (2026-09-24, round 2)

All eight versions are live on ONE site, https://corollarylabs.vercel.app. A switcher sits bottom-right: a pill on desktop, a "Version ▴" menu on phones.

| Path | Switcher name | Idea | Branch | Critic |
|---|---|---|---|---|
| `/` | Plotter | The original: technical plotter drawing, paper + green, long scroll story | `master` | — |
| `/organic/` | Organic | A firm as a cell under a lens. Refined after founder feedback: no labels, no figurines, three states, short | `direction/organic` | 8 |
| `/proof/` | Proof | A live mathematics paper; string diagrams; isotopy on the title plate | `direction/proof` | 8 |
| `/wild/` | Tableau | The site as one input–output table on black, orange diagonal | `direction/wild` | 8 |
| `/plotsoft/` | Plotter soft | Plotter softened: mist + jade, breathing squircle, springs, ~4 screens | `direction/plotsoft` | 8 |
| `/soft/` | Soft | Raked-line ground in mineral lilac; stones; closed outlines that reshape and never split; dusk pull-back | `direction/soft` | 7.5 (+ final fixes) |
| `/free/` | Loops | Truchet tiles that only rotate; acid spreads along connected loops; violet | `direction/free` | 7.5 (+ final fixes) |
| `/out/` | Interference | Two rulings; moiré fringes trace deformation; navigation by folding one sheet | `direction/out` | 7 (+ final fixes) |

Founder rules applied to every version:
- No copy: `[bracketed]` placeholders only, plain labels, no metaphors, no source mentions.
- A short home scroll that reaches About, essays and links quickly.
- References drawn mainly from Awwwards.

Build and deploy: `node tools/combine.mjs --deploy`. Use `--only=a,b` for a subset, or `--switcher-only` to rewrite only the switcher.

Next: the founder picks what to merge, then the copy gets written.

## Status (round 3: lineage directions)

Seven new directions were borrowed from design lineages: principles, not pastiche. Each was built as a sketch, reviewed by a blind critic, then promoted to a full build (Cybersyn, Score, Weave, Overprint, Tektonik) or given a polish round (Metabolism, Swiss). All are live under "Sketches" in the switcher and on https://corollarylabs.vercel.app/versions/.

| Path | Name | Lineage | Last critic |
|---|---|---|---|
| `/weave/` | Weave | Anni Albers, Jacquard | 7.5, with hero fixes applied after (critic expected ~8.5) |
| `/metab/` | Metabolism | Kurokawa, Tange, Isozaki | 7.5, the three blocking fixes applied after |
| `/score/` | Score | Cardew, Xenakis, Brown, Feldman, Stockhausen | 7.5, differentiation fixes applied after |
| `/swiss/` | Swiss | Müller-Brockmann, Crouwel, Gerstner | 7.5, fixes applied after; carmine accent |
| `/martens/` | Overprint | Karel Martens, Otl Aicher | 7, staging fixes applied after |
| `/supre/` | Suprematist (Tektonik) | Malevich, Lissitzky, early Hadid | 8, inner-page fixes applied after |
| `/cyber/` | Cybersyn | Cybersyn/Beer, Rams, Olivetti | 7.5, first-frame and climax fixes applied after |

Deploy tooling:
- `node tools/combine.mjs --snapshot` builds from each branch's last commit only.
- `--update=<key>` rebuilds one version in place.
- `tools/thumbs.mjs` refreshes the overview thumbnails.
