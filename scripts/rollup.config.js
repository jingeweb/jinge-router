import resolve from '@rollup/plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'lib/index.js',
    external: ['jinge'],
    output: {
      sourcemap: true,
      name: 'jinge-router',
      file: './dist/jinge-router.js',
      format: 'umd',
    },
    plugins: [sourcemaps(), resolve()],
  },
  {
    input: 'lib/index.js',
    external: ['jinge'],
    output: {
      sourcemap: true,
      name: 'jinge-router',
      file: './dist/jinge-router.min.js',
      format: 'umd',
    },
    plugins: [sourcemaps(), resolve(), terser()],
  },
];
