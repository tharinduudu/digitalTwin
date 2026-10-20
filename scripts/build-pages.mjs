import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
const revision = (process.env.GITHUB_SHA || 'preview').slice(0, 12);
// Publish only browser assets. SSH code and local configuration stay out.
await cp(resolve(root, 'public'), resolve(output, revision), { recursive: true });
const index = await readFile(resolve(root, 'public/index.html'), 'utf8');
await writeFile(resolve(output, 'index.html'),
  index.replace('<html lang="en">', '<html lang="en" data-feed="simulation">')
    .replace('<head>', `<head>\n  <base href="./${revision}/">`));
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Static simulation ready in dist/');
