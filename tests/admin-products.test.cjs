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

test('MVP medal has no size, options or chart and can be added to the cart without selecting a size', async t => {
  const { catalog } = storage(t);
  const medal = (await catalog.list()).find(product => product.id === 'mvp-medal');
  assert.ok(medal);
  assert.equal(medal.price, 799);
  assert.deepEqual(medal.sizes, []);
  assert.deepEqual(medal.options, []);
  assert.deepEqual(medal.sizeChart, []);
  const saved = await catalog.update(medal.id, { sizes: [], options: [], sizeChart: [] }, 0);
  assert.deepEqual(saved.sizes, []);

  const source = fs.readFileSync(path.join(root, 'frontend/entryfrag.js'), 'utf8');
  const start = source.indexOf('const parseSizes =');
  const end = source.indexOf('const parseAssetList', start);
  const context = { defaultSizes: ['S', 'M', 'L'], result: null };
  vm.createContext(context);
  context.button = { hasAttribute: () => true, dataset: { sizes: '' } };
  vm.runInContext(source.slice(start, end) + ';result = parseSizes(button);', context);
  assert.equal(context.result.length, 0);
  context.button.dataset.sizes = 'M,L,XL';
  vm.runInContext('result = parseSizes(button);', context);
  assert.equal(context.result.join(','), 'M,L,XL');

  let handler;
  let added = 0;
  const sizesPanel = { hidden: false };
  const ui = {
    products: new Map([[medal.id, medal]]), activeProductId: medal.id,
    productAddToCart: { addEventListener: (_event, callback) => { handler = callback; } },
    getActiveSize: () => '', getActiveOption: () => '',
    showToast: () => assert.fail('A sizeless medal must not require a selection'),
    addToCart: (product, size, option) => { assert.equal(product.id, medal.id); assert.equal(size, ''); assert.equal(option, ''); added++; },
    productCategory: {}, productTitle: {}, productPrice: {}, productDescription: {},
    productSizeChart: {}, productMainShot: { style: {} }, productThumbs: {},
    productSizes: { closest: () => sizesPanel }, productOptionsWrap: {}, productOptions: {},
    money: String, escapeCatalogHtml: String, resolveDetailImage: value => value,
    parseAssetList: value => String(value || '').split(',').filter(Boolean),
    syncProductPrice() {}, setProductImage() {}
  };
  vm.createContext(ui);
  const renderStart = source.indexOf('function renderProduct(');
  const renderEnd = source.indexOf('const snapProductViewport', renderStart);
  vm.runInContext(source.slice(renderStart, renderEnd) + ';renderProduct(activeProductId);', ui);
  assert.equal(sizesPanel.hidden, true);
  assert.equal(ui.productOptionsWrap.hidden, true);
  assert.equal(ui.productSizeChart.hidden, true);
  const clickStart = source.indexOf('productAddToCart.addEventListener("click"');
  const clickEnd = source.indexOf('productSizeChart.addEventListener', clickStart);
  vm.runInContext(source.slice(clickStart, clickEnd), ui);
  handler();
  assert.equal(added, 1);
});

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

