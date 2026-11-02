import { build } from 'esbuild';
import { loadCompiler } from 'jinge-compiler';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const compiler = loadCompiler({});
await mkdir(path.join(root, 'test/.compiled'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'test/fixtures/app.tsx')],
  outfile: path.join(root, 'test/.compiled/app.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  sourcemap: true,
  // Compile the linked runtime too, so tests exercise the current source tree.
  alias: { jinge: require.resolve('jinge/source') },
  plugins: [
    {
      name: 'jinge-test-compiler',
      setup(builder) {
        builder.onLoad({ filter: /\.tsx?$/ }, async ({ path: filename }) => ({
          contents: compiler.transform(
            filename,
            filename.endsWith('.tsx') ? 2 : 1,
            await readFile(filename, 'utf8'),
            false,
            0,
          ).code,
          loader: 'js',
        }));
      },
    },
  ],
});
