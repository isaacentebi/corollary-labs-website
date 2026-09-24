// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeSidenotes } from './src/lib/rehype-sidenotes.mjs';

// Proof direction: served under /proof/ on the shared site. Every internal URL goes through import.meta.env.BASE_URL.
export default defineConfig({
  site: 'https://corollarylabs.example',
  base: '/proof',
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
