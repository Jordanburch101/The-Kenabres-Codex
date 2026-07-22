import { z } from 'astro/zod';

export const glossaryEntrySchema = z.object({
  name: z.string(),
  category: z.enum(['feat', 'spell', 'hex', 'mythic', 'class', 'skill', 'ability']),
  desc: z.string(),
  wikiSlug: z.string().optional(),
  icon: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

const stat = z.object({
  value: z.string(),
  tag: z.string().optional(),
  emphasis: z.enum(['hi', 'dump']).optional(),
});

const table = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.union([
    z.object({ lv: z.union([z.number(), z.string()]), cells: z.array(z.string()) }),
    z.array(z.string()),
  ])),
});

export const buildSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  kind: z.enum(['companion', 'mc', 'mercenary']),
  role: z.string(),
  class: z.string(),
  archetype: z.string().optional(),
  race: z.string().optional(),
  alignment: z.string().optional(),
  mythicPath: z.string().optional(),
  difficultyToPlay: z.string().optional(),
  difficultyTarget: z.string().optional(),
  dlc: z.string().optional(),
  patch: z.string().optional(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  video: z.object({
    youtubeId: z.string(),
    creator: z.string(),
    creatorUrl: z.string().optional(),
  }).optional(),
  badges: z.array(z.object({ label: z.string(), style: z.enum(['gold', 'crim', 'plain']).default('plain') })).optional(),
  summary: z.string(),
  abilityScores: z.object({
    str: stat.optional(), dex: stat.optional(), con: stat.optional(),
    int: stat.optional(), wis: stat.optional(), cha: stat.optional(),
    note: z.string().optional(),
  }).optional(),
  skills: z.object({ main: z.string(), note: z.string().optional() }).optional(),
  identity: z.array(z.object({ k: z.string(), v: z.string() })).optional(),
  levels: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.object({ lv: z.union([z.number(), z.string()]), cells: z.array(z.string()) })),
    note: z.string().optional(),
  }).optional(),
  picks: z.array(z.object({
    heading: z.string(),
    intro: z.string().optional(),
    items: z.array(z.object({ tag: z.string().optional(), name: z.string(), note: z.string() })),
  })).optional(),
  gear: z.array(z.object({ k: z.string(), v: z.string(), flag: z.string().optional() })).optional(),
  mythic: z.object({ intro: z.string().optional(), table: table.optional(), note: z.string().optional() }).optional(),
  combat: z.object({ bullets: z.array(z.string()), closer: z.string().optional() }).optional(),
  footnotes: z.array(z.string()).optional(),
});
export type Build = z.infer<typeof buildSchema>;
