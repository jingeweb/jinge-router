import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
const bundle = await readFile(new URL('../.compiled/app.js', import.meta.url));
const html = `<!doctype html><html><head><title>Jinge Router tests</title><link rel="icon" href="data:,"></head><body><script type="module">
import * as fixture from '/__test/app.js';
window.fixture = fixture;
window.app = fixture.mountApp(window.testOptions ?? {});
window.ready = true;
</script></body></html>`;
createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/__test/app.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(bundle);
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  }
}).listen(Number(process.env.ROUTER_TEST_PORT ?? 5198), '127.0.0.1');
