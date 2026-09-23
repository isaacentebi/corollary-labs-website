import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Essays: drop an .md or .mdx file into src/content/essays with this frontmatter.
const essays = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/essays' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    dek: z.string(),
    placeholder: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { essays };
