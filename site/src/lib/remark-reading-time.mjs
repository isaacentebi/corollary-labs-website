// Adds `minutesRead` and `words` to an essay's frontmatter (230 wpm, long-form reading pace).
export function remarkReadingTime() {
  return (tree, file) => {
    let words = 0;
    const walk = (node) => {
      if (node.type === 'text' || node.type === 'inlineCode') words += node.value.split(/\s+/).filter(Boolean).length;
      if (node.children) node.children.forEach(walk);
    };
    walk(tree);
    const fm = (file.data.astro ??= {}).frontmatter ??= {};
    fm.words = words;
    fm.minutesRead = Math.max(1, Math.round(words / 230));
  };
}
