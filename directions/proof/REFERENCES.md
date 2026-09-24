# Proof — references

Captures (local only, gitignored) are in `research/proof/`. Nothing below is copied into the site; we take principles, not assets.

## 1. Byrne's Euclid, reproduced by Nicholas Rougeux
https://www.c82.net/euclid/ (the 1847 Oliver Byrne edition, rebuilt for the web; the live site sits behind a Cloudflare check, so no capture was taken)

- **Take:** a strictly limited graphic grammar. Byrne used four colours, two line styles (solid/dashed) and two weights, and let the geometry do the rest. Diagrams are *part of the sentence*: shapes in the proof text are the shapes in the figure, and the web version makes them hoverable.
- **Why:** it is the best-known proof that mathematical exposition can be beautiful without decoration. Our version adopts the same discipline: ink, one blue, solid vs dashed, two weights. Symbols in the text (f, g, P, O) are live links to the wires and boxes they name.

## 2. Bartosz Ciechanowski — long-form interactive explanations
https://ciechanow.ski/gears/ (captures: `ciechanowski*.png`)

- **Take:** every figure sits inside the reading flow and can be scrubbed; text and figure alternate at a steady rhythm; motion only ever shows something the text states.
- **Why:** the home page should be read, not watched. Instead of one sticky stage with captions (Plotter), each numbered statement owns its own live figure, scrubbed by scroll or by a slider.

## 3. Lean Blueprint dependency graph (Tao et al., Polynomial Freiman–Ruzsa formalisation)
https://teorth.github.io/pfr/blueprint/dep_graph_document.html (capture: `pfr-dep.png`)

- **Take:** a paper's statements drawn as a directed graph of what depends on what, coloured by status.
- **Why:** it becomes our navigation. The home page's margin shows the statements (Definitions → Theorem → Corollary → Remarks) as a small dependency graph; the reader's position lights up the node, clicking jumps to it. Navigation that is literally the logical structure of the page, not a menu.

## 4. Ryoji Ikeda — datamatics
https://www.ryojiikeda.com/project/datamatics/ (captures: `ikeda*.png`)

- **Take:** density as an aesthetic. Hairline strokes, extreme contrast, huge fields of small, regular marks; black-and-white with a single thread of colour.
- **Why:** the hero and the diffusion plate are fields of many thin wires and small solid boxes. The picture should feel like a large formal object, not an illustration. The one inverted (ink) plate in the page comes from here.

## 5. Tauba Auerbach — artist site
https://taubaauerbach.com/ (capture: `auerbach.png`)

- **Take:** an artist whose work is about topology, folding and deformation, presenting it with almost no interface: one object, a flat field, no chrome.
- **Why:** permission for restraint. The title plate is one object (the string diagram) and one name, nothing else on screen.

## Source of the diagram grammar (not a website)

- A. Joyal, R. Street, *The geometry of tensor calculus I*, Advances in Mathematics 88 (1991) 55–112.
- A. Joyal, R. Street, D. Verity, *Traced monoidal categories*, Math. Proc. Cambridge Philos. Soc. 119 (1996) 447–468.
- P. Selinger, *A survey of graphical languages for monoidal categories*, in New Structures for Physics, Lecture Notes in Physics 813, Springer (2011) 289–355.

String diagrams are the standard picture of a process with typed inputs and outputs, which is exactly the Superdark definition of a firm. Their fundamental theorem (diagrams related by planar isotopy denote the same morphism) gives the founder's isotopy/homotopy interest a precise, literally true role in the story.

## Classification codes used on the page (verified)

- JEL O33 — Technological Change: Choices and Consequences; Diffusion Processes.
- JEL L23 — Organization of Production.
- MSC2020 18M30 — String diagrams and graphical calculi.
- MSC2020 18M35 — Categories of networks and processes, compositionality.
