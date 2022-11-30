import { fileURLToPath } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import terser from '@rollup/plugin-terser';
import jingeCompiler from 'jinge-compiler';
import { transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const COMP_DIR = path.join(SRC_DIR, 'components/');

function rollupJingePlugin() {
  return {
    name: 'jinge',
    async load(id) {
      if (!id.startsWith(COMP_DIR)) {
        return null;
      }
      const rf = path.relative(SRC_DIR, id);
      const src = await fs.readFile(id, 'utf-8');
      // console.log('IDDDDD', id);
      if (id.endsWith('.ts')) {
        const { code, map } = await transform(src, {
          target: 'es2020',
          format: 'esm',
          loader: 'ts',
          sourcemap: true,
          sourcefile: `../src/${rf}`,
          sourcesContent: false,
        });
        const result = jingeCompiler.ComponentParser.parse(code, null, {
          resourcePath: id
        });
        return {
          code: result.code,
          map,
        }
      } else {
        const result = jingeCompiler.TemplateParser.parse(src, {
          resourcePath: id,
          emitErrorFn: (err) => {
            console.error(err);
          },
          addDebugName: false,
        });
        return {
          code: result.code,
          map: '',
        }
      }
    }
  }
}
export default [
  {
    input: 'src/index.ts',
    external: ['jinge'],
    output: {
      globals: {
        jinge: 'jinge',
      },
      sourcemap: true,
      name: 'jinge-router',
      file: './dist/jinge-router.js',
      format: 'umd',
    },
    plugins: [resolve(), rollupJingePlugin(), esbuild({
      target: 'es2020',
      format: 'esm',
    })],
  },
  {
    input: 'src/index.ts',
    external: ['jinge'],
    output: {
      globals: {
        jinge: 'jinge',
      },
      sourcemap: true,
      name: 'jinge-router',
      file: './dist/jinge-router.min.js',
      format: 'umd',
    },
    plugins: [resolve(), rollupJingePlugin(), esbuild({
      target: 'es2020',
      format: 'esm',
    }), terser()],
  },
];
