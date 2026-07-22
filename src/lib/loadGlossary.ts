import { getCollection } from 'astro:content';
import { buildGlossaryIndex } from './glossary';

export async function loadGlossaryIndex() {
  const entries = (await getCollection('glossary')).map((e) => e.data);
  return buildGlossaryIndex(entries);
}
