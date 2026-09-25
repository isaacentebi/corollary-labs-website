// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeSidenotes } from './src/lib/rehype-sidenotes.mjs';

export default defineConfig({
  site: 'https://corollarylabs.example',
  base: '/score',
  output: 'static',
  devToolbar: { enabled: false },
  trailingSlash: 'ignore',
  integrations: [mdx()],
  // dev only: node_modules is a symlink into the main checkout, so let Vite serve font files from it
  vite: { server: { fs: { strict: false } } },
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeSidenotes],
    smartypants: true,
  },
});
