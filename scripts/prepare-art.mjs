import { readdir, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = join(root, 'assets/source/art');
const destinationRoot = join(root, 'apps/web/public/art');
let sourceBytes = 0;
let outputBytes = 0;
let count = 0;
async function convert(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) {
      await convert(source);
      continue;
    }
    if (!entry.name.endsWith('.png')) continue;
    const output = join(destinationRoot, relative(sourceRoot, source).replace(/\.png$/, '.webp'));
    await mkdir(dirname(output), { recursive: true });
    execFileSync(
      'magick',
      [source, '-define', 'webp:lossless=true', '-define', 'webp:method=6', output],
      { stdio: 'pipe' },
    );
    sourceBytes += (await stat(source)).size;
    outputBytes += (await stat(output)).size;
    count += 1;
  }
}
await convert(sourceRoot);
console.log(
  JSON.stringify({
    files: count,
    sourceBytes,
    outputBytes,
    reduction: `${Math.round((1 - outputBytes / sourceBytes) * 100)}%`,
  }),
);
