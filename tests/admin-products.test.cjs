'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { once } = require('node:events');
const { readCatalog, createProductCatalog } = require('../product-catalog.cjs');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const original = readCatalog(html);

function storage(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'entryfrag-product-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, catalog: createProductCatalog({ html, getPool: () => null,
    settingsFile: path.join(directory, 'products.json') }) };
}
test('all existing products retain unique IDs and original data until edited', async t => {
  const { catalog } = storage(t);
  assert.ok(original.length >= 50);
  assert.equal(new Set(original.map(product => product.id)).size, original.length);
  assert.deepEqual(await catalog.list(), original);
});
test('product edits persist after reopening without changing source HTML or product ID', async t => {
  const { catalog, directory } = storage(t);
  const saved = await catalog.update(original[0].id, { name: 'Synthetic edit', price: 1234, sizes: ['M'] }, 0);
  assert.equal(saved.id, original[0].id);
  assert.equal(saved.version, 1);
  const reopened = createProductCatalog({ html, getPool: () => null, settingsFile: path.join(directory, 'products.json') });
  assert.deepEqual((await reopened.list())[0], saved);
  assert.deepEqual(readCatalog(html), original);
  assert.deepEqual((await reopened.list()).slice(1), original.slice(1));
});
test('hidden products remain editable, disappear publicly and reject checkout until shown', async t => {
  const { catalog } = storage(t);
  const id = original[0].id;
  await catalog.update(id, { visible: false }, 0);
  assert.equal((await catalog.list()).length, original.length - 1);
  assert.equal((await catalog.list(true)).length, original.length);
  await assert.rejects(catalog.checkOrderItems([{ id }]), { message: 'product_unavailable' });
  await assert.rejects(catalog.checkOrderItems([{ name: original[0].name }]), { message: 'product_unavailable' });
  await catalog.update(id, { visible: true }, 1);
  assert.equal((await catalog.list()).length, original.length);
  await catalog.checkOrderItems([{ id }]);
});
test('stale and concurrent saves cannot overwrite a newer product', async t => {
  const { catalog } = storage(t);
  const outcomes = await Promise.allSettled([
    catalog.update(original[0].id, { price: 1000 }, 0),
    catalog.update(original[0].id, { visible: false }, 0)
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.status, 409);
  await assert.rejects(catalog.update(original[0].id, { price: 2000 }, 0), { status: 409 });
});
test('invalid IDs, prices, image schemes and unexpected fields fail before saving', async t => {
  const { catalog } = storage(t);
  for (const patch of [{ id: 'replace-id' }, { price: -1 }, { price: 1.5 }, { visible: 'false' },
    { images: ['javascript:alert(1)'] }, { images: ['../secret'] }, { sizes: [] }, { options: ['bad,option'] }]) {
    await assert.rejects(catalog.update(original[0].id, patch, 0));
  }
  await assert.rejects(catalog.update('missing', { visible: false }, 0), { status: 404 });
  assert.deepEqual(await catalog.list(), original);
});
test('configured database failure never falls back to local storage', async t => {
  const { directory } = storage(t);
  const catalog = createProductCatalog({ html, settingsFile: path.join(directory, 'fallback.json'),
    getPool: () => ({ query: async () => { throw new Error('synthetic database unavailable'); } }) });
  await assert.rejects(catalog.list());
  await assert.rejects(catalog.update(original[0].id, { visible: false }, 0));
  assert.equal(fs.existsSync(path.join(directory, 'fallback.json')), false);
});
test('HTTP routes enforce auth, persistence, visibility, conflicts and private-file restrictions in an isolated server', async t => {
  const { directory } = storage(t);
  let server;
  const safeFs = { ...fs, existsSync: target => {
    if (!path.resolve(target).startsWith(directory + path.sep)) throw new Error('outside isolated test directory');
    return fs.existsSync(target);
  }, readFileSync: (target, encoding) => {
    if (target === path.join(directory, 'index.html')) return html;
    if (!path.resolve(target).startsWith(directory + path.sep)) throw new Error('outside isolated test directory');
    return fs.readFileSync(target, encoding);
  }};
  const safeRequire = name => {
    if (name === './product-catalog.cjs') return require('../product-catalog.cjs');
    if (name === 'fs') return safeFs;
    if (name === 'https') return { request() { throw new Error('external requests forbidden'); } };
    if (name === 'http') return { createServer(handler) {
      server = http.createServer(handler);
      const listen = server.listen.bind(server);
      server.listen = (port, callback) => listen(port, '127.0.0.1', callback);
      return server;
    }};
    if (!['path', 'url'].includes(name)) throw new Error('unexpected test import');
    return require(name);
  };
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8')
    .replace(/^const adminUsername = .*;$/m, 'const adminUsername = "synthetic-admin";')
    .replace(/^const adminPassword = .*;$/m, 'const adminPassword = "synthetic-test-password";');
  vm.runInNewContext(source, { require: safeRequire, __dirname: directory,
    process: { env: { PORT: '0' }, exit() { throw new Error('unexpected startup exit'); } },
    Buffer, URL, console: { log() {}, error() {} } });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const auth = 'Basic ' + Buffer.from('synthetic-admin:synthetic-test-password').toString('base64');
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(route, body, authorized = true, extra = {}) {
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { ...(authorized ? { Authorization: auth } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...extra },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request('/api/admin/products', null, false)).status, 401);
  assert.equal((await request('/api/admin/products/update', { id: original[0].id }, false)).status, 401);
  const listed = await request('/api/admin/products');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.products.length, original.length);
  assert.equal((await request('/api/products', null, false)).body.products.length, original.length);
  const mutation = { id: original[0].id, expectedVersion: 0, patch: { visible: false } };
  assert.equal((await request('/api/admin/products/update', mutation, true, { Origin: 'https://foreign.invalid' })).status, 403);
  const saved = await request('/api/admin/products/update', mutation);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.product.visible, false);
  assert.equal((await request('/api/products', null, false)).body.products.length, original.length - 1);
  assert.equal((await request('/api/admin/products')).body.products.length, original.length);
  assert.equal((await request('/api/admin/products/update', mutation)).status, 409);
  const unavailable = await request('/api/orders', { orderNumber: 'SYNTHETIC-ONLY', items: [{ id: original[0].id }] }, false);
  assert.equal(unavailable.status, 409);
  assert.equal(unavailable.body.error, 'product_unavailable');
  assert.equal(fs.existsSync(path.join(directory, 'orders.json')), false);
  for (const route of ['/.env', '/server.js', '/product-catalog.cjs', '/.entryfrag-products.json', '/orders.json']) {
    assert.equal((await request(route, null, false)).status, 404);
  }
  fs.mkdirSync(path.join(directory, 'mobile-previews'));
  fs.writeFileSync(path.join(directory, 'mobile-previews', 'synthetic.png'), Buffer.from([1, 2, 3]));
  const preview = await fetch(base + '/mobile-previews/synthetic.png');
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), Buffer.from([1, 2, 3]));
});
