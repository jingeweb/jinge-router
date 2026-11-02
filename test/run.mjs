import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
for (const args of [
  ['test/build.mjs'],
  [
    '--test',
    '--test-concurrency=1',
    ...(process.argv.length > 2 ? process.argv.slice(2) : ['test/*.test.mjs']),
  ],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
