import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { buildSchema, glossaryEntrySchema } from './lib/schemas';

const builds = defineCollection({
  loader: glob({ base: './src/content/builds', pattern: '**/*.yaml' }),
  schema: buildSchema,
});
const glossary = defineCollection({
  loader: glob({ base: './src/content/glossary', pattern: '**/*.yaml' }),
  schema: glossaryEntrySchema,
});

export const collections = { builds, glossary };
