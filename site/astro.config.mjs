// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeSidenotes } from './src/lib/rehype-sidenotes.mjs';

export default defineConfig({
  site: 'https://corollarylabs.example',
  base: '/metab',
  output: 'static',
  devToolbar: { enabled: false },
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeSidenotes],
    smartypants: true,
  },
});
