// All copy on the site lives here so the founder can review it in one place.
// [Bracketed] text is a placeholder: unknown facts are never invented.

export const site = {
  name: 'Corollary Labs',
  homeTitle: 'Corollary Labs — AI agents inside organisations',
  email: '[email]',
  location: '[City]',
  founded: '[Year]',
  entity: '[Legal entity]',
  description: 'Corollary Labs deploys AI agents inside organisations and helps them reorganise around them.',
};

export const nav = [
  { href: '/#what-we-do', label: 'What we do' },
  { href: '/thinking/', label: 'How we think' },
  { href: '/company/', label: 'Company' },
  { href: '/contact/', label: 'Contact' },
];

export const footerNav = [
  { href: '/#what-we-do', label: 'What we do' },
  { href: '/thinking/', label: 'How we think' },
  { href: '/research/', label: 'Research' },
  { href: '/company/#about', label: 'About' },
  { href: '/company/#team', label: 'Team' },
  { href: '/contact/', label: 'Contact' },
];

export const hero = {
  headline: 'We deploy AI agents inside organisations, then help each organisation reorganise around them.',
  sub: 'We build the agents, adapt the models and connect them to the systems where work happens. We also study how AI adoption spreads through the economy.',
  primary: 'Contact',
  secondary: 'How we think',
};

export const work = {
  title: 'What we do',
  items: [
    { name: 'Agents', text: 'We build agents that carry out defined work inside an organisation’s existing systems.' },
    { name: 'Models', text: 'We adapt and evaluate models for the specific tasks those agents perform.' },
    { name: 'Integration', text: 'We connect agents to ERP, CRM, data warehouses and internal tools.' },
    { name: 'Reorganisation', text: 'We plan how roles, handoffs and controls change when agents arrive, and help the organisation make those changes.' },
  ],
};

export const thinking = {
  title: 'How we think',
  intro: 'Five ideas shape how we deploy agents and what we study.',
};

// The five ideas. `line` is used on the home page; `body` on How we think.
export const ideas = [
  {
    key: 'io',
    title: 'Inputs and outputs',
    line: 'A firm is best understood by its inputs and outputs.',
    body: [
      'We describe an organisation by what it takes in and what it produces, before we describe its structure.',
      'Where a workflow starts, what it needs and what it must deliver are the first things we map.',
    ],
  },
  {
    key: 'auto',
    title: 'Automation',
    line: 'Automation is a firm producing an input it used to be supplied with: first execution, then planning.',
    body: [
      'An agent that carries out a task takes execution inside the firm. An agent that decides how a task should be done takes planning inside as well.',
      'Each time this happens, the line between inside and outside the firm moves.',
    ],
  },
  {
    key: 'combine',
    title: 'New combinations',
    line: 'Change arrives as new combinations.',
    body: [
      'The gains from a new technology come from new arrangements of work, not from inserting it into the old one.',
      'People being replaced is, at most, a second-order effect.',
    ],
  },
  {
    key: 'deform',
    title: 'Continuous deformation',
    line: 'Roles, handoffs and controls change shape while the organisation keeps working. Where a change can’t be gradual, it is made as a cut and a re-join.',
    homeLine: 'Some changes happen gradually; some have to be made in one step.',
    body: [
      '[Placeholder: how we plan changes that cannot be gradual.]',
    ],
  },
  {
    key: 'diffuse',
    title: 'Diffusion',
    line: 'Adoption of AI agents spreads from firm to firm, unevenly, through the economy.',
    body: [
      'Adoption moves between firms through suppliers, customers, competitors and people, at different speeds in different places.',
      '[Placeholder: what we publish on how adoption spreads.]',
    ],
  },
];

export const practice = {
  title: 'How we work',
  items: [
    { name: 'Start from the workflow', text: 'We map a workflow’s inputs, outputs and decisions before choosing a model.' },
    { name: 'Measure in production', text: 'We set up every deployment to report on accuracy, cost and time.' },
  ],
  engagements: '[Engagements: sectors, length, data handling]',
};

export const research = {
  title: 'Research',
  intro: 'Essays on agents, organisations and how new technology spreads.',
  all: 'All research',
};

export const company = {
  title: 'Company',
  about: 'Corollary Labs deploys AI agents inside organisations and helps them reorganise around them.',
  aboutMore: '[About: founding story, one paragraph.]',
  team: [
    { name: '[Name]', role: '[Role]' },
    { name: '[Name]', role: '[Role]' },
    { name: '[Name]', role: '[Role]' },
    { name: '[Name]', role: '[Role]' },
  ],
  more: 'About the company',
};

export const contact = {
  title: 'Contact',
  line: 'To discuss a deployment or our research, write to us.',
};
