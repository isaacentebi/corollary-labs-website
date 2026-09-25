// Single source of truth for the brand name, links and site-level copy (Organic direction).
// Every internal URL goes through `u()` so the site works under its base path (/organic/).
export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Join a site-relative path onto the base path: u('essays/') → '/organic/essays/'. */
export const u = (p = '') => `${BASE}/${p.replace(/^\//, '')}`;

/** A mailto only once a real address exists; until then the placeholder stays plain text. */
export const mailHref: string | null = site.email.startsWith('[') ? null : `mailto:${site.email}`;
/** "Contact us": the mailto when there is one, otherwise the closing contact block on home. */
export const contactHref = mailHref ?? u('#contact');

// Main nav: never Research. "Company" is About (with Team).
export const nav = [
  { label: 'Capabilities', href: u('#capabilities') },
  { label: 'Approach', href: u('#approach') },
  { label: 'Company', href: u('about/') },
  { label: 'Contact', href: u('#contact') },
];

export const footNav = [
  { label: 'Capabilities', href: u('#capabilities') },
  { label: 'Approach', href: u('#approach') },
  { label: 'Research', href: u('essays/') },
  { label: 'About', href: u('about/') },
  { label: 'Team', href: u('team/') },
  { label: 'Contact', href: u('#contact') },
];

export const capabilities = [
  { title: 'Agent deployment', text: 'Agents that execute defined workflows inside existing systems, with permissions, logging and human review.' },
  { title: 'Model fine-tuning', text: 'Models adapted and evaluated on your data for the specific tasks your agents perform.' },
  { title: 'Systems integration', text: 'Connections to the systems where work already happens: ERP, CRM, data warehouses and internal tools.' },
  { title: 'Evaluation and governance', text: 'Continuous measurement of accuracy, cost and risk, with an audit trail for every action an agent takes.' },
];

// Approach: the four beats of the one drawing, each a settled story position `s` of the specimen.
export const beats: { n: string; title: string; s: number }[] = [
  { n: '01', title: 'The organisation', s: 0.9 },
  { n: '02', title: 'An agent enters', s: 1.95 },
  { n: '03', title: 'It reorganises', s: 3.95 },
  { n: '04', title: 'The change spreads', s: 5.3 },
];

export const principles = [
  { title: 'Workflow first', text: 'We map how work is actually done before choosing a model.' },
  { title: 'Design the reorganisation', text: 'Roles, handoffs and controls change when agents arrive. We plan that change.' },
  { title: 'Measure in production', text: 'Every deployment reports on accuracy, cost and time saved.' },
];

export const team = Array.from({ length: 4 }, () => ({ name: '[Name]', role: '[Role]' }));
