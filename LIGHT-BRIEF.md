# Corollary Labs — brief

## Who they are
Corollary Labs is an early-stage AI company. It deploys AI agents inside organisations: it builds the agents, adapts the models, and connects them to the systems where work happens. It then helps each organisation reorganise around them. It also studies, and writes about, how this change spreads through the economy.

## How they think
This is the part that should make the site unlike any other AI company's.

- **A firm is best understood by its inputs and outputs.** Automation is a firm producing an input it used to be supplied with: first execution, then planning. When that happens, the line between inside and outside the firm moves. This comes from *The Superdark Factory* (`/Users/isaacentebi/Downloads/Superdark Factory.md`). Borrow its ontology, not its speculation about "darkness" or self-directing factories.
- **Change arrives as new combinations** (Schumpeter). Old arrangements give way to new ones: creative destruction and reorganisation. People being replaced is at most a second-order effect.
- **Reorganisation is a continuous deformation.** The organisation takes a new shape without being torn, like a homotopy or isotopy. Where it can't bend, it has to be cut and re-joined.
- **The change diffuses.** It spreads from firm to firm, unevenly, through the economy.

Express this through form, light, space and motion. Do not use labelled diagrams or step-by-step legends. The visitor should feel the idea before reading about it.

## What the site must do
- Say clearly, within seconds, what the company is. It must feel like a serious company, not a gallery piece and not a template.
- Pages: Home, a page or section on how they think, Research (the essays, which are secondary), Company (About and Team), and Contact.
- Copy should be sparse, literal and precise: no slogans, no metaphor-heavy prose, nothing untrue. Where you aren't sure, leave a `[placeholder]`. Every line you write will be reviewed by the founder.

## Aesthetic, in the founder's words
> Luminous perceptual abstraction, especially art influenced by the Light and Space movement. I like work focused on light, gradients, atmosphere, color, reflection, transparency, and minimal forms. I especially like pieces where light seems to come from inside the artwork, creating a dreamy, ethereal, spatial feeling.
>
> Artists I like or want to explore include: Miya Ando, Jonny Niesche, Wanda Koop, Rachelle Bussières, Ana Montiel, Fabiola Menchelli, Andy Moses, Casper Brindle, Ruth Pastine, Dion Johnson, Scott Sueme, Anne Vieux, Gabriele Evertz, Douglas Witmer, Astrid Sylwan, Peter Zimmermann, Heather Gwen Martin, Perla Krauze, José Dávila, and Ilán Rabchinskey. Historical references include James Turrell, Robert Irwin, Larry Bell, Helen Pashgian, and Peter Alexander. Useful terms: Light and Space, perceptual abstraction, luminous abstraction, chromatic abstraction, atmospheric abstraction, and post-minimalism.

- Study the actual works. Awwwards is optional, for craft and motion only.
- The bar is Awwwards Site of the Year.

## Practical
- The site is Astro, in `site/`. The essays are MDX in `site/src/content/essays` and can stay lorem ipsum.
- Build under your base path (`base: '/<key>'`, with `import.meta.env.BASE_URL` for every internal link and asset).
- Keep the bottom-right ~220×48px corner free for a version switcher.
- It must work at 375px, respect reduced motion, draw only when something changes, and stay fast.
- For `node_modules`, use `cd site && ln -s /Users/isaacentebi/Desktop/Corollary_Website/site/node_modules node_modules`, or run `npm install` if you add packages.
- Take screenshots with Playwright at `/Users/isaacentebi/Desktop/Corollary_Website/tools/node_modules/playwright/index.mjs`.
