// Turns standard Markdown footnotes ([^1]) into sidenotes (Ref B's tertiary asides):
// - each reference becomes a numbered chip `<a class="note-ref">`
// - each note body becomes `<aside class="sidenote">` inserted right after the block that cites it
//   (inline on small screens; lifted into the right column on desktop by sidenotes.ts)
// - the trailing footnotes <section> is removed.
// Also numbers h2 section markers and marks blockquotes as pull quotes.

const isEl = (n, tag) => n && n.type === 'element' && (!tag || n.tagName === tag);

function findFootnotes(tree) {
  const notes = new Map();
  let sectionParent = null, sectionIndex = -1;
  const walk = (node, parent) => {
    if (!node.children) return;
    node.children.forEach((child, i) => {
      if (isEl(child, 'section') && (child.properties?.dataFootnotes !== undefined || String(child.properties?.className || '').includes('footnotes'))) {
        sectionParent = node; sectionIndex = i;
        const ol = child.children.find((c) => isEl(c, 'ol'));
        for (const li of ol?.children || []) {
          if (!isEl(li, 'li')) continue;
          const id = String(li.properties?.id || '').replace('user-content-fn-', '');
          const strip = (n) => {
            if (!n.children) return n;
            n.children = n.children.filter((c) => !(isEl(c, 'a') && c.properties?.dataFootnoteBackref !== undefined)).map(strip);
            return n;
          };
          const content = li.children.filter((c) => c.type !== 'text' || c.value.trim()).map(strip);
          notes.set(id, content);
        }
      } else walk(child, node);
    });
  };
  walk(tree, null);
  if (sectionParent) sectionParent.children.splice(sectionIndex, 1);
  return notes;
}

export function rehypeSidenotes() {
  return (tree) => {
    const notes = findFootnotes(tree);
    let order = 0;
    const numberOf = new Map();
    let h2 = 0;

    const process = (parent) => {
      if (!parent.children) return;
      const out = [];
      for (const block of parent.children) {
        // number section heads
        if (isEl(block, 'h2')) {
          h2++;
          block.properties = { ...block.properties, dataSection: String(h2).padStart(2, '0') };
        }
        if (isEl(block, 'blockquote')) {
          block.properties = { ...block.properties, className: ['pullquote'] };
        }
        const refs = [];
        const walk = (node) => {
          if (!node.children) return;
          node.children = node.children.map((c) => {
            if (isEl(c, 'sup') && c.children?.some((a) => isEl(a, 'a') && a.properties?.dataFootnoteRef !== undefined)) {
              const a = c.children.find((x) => isEl(x, 'a'));
              const id = String(a.properties.href || '').replace('#user-content-fn-', '');
              if (!numberOf.has(id)) numberOf.set(id, ++order);
              const n = numberOf.get(id);
              refs.push({ id, n });
              return {
                type: 'element', tagName: 'a',
                properties: { className: ['note-ref'], href: `#note-${n}`, id: `ref-${n}`, dataNote: String(n), ariaLabel: `Note ${n}` },
                children: [{ type: 'text', value: String(n) }],
              };
            }
            walk(c);
            return c;
          });
        };
        walk(block);
        out.push(block);
        for (const { id, n } of refs) {
          const body = notes.get(id);
          if (!body) continue;
          out.push({
            type: 'element', tagName: 'aside',
            properties: { className: ['sidenote'], id: `note-${n}`, dataNote: String(n), role: 'note' },
            children: [
              { type: 'element', tagName: 'span', properties: { className: ['sidenote__n'], ariaHidden: 'true' }, children: [{ type: 'text', value: `${n}.` }] },
              { type: 'element', tagName: 'div', properties: { className: ['sidenote__body'] }, children: body },
            ],
          });
        }
      }
      parent.children = out;
    };
    process(tree);
  };
}
