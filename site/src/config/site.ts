// Single source of truth for the brand name, links and site-level copy (Organic direction).
// Every internal URL goes through `u()` so the site works under its base path (/organic/).
export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs. Agents entering firms, firms reorganising around them, and how that change spreads.',
} as const;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Join a site-relative path onto the base path: u('essays/') → '/organic/essays/'. */
export const u = (p = '') => `${BASE}/${p.replace(/^\//, '')}`;

export const nav = [
  { label: 'Home', href: u('') },
  { label: 'Essays', href: u('essays/') },
  { label: 'About', href: u('about/') },
  { label: 'Team', href: u('team/') },
  { label: 'Contact', href: u('contact/') },
];

// Figure legends for the home page. Written clean-room (one writer, from the founder's words and the
// Superdark essay), used verbatim. FOUNDER REVIEW: all of this copy is new and unreviewed.
export const figs = [
  {
    title: 'The firm',
    legend: 'A firm, described by its inputs and outputs. Three people carry out the steps in sequence, each following a plan issued by coordination, and output A crosses the boundary.',
  },
  {
    title: 'Execution inside',
    legend: "An agent arrives with the other inputs, and the boundary closes around it at the middle step. The firm now performs that step's execution itself, under the same plan.",
  },
  {
    title: 'Plan-making',
    legend: 'The plan to the middle step is withdrawn, and the agent receives an objective in its place. It generates alternative plans and selects one against the objective.',
  },
  {
    title: 'Reorganisation',
    legend: 'Coordination is spread across every step, and there is an agent at each one. People run the feedback loop between the firm and its environment; the boundary is redrawn, output A is discontinued, and outputs B and C are produced at higher throughput.',
  },
  {
    title: 'Diffusion',
    legend: 'The same reorganisation spreads from firm to firm across the economy at uneven rates. Some firms expand and split, and the firms next to them shrink.',
  },
];
