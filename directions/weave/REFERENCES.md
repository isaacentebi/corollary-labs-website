# Weave — references

**Concept.** The home page is one cloth, computed crossing by crossing in a shader. The graphite warp is the structure and the chalk weft is the work. At rest it is a smooth warp satin, and the name is woven into it as twill damask: Newsreader rasterised at thread resolution, with each glyph ringed by a two-cell halo of the original cloth. Once the cloth is woven, a first saffron thread (the only colour) draws itself down through the free third beside the name. A travelling opening pushes the warps apart, so they bend and stay parted in shadow around it, and nothing is cut. Behind it the cloth changes in steps, as a stepped diamond: plain weave, then a herringbone twill mirrored on the new thread, then Albers's *Black-White-Gray* block profile. The front is measured only along warp and weft, and each group of threads carries it at its own speed. The name is never cut into: the new structure weaves right up to each letter's halo, and threads that land inside the name move to the nearest gap between letters. Scrolling zooms into the story's own thread, framed where no other thread's re-weave can reach, with the live draft (threading, tie-up, treadling) on paper at the margins. The camera then pulls back to a wider cloth where other threads re-weave in diamonds. Visitors can insert up to eight threads by clicking, or with the Insert thread button. Essays are threads: the index strip is the navigation, and each essay's position follows its date.

## Awwwards

- **Cyd Stumpel — Portfolio 2025** (Site of the Day) — https://www.awwwards.com/sites/cyd-stumpel-portfolio-2025
  Take: restraint. The chrome around the one idea stays quiet: plain labels, rules, one type voice for UI, no ornament competing with the centrepiece.
- **Springs — Vide Infra** (Site of the Day + Developer Award, March 2026) — https://www.awwwards.com/sites/springs
  Take: a two-colour world (their deep greens; our indigo/flax) and a slow, scroll-bound camera that moves through one continuous surface instead of cutting between scenes.
- **Norform** (Awwwards-featured generative grid tool) — https://www.awwwards.com/inspiration/norform-the-generative-grid-based-design-tool
  Take: pattern produced by rules on a grid, not drawn. Every mark on this site (hero, titles, swatches, figures, the logo) comes from the same three weave rules in `site/src/lib/weave.ts`.

## Primary sources

- **Anni Albers, *On Weaving*** (1965; expanded ed. Princeton University Press, 2017) — https://press.princeton.edu/books/hardcover/9780691177854/on-weaving
  Draft notation (threading, tie-up, treadling, drawdown) as a drawing system; the drawdown is a product of structure and work. Borrowed literally: the close-up's margins are a live draft.
- **Anni Albers, *Design for Wall Hanging* (1926), *Wallhanging* (1926, silk) and *Black-White-Gray* (1927)** — https://www.moma.org/collection/works/3749 · https://www.albersfoundation.org/tags/wallhangings · https://harvardartmuseums.org/tour/764/slide/12325
  Colour from interlacing (two threads, many values); stripe rhythm in proportional widths. Borrowed: warp and weft stripes follow a short proportional series; damask lettering uses the same two threads for figure and ground.
- **Gunta Stölzl, *5 Chöre* (1928), Jacquard** — https://bauhauskooperation.com/knowledge/the-bauhaus/works/weaving/five-choirs
  Jacquard at the Bauhaus: symmetry and mirroring produced by the machine. Borrowed: the new structure is a point draw mirrored on the new thread.
- **Portrait of Joseph-Marie Jacquard, woven silk, 1839** (Didier, Petit et Cie; ~24,000 punched cards) — https://www.metmuseum.org/art/collection/search/222531 · https://www.cooperhewitt.org/2013/01/21/meet-monsieur-jacquard/
  Every warp individually addressable by a card; an image made of nothing but over/under. Borrowed: the name is woven, not typeset; each crossing is one bit.

## Identity

- **Palette.** Albers, *Black-White-Yellow*, and the black-and-white silk Jacquard portrait: graphite warps `#18181a / #202023 / #161618 / #27272b` in proportional bands, chalk weft and paper `#ebe9e3`, ink `#18181a`, rule `#c9c6bd`. The single accent is saffron `#f2a93b`, used only for new threads (and link underlines). No blue, no flax: nothing reads as denim.
- **Type.** Newsreader (variable, optical sizes) for reading and for the woven lettering; Martian Mono (condensed axis) for labels and the draft's micro type.
- **Logo options.** (1) The woven wordmark: "Corollary / Labs" as twill damask on satin (hero, page titles). (2) The mark: an 11 × 11 drawdown with the saffron thread as its spine (header, footer). (3) Unbuilt: the threading draft alone, an 8-shaft straight draw breaking into two blocks at one saffron cell.

## Structure

Home: one sticky cloth (~1.6 screens of scroll): woven name + the first thread drawn down in the hero → close-up as the story's thread is drawn down (draft appears) → re-weave (draft rewrites) → pull-back to a wider cloth with other threads' diamonds. An opaque graphite caption band (caption, Insert thread, count) sits at the foot of the cloth. Then [About] (one merged link), essays as hairline threads, About / Team / Contact. Fixed header: opaque graphite with a hairline over the cloth, paper after; one 44px row on phones. Inner pages: a woven label title, then paper; the About, Team, Contact and essay pages each carry a cloth whose thread re-weaves when it scrolls into view.
