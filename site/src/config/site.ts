// The five regions of the sheet, in their fixed left-to-right order: the company's main navigation.
// Navigation never removes a region: the active one is stretched open, the others are folded to strips.
// Research (the essays) is not a region: it opens with every region folded, and is reached from the footer and home.
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => BASE + p.replace(/^\//, '');

export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  description: 'Corollary Labs deploys AI agents inside organisations and rebuilds the operations around them.',
};
// plain text until a real address exists: the Contact action opens an empty message
export const mailHref = site.email.startsWith('[') ? 'mailto:' : `mailto:${site.email}`;

export const copy = {
  headline: 'We deploy AI agents inside organisations and rebuild the operations around them.',
  subline: 'Agent design, model fine-tuning, systems integration and evaluation, from first workflow to production.',
  capabilities: [
    { title: 'Agent deployment', body: 'Agents that execute defined workflows inside existing systems, with permissions, logging and human review.' },
    { title: 'Model fine-tuning', body: 'Models adapted and evaluated on your data for the specific tasks your agents perform.' },
    { title: 'Systems integration', body: 'Connections to the systems where work already happens: ERP, CRM, data warehouses and internal tools.' },
    { title: 'Evaluation and governance', body: 'Continuous measurement of accuracy, cost and risk, with an audit trail for every action an agent takes.' },
  ],
  approachIntro: 'We start from the workflow: its inputs, its outputs and the decisions made inside it. We then design the organisation that works with the agents, not only the agents.',
  legend: ['The organisation', 'An agent enters', 'It reorganises', 'The change spreads'],
  principles: [
    { title: 'Workflow first', body: 'We map how work is actually done before choosing a model.' },
    { title: 'Design the reorganisation', body: 'Roles, handoffs and controls change when agents arrive. We plan that change.' },
    { title: 'Measure in production', body: 'Every deployment reports on accuracy, cost and time saved.' },
  ],
  researchIntro: 'Essays on agents, organisations and how new technology spreads.',
  about: 'Corollary Labs is an AI company.',
  contactLine: 'Deploying agents in your organisation? Talk to us.',
};

export type RegionKey = 'home' | 'capabilities' | 'approach' | 'company' | 'contact';
export const regions: { key: RegionKey; label: string; href: string }[] = [
  { key: 'home', label: 'Corollary Labs', href: url('') },
  { key: 'capabilities', label: 'Capabilities', href: url('capabilities/') },
  { key: 'approach', label: 'Approach', href: url('approach/') },
  { key: 'company', label: 'Company', href: url('about/') },
  { key: 'contact', label: 'Contact', href: url('contact/') },
];
export const footerNav = [
  { label: 'Capabilities', href: url('capabilities/') },
  { label: 'Approach', href: url('approach/') },
  { label: 'Research', href: url('essays/') },
  { label: 'About', href: url('about/') },
  { label: 'Team', href: url('team/') },
  { label: 'Contact', href: url('contact/') },
];
export const indexOf = (k: RegionKey) => regions.findIndex((r) => r.key === k);
