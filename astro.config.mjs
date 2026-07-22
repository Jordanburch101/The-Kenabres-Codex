import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://the-kenabres-codex.vercel.app',
  integrations: [react()],
  // static output (default); Vercel serves dist/ as-is
});
