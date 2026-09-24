// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeSidenotes } from './src/lib/rehype-sidenotes.mjs';

// Organic direction: served under /organic/ on the shared directions site.
export default defineConfig({
  site: 'https://corollarylabs.example',
  base: '/organic',
  output: 'static',
  devToolbar: { enabled: false },
  trailingSlash: 'ignore',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeSidenotes],
    smartypants: true,
  },
});
