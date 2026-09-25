# Cyber: references

**Concept.** The site is an instrument you use, not a page you read. It borrows the working logic of the Cybersyn operations room: a shared wall of screens, big honest controls on the armrests, feedback you can see. It also borrows Braun and Olivetti product design: a warm grey housing, a graphite face, one signal colour, lamps that are either on or off, and controls that actually do something. The home page is a single face covered in small gauges, one needle each. Together they form a field in equilibrium. If you push them with the pointer, they swing and come back. That is a disturbance the system absorbs, and the needles are coupled to their neighbours. Then an agent enters as a yellow lamp. It does not disturb the equilibrium; it moves it. A damped step spreads outward from the lamp, and the needles swing past their new positions and settle into a new arrangement organised around it. Needles tint yellow only while they are changing. The face then pulls back to show that this organisation is one screen on a wall of linked ones, and the change spreads screen to screen and across their shared edges. A few screens never take it up. Every control is real. A rotary selector is the site navigation. A slide switch turns motion on and off. A tuning scale with four lamps shows where you are in the story and lets you drag through it. Clicking the face before the agent enters chooses where it will enter.

## Primary sources (the lineage)

- Project Cybersyn, operations room (Santiago, 1972–73; Beer, Bonsiepe and team): https://en.wikipedia.org/wiki/Project_Cybersyn. Taken: the room as one shared view, a wall of screens and armrest controls. The pull-back to a wall of panels comes from here.
- Gui Bonsiepe (Ulm, then INTEC Chile): https://en.wikipedia.org/wiki/Gui_Bonsiepe. Taken: information design built on Gestalt principles, flat and legible, no ornament.
- MIT Architecture, "Designing a Revolution" (on the opsroom's design): https://architecture.mit.edu/news/designing-revolution
- Viable System Model (Stafford Beer): https://en.wikipedia.org/wiki/Viable_system_model. Taken: recursion, meaning each system is one unit of a larger system of the same kind (a panel inside the wall).
- Dieter Rams, the ten principles of good design (Vitsœ): https://www.vitsoe.com/us/about/good-design. Taken: honest, unobtrusive and "as little design as possible". There is one accent, and it is used only for what changes.
- Braun ET 66 calculator (Rams and Lubs), V&A: https://collections.vam.ac.uk/item/O1360553/et66-calculator-et66-calculator-dieter-rams/. Taken: colour coding by function, where the single yellow key becomes our signal colour. Also the round keys, which became the lamps.
- Mario Bellini, Olivetti Divisumma 18 (1972), MoMA: https://www.moma.org/collection/works/3805. Taken: a tactile, friendly way of operating a machine (the knob, the keys, the press states).
- Olivetti Elea 9003 (Sottsass, 1959) console: https://en.wikipedia.org/wiki/Olivetti_Elea. Taken: consoles covered in indicator lights, a layout scaled for people.

## Awwwards

- Midlife Engineering, SOTD 18 Jan 2026: https://www.awwwards.com/sites/midlife-engineering. Taken: "presence, stillness, subtle control", a calm interactive instrument with a two-colour palette.
- Igloo Inc (abeto and Bureaux), Site of the Year 2024 nominee: https://www.awwwards.com/sites/igloo-inc. Taken: a short scroll of three sections where each section is an interactive state, not a slide. Cool greys and one dark.
- Oryzo AI (Lusion), SOTD and SOTM April 2026: https://www.awwwards.com/sites/oryzo-ai. Taken: one product-object carries the whole page, with a single signal colour on a dark ground.

## Identity

- Palette: housing `#dcdad4` (warm instrument grey), graphite face `#1c1d1f` with gutters `#141516`, ink `#1b1b1a`, and a single signal colour, yellow `#f2bf1b`, used only for the agent, for change in progress and for lit lamps.
- Type: Instrument Sans (variable, text and display) with Martian Mono (instrument markings: labels, numbers and dates, set in small caps with tracking). Both are self-hosted woff2 files.
- Wordmark: "corollary labs" in lowercase Instrument Sans semibold with tight tracking, in the Olivetti lowercase tradition, beside the mark.
- Mark: a gauge whose needle has left its old set point (the short tick at 12 o'clock), with a yellow hub. It stands for an equilibrium that has moved.

## Full build: what carries the idea

- Renderer: WebGL2 instanced signed-distance gauges (ring, needle, hub), lamps, rings and panels, all in screen space so they stay crisp at every zoom. LOD comes from ring alpha, minimum needle length and width, and a hub drawn only on large gauges. It falls back to Canvas 2D (`?2d`). Frames render on demand only: the page makes 0 animation-frame calls per second when idle.
- Home: four states on one scroll (about 2 screens). (1) Equilibrium: a ghost lamp glides in on load and pushes the field, which springs back and teaches that it can be pushed. A crosshair and ghost follow the pointer, a click or the arrow keys choose the entry point. (2) The agent enters along the flow; on arrival a double pulse, and nearby needles lean towards it. (3) A damped front moves the set point; needles overshoot and settle and are tinted only while moving. (4) One continuous log-space pull-back centred on the home panel onto a 3×3 wall. Each organisation answers differently (handedness, spiral, gain, core). Fronts relay organisation to organisation across the gutters; two holdouts are disturbed as fronts pass and then return to their old state.
- Controls: the rotary selector is spring-driven with detents: drag it and it resists, then snaps. The switches have press states and spring throws. The story scale can be dragged, flicked with inertia (it settles into the nearest detent) or clicked on a detent. Optional synthesised sounds are off by default.
- Pages: every page has a face, carried across pages by cross-document view transitions. Essays: one lamp per essay, and pointing at a row pings its lamp. Essay: a sticky strip with one lamp per section, where the front moves through as you read, plus a light-faced reading gauge. About: the reorganised field settling as it arrives. Contact: one lamp. Team: four large gauges at different angles. 404: an empty field. The footer is a rating plate.
