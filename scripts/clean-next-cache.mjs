import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const targets = [
  '.next',
  '.turbo',
].map((name) => join(process.cwd(), name));

for (const target of targets) {
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}
