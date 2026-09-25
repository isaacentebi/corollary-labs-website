# IA-BRIEF — "make it feel like a company" (applies to every version)

This is an exercise from the founder. Every version keeps its design language but gets the SAME company structure and the SAME plain copy below, so they can be compared as company sites.

> "Some of them, the design language is cool but it's not clear what it is… not all of them need these complex animations in that order without better hierarchy… Essays of course cannot be one of the main pages on the nav bar… it should feel like a company… simple copy, very Palantir-esque: deploying AI agents, fine-tuning models… diagnostic, without metaphors, just to see how it looks. Then we'll sprinkle our own philosophy into how we do it, which is where the diagrams fit… it has to be more integrated with the company, instead of just a regular landing page."

## Hierarchy (non-negotiable)

1. **The first screen says what the company is within 3 seconds.** It shows the name, the headline and the subline below, one primary action ("Contact us") and one secondary action ("Our approach").
   - The version's signature visual is the hero's living backdrop or object: interactive and alive.
   - The hero is NOT a mandatory multi-step scroll story. No scroll-jacking before the headline has been read.
2. **Capabilities.** What the company does, in the version's design language. Four items, plain.
3. **Approach.** How we do it. This is where the version's diagram or story lives: the organisation → an agent enters → the organisation reorganises → the change spreads.
   - Keep it short (at most ~1.5 viewport heights if scroll-driven, or one interactive figure).
   - Label the beats with the plain legend below.
   - This is where the signature idea earns its place.
4. **Research.** The essays, shown as the company's research and writing: the latest 3 plus a link to all.
   - It is secondary: NOT in the main nav. Reachable from the footer and from this section.
   - Pages stay at their current URLs; label them "Research".
5. **Company.** Short About and Team blocks on home, linking to their pages.
6. **Contact.** A clear closing block with the email, then the footer.

The design language should integrate with the company. Capabilities, approach and research should all speak it, not just the hero. Avoid a generic landing-page template: no feature-card grids with icons, no testimonial carousels, no logo walls, no gradient blobs.

## Navigation

- **Main nav:** `Capabilities · Approach · Company · Contact`, with anchors or pages as fits the version. "Company" goes to About (with Team).
- **Footer:** `Capabilities · Approach · Research · About · Team · Contact`, plus the email and ©.
- **Essays** are called **Research** everywhere in the UI and never appear in the main nav.
- A main nav at the top is allowed in every version for this exercise.

## Copy (use verbatim; temporary; the founder will replace it later)

**Hero**
- H1: **Corollary Labs**
- Headline: **We deploy AI agents inside organisations and rebuild the operations around them.**
- Subline: Agent design, model fine-tuning, systems integration and evaluation, from first workflow to production.
- Actions: **Contact us** (primary, mailto) · **Our approach** (secondary, anchor)

**Capabilities** (section title: Capabilities)
1. **Agent deployment.** Agents that execute defined workflows inside existing systems, with permissions, logging and human review.
2. **Model fine-tuning.** Models adapted and evaluated on your data for the specific tasks your agents perform.
3. **Systems integration.** Connections to the systems where work already happens: ERP, CRM, data warehouses and internal tools.
4. **Evaluation and governance.** Continuous measurement of accuracy, cost and risk, with an audit trail for every action an agent takes.

**Approach** (section title: Approach)
- Intro: We start from the workflow: its inputs, its outputs and the decisions made inside it. We then design the organisation that works with the agents, not only the agents.
- Legend for the diagram or story beats:
  - `01 The organisation`
  - `02 An agent enters`
  - `03 It reorganises`
  - `04 The change spreads`
- Three principles:
  1. **Workflow first.** We map how work is actually done before choosing a model.
  2. **Design the reorganisation.** Roles, handoffs and controls change when agents arrive. We plan that change.
  3. **Measure in production.** Every deployment reports on accuracy, cost and time saved.

**Research** (section title: Research)
- Intro: Essays on agents, organisations and how new technology spreads.
- The latest 3 essays (titles and dates from the MDX), then "All research →".

**Company** (section title: Company)
- About: Corollary Labs is an AI company. [About — founding story and team, one paragraph]
- Team: [Name — Role] ×4 (placeholders), then "About the company →".

**Contact** (section title: Contact)
- Line: Deploying agents in your organisation? Talk to us.
- Email: [EMAIL] (plain text until a real address exists; don't make `mailto:[EMAIL]` a live link).

**Meta description:** Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.

Everything else (Team names, About paragraph, location, founding year) stays as a [bracketed] placeholder. No other new copy: no slogans, no metaphors, no mention of any source essay.

## Unchanged rules
- base path `/<key>` and `import.meta.env.BASE_URL` for every internal link and asset;
- the bottom-right ~220×48px corner stays free for the switcher;
- works at 375px;
- respects prefers-reduced-motion;
- renders on demand (no idle redraw loop);
- fast.

## Process
- Work on your version's branch, in its existing worktree.
- Do at least 2 rounds of screenshot self-critique at 1440×900 and 375×812. Check that the first screen is instantly clear, that the page reads as a company, and that the signature is still there, now integrated.
- Save the final screenshots to `/private/tmp/claude-501/-Users-isaacentebi-Desktop-Corollary-Website/41c31371-b071-43b9-8e3a-b170c5838910/scratchpad/ia/<key>/`, including one full-page home capture per viewport.
- Commit.
- Report in 5 lines: what changed, where the signature now lives, and any problems.
