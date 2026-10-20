import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
// Publish only browser assets. SSH code and local configuration stay out.
await cp(resolve(root, 'public'), output, { recursive: true });
const index = await readFile(resolve(output, 'index.html'), 'utf8');
await writeFile(resolve(output, 'index.html'),
  index.replace('<html lang="en">', '<html lang="en" data-feed="simulation">'));
await writeFile(resolve(output, '.nojekyll'), '');
console.log('Static simulation ready in dist/');
