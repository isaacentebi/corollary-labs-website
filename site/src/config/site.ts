// Single source of truth for names, links and copy of the Tableau (wild) direction.
// Copy is the shared IA brief's temporary copy, verbatim. Everything in [brackets] is a placeholder.
const B = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => B + p.replace(/^\//, '');

export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  // while the address is a placeholder, "Contact us" goes to the contact block; set to `mailto:…` once it exists
  contactHref: url('#contact'),
  year: 2026,
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
} as const;

export const hero = {
  headline: 'We deploy AI agents inside organisations and rebuild the operations around them.',
  subline: 'Agent design, model fine-tuning, systems integration and evaluation, from first workflow to production.',
};

export const nav = [
  { n: '01', label: 'Capabilities', href: url('#capabilities') },
  { n: '02', label: 'Approach', href: url('#approach') },
  { n: '03', label: 'Company', href: url('about/'), match: ['about', 'team'] },
  { n: '04', label: 'Contact', href: url('#contact') },
];

export const footerNav = [
  { label: 'Capabilities', href: url('#capabilities') },
  { label: 'Approach', href: url('#approach') },
  { label: 'Research', href: url('essays/') },
  { label: 'About', href: url('about/') },
  { label: 'Team', href: url('team/') },
  { label: 'Contact', href: url('contact/') },
];

export const capabilities = [
  { t: 'Agent deployment', d: 'Agents that execute defined workflows inside existing systems, with permissions, logging and human review.' },
  { t: 'Model fine-tuning', d: 'Models adapted and evaluated on your data for the specific tasks your agents perform.' },
  { t: 'Systems integration', d: 'Connections to the systems where work already happens: ERP, CRM, data warehouses and internal tools.' },
  { t: 'Evaluation and governance', d: 'Continuous measurement of accuracy, cost and risk, with an audit trail for every action an agent takes.' },
];

export const approach = {
  intro: 'We start from the workflow: its inputs, its outputs and the decisions made inside it. We then design the organisation that works with the agents, not only the agents.',
  // the four beats of the table figure
  beats: ['The organisation', 'An agent enters', 'It reorganises', 'The change spreads'],
  principles: [
    { t: 'Workflow first', d: 'We map how work is actually done before choosing a model.' },
    { t: 'Design the reorganisation', d: 'Roles, handoffs and controls change when agents arrive. We plan that change.' },
    { t: 'Measure in production', d: 'Every deployment reports on accuracy, cost and time saved.' },
  ],
};

export const research = { intro: 'Essays on agents, organisations and how new technology spreads.' };

export const company = {
  about: 'Corollary Labs is an AI company.',
  aboutPh: '[About — founding story and team, one paragraph]',
  team: Array.from({ length: 4 }, () => ({ name: '[Name]', role: '[Role]' })),
};

export const contact = { line: 'Deploying agents in your organisation? Talk to us.' };
