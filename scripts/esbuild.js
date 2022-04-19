const { promises: fs } = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const { TemplateParser, ComponentParser } = require('jinge-compiler');
const esbuild = require('esbuild');
const chokidar = require('chokidar');
const WATCH = process.env.WATCH === 'true';
const SRC_DIR = path.resolve(__dirname, '../src');
const DIST_DIR = path.resolve(__dirname, '../lib');
const COMP_DIR = path.join(SRC_DIR, 'components/');

async function glob(dir) {
  const subs = await fs.readdir(dir);
  let files = [];
  for await (const sub of subs) {
    if (/\.(ts|html)$/.test(sub)) {
      files.push(path.join(dir, sub));
    } else if (!/\./.test(sub)) {
      files = files.concat(await glob(path.join(dir, sub)));
    }
  }
  return files;
}

async function transformFile(file) {
  const src = await fs.readFile(file, 'utf-8');
  let { code, map, warnings } = await esbuild.transform(src, {
    target: 'es2020',
    format: 'esm',
    loader: path.extname(file).slice(1),
    sourcemap: true,
  });
  if (warnings?.length) console.error(warnings);
  if (!code) return; // ignore empty file
  if (file.startsWith(COMP_DIR)) {
    const result = await ComponentParser.parse(code, map, {
      resourcePath: file,
    });
    code = result.code.replace(/"([^"]+)\.html"/g, (m0, m1) => `"${m1}.tpl.js"`);
    map = JSON.stringify(result.map);
  }
  const rf = path.relative(SRC_DIR, file).replace(/\.ts$/, '.js');
  execSync(`mkdir -p ${path.dirname(path.join(DIST_DIR, rf))}`);
  await Promise.all([fs.writeFile(path.join(DIST_DIR, rf), code), fs.writeFile(path.join(DIST_DIR, rf + '.map'), map)]);
}
async function transformTpl(file) {
  const cnt = await fs.readFile(file, 'utf-8');
  const result = await TemplateParser.parse(cnt, null, {
    resourcePath: file,
    emitErrorFn: (err) => {
      console.error(err);
    },
    addDebugName: false,
  });
  const rf = path.relative(SRC_DIR, file).replace(/\.html$/, '.tpl.js');
  execSync(`mkdir -p ${path.dirname(path.join(DIST_DIR, rf))}`);
  await fs.writeFile(path.join(DIST_DIR, rf), result.code);
}
async function handleChange(file) {
  if (!/\.(ts|html)$/.test(file)) return;
  const fn = path.relative(SRC_DIR, file);
  try {
    await transformFile(file);
    console.log(fn, 'compiled.');
  } catch (ex) {
    console.error(fn, 'failed.');
    console.error(ex);
  }
}
(async () => {
  const files = await glob(SRC_DIR);
  for await (const file of files) {
    if (file.endsWith('.ts')) {
      await transformFile(file);
    } else {
      await transformTpl(file);
    }
  }
  console.log('Build finished.');
  if (!WATCH) return;
  console.log('Continue watching...');
  chokidar
    .watch(path.join(SRC_DIR, '**/*.ts'), {
      ignoreInitial: true,
    })
    .on('add', (file) => handleChange(file))
    .on('change', (file) => handleChange(file));
})().catch((err) => {
  console.error(err);
  process.exit(-1);
});
