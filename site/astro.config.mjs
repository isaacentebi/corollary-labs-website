// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';
import { rehypeSidenotes } from './src/lib/rehype-sidenotes.mjs';

// Light direction: built under /light (see LIGHT-BRIEF.md). Every internal link and asset goes through
// import.meta.env.BASE_URL (helpers in src/lib/url.ts).
export default defineConfig({
  site: 'https://corollarylabs.vercel.app',
  base: '/light',
  output: 'static',
  devToolbar: { enabled: false },
  trailingSlash: 'ignore',
  server: { port: 4360, host: true },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeSidenotes],
    smartypants: true,
  },
});
