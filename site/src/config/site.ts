// Single source of truth for names, links and the story copy of the Tableau (wild) direction.
const B = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => B + p.replace(/^\//, '');

export const site = {
  name: 'Corollary Labs',
  email: '[EMAIL]',
  year: 2026,
  description: 'Corollary Labs is a company.',
} as const;

export const nav = [
  { n: '01', label: 'Essays', href: url('essays/') },
  { n: '02', label: 'About', href: url('about/') },
  { n: '03', label: 'Team', href: url('team/') },
  { n: '04', label: 'Contact', href: url('contact/') },
];

// Home story captions. FOR FOUNDER REVIEW. Lines may contain <sub> markup.
// Set A from one clean-room writer (read Chapter I of the Superdark essay + the founder's words), used verbatim,
// except state 4 line 2 and state 6 (both lines), rewritten by the creative lead after the first critique
// (the old lines described firms leaving the table, which is no longer drawn, and narrated the animation).
// Set B (same writer, essay's own terms) is kept below, unused, so the founder can choose.
export const states: { title: string; lines: [string, string] }[] = [
  { title: 'The Table', lines: ['Thirty-two firms. Each column lists what one firm takes from each firm, itself included.', 'Below the rule: execution, plans and objectives, supplied to each firm by people.'] },
  { title: 'One Firm', lines: ['One column, enlarged: the inputs of a single firm, read top to bottom.', 'Inputs from other firms, then execution, plans, objectives. The output sits at the foot.'] },
  { title: 'Execution', lines: ['The execution entry leaves the supplied rows and enters the diagonal cell.', "Agents produce the firm's execution inside it. Orange marks self-supplied input."] },
  { title: 'Plans', lines: ['The plans entry follows the same path into the diagonal.', 'Of the three rows supplied by people, objectives alone remain outside the firm.'] },
  { title: 'Reorganisation', lines: ['Rows and columns are reordered, and the table resolves into new blocks.', 'The entries change first; each firm keeps its number as its row and column move.'] },
  { title: 'Diffusion', lines: ["The change passes to the firm's largest trading partners, then to theirs.", 'Each round reaches further, at uneven rates. Diagonals turn orange column by column.'] },
  { title: 'Homotopy', lines: ["Each cell's height is its input coefficient.", 'As t runs from 0 to 1, the first table, A<sub>0</sub>, passes continuously into the second, A<sub>1</sub>.'] },
];

export const statesB = [
  { title: 'Input–Output', lines: ['A 32 × 32 matrix of firms. Cell (i, j) is what firm j draws from firm i.', 'Three rows sit below the rule: execution, plans, objectives. People supply all three.'] },
  { title: 'The Boundary', lines: ['A single firm, drawn as its column: its full input set and one output.', 'Above the rule, supply from firms. Below it, supply from people.'] },
  { title: 'Class 1', lines: ['Execution crosses the boundary and enters the diagonal as self-produced input.', 'Agents perform it. Plans and objectives are still supplied from outside.'] },
  { title: 'Class 2', lines: ['Plans cross the same boundary. Agents inside the firm produce its plans.', 'The only input people supply is the objective.'] },
  { title: 'Isotopy', lines: ['Rows and columns are permuted. Clusters of heavy trade form new blocks.', 'Outputs that stop being made fade. Columns for new outputs enter the table.'] },
  { title: 'Diffusion', lines: ["The boundary moves in the firm's heaviest trading partners, then in theirs.", 'Successive rounds cross the table. Rates differ firm by firm.'] },
  { title: 'Homotopy', lines: ["The table rises as a surface. Each cell's height is its quantity.", 'H(t) = (1 − t)A0 + tA1: a continuous path from A0 to A1.'] },
];
