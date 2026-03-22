import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '..', 'fixtures');

export function getFixturePath(name: string): string {
  return resolve(fixturesDir, name);
}

export function readFixture(name: string): string {
  return readFileSync(getFixturePath(name), 'utf-8');
}