test('category hiding excludes its products publicly and checkout while preserving individual visibility', async t => {
  const { catalog } = storage(t);
  const first = original[0];
  const category = (await catalog.snapshot(true)).categories.find(item => item.id === first.categoryId);
  assert.ok(category.productCount > 1);
  await catalog.update(first.id, { visible: false }, 0);
  const hidden = await catalog.updateCategory(category.id, false, 0);
  assert.equal(hidden.visible, false);
  const publicState = await catalog.snapshot();
  assert.ok(publicState.categories.every(item => item.id !== category.id));
  assert.ok(publicState.products.every(item => item.categoryId !== category.id));
  const adminState = await catalog.snapshot(true);
  assert.equal(adminState.products.length, original.length);
  assert.equal(adminState.products.find(item => item.id === first.id).visible, false);
  const other = original.find(item => item.categoryId === category.id && item.id !== first.id);
  assert.equal(adminState.products.find(item => item.id === other.id).visible, true);
  await assert.rejects(catalog.checkOrderItems([{ id: other.id }]), { message: 'product_unavailable' });
  await assert.rejects(catalog.checkOrderItems([{ name: other.name }]), { message: 'product_unavailable' });
  await catalog.updateCategory(category.id, true, 1);
  const restored = await catalog.list();
  assert.ok(restored.some(item => item.id === other.id));
  assert.ok(restored.every(item => item.id !== first.id));
});
test('category changes survive reopen and remain independent of product edits and label changes', async t => {
  const { catalog, directory } = storage(t);
  const product = original[0];
  await catalog.updateCategory(product.categoryId, false, 0);
  await catalog.update(product.id, { name: 'Synthetic renamed jersey', category: 'Synthetic new label' }, 0);
  const reopened = createProductCatalog({ html, getPool: () => null, settingsFile: path.join(directory, 'products.json') });
  assert.ok((await reopened.list()).every(item => item.id !== product.id));
  assert.equal((await reopened.snapshot(true)).categories.find(item => item.id === product.categoryId).visible, false);
  await reopened.updateCategory(product.categoryId, true, 1);
  assert.equal((await reopened.list()).find(item => item.id === product.id).name, 'Synthetic renamed jersey');
});
test('concurrent category toggles enforce versions and invalid categories fail closed', async t => {
  const { catalog } = storage(t);
  const id = original[0].categoryId;
  const results = await Promise.allSettled([catalog.updateCategory(id, false, 0), catalog.updateCategory(id, true, 0)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(results.find(item => item.status === 'rejected').reason.status, 409);
  await assert.rejects(catalog.updateCategory('missing', false, 0), { status: 404 });
  await assert.rejects(catalog.updateCategory(id, 'false', 1), { status: 400 });
});
test('storefront loader removes hidden category sections and every matching navigation link', async () => {
  const removed = new Set();
  const sections = ['jerseys', 'mvp-medals'].map(id => ({ id, querySelector: () => ({}), remove: () => removed.add(id) }));
  const links = [{ remove: () => removed.add('category-card') }, { remove: () => removed.add('navigation-link') }];
  const context = {
    window: {}, location: { protocol: 'http:' }, AbortSignal: { timeout: () => undefined },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ products: [], categories: [{ id: 'mvp-medals' }] }) }),
    document: {
      documentElement: { classList: { add() {}, remove() {} } },
      querySelectorAll: selector => selector === '.products .card' ? [] : selector === 'section[id]' ? sections
        : selector === 'a[href="#jerseys"]' ? links : []
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend/catalog.js'), 'utf8'), context);
  await context.window.entryfragCatalogReady;
  assert.deepEqual([...removed].sort(), ['category-card', 'jerseys', 'navigation-link']);
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
    { images: ['javascript:alert(1)'] }, { images: ['../secret'] }, { sizes: [''] }, { options: ['bad,option'] }]) {
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
  const category = listed.body.categories.find(item => item.id === original[0].categoryId);
  const categoryMutation = { id: category.id, visible: false, expectedVersion: 0 };
  assert.equal((await request('/api/admin/categories/update', categoryMutation, false)).status, 401);
  assert.equal((await request('/api/admin/categories/update', categoryMutation, true, { Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await request('/api/admin/categories/update', categoryMutation)).status, 200);
  assert.equal((await request('/api/admin/categories/update', categoryMutation)).status, 409);
  const hiddenCategory = await request('/api/products', null, false);
  assert.ok(hiddenCategory.body.categories.every(item => item.id !== category.id));
  assert.ok(hiddenCategory.body.products.every(item => item.categoryId !== category.id));
  const categoryItem = original.find(item => item.categoryId === category.id && item.id !== original[0].id);
  assert.equal((await request('/api/orders', { orderNumber: 'SYNTHETIC-CATEGORY-ONLY', items: [{ id: categoryItem.id }] }, false)).status, 409);
  assert.equal((await request('/api/admin/categories/update', { id: category.id, visible: true, expectedVersion: 1 })).status, 200);
  assert.equal((await request('/api/products', null, false)).body.products.length, original.length - 1);
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
