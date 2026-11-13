'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function failure(code, status = 400) {
  const error = new Error(code);
  error.status = status;
  throw error;
}
function decode(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity[0] === '#') return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[entity.toLowerCase()];
  });
}
function attributes(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])]));
}
function readCategories(html) {
  return [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].flatMap(match => {
    const id = attributes(match[1]).id;
    if (!id || !/^[a-z0-9-]+$/.test(id) || !/<div\b[^>]*class="products"/.test(match[2])) return [];
    const name = decode(/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(match[2])?.[1]?.replace(/<[^>]*>/g, '') ?? id);
    return [{ id, name, productIds: [...match[2].matchAll(/data-id="([^"]+)"/g)].map(item => decode(item[1])) }];
  });
}
function readCatalog(html) {
  const memberships = new Map(readCategories(html).flatMap(category => category.productIds.map(id => [id, category.id])));
  const products = [];
  for (const match of html.matchAll(/<article\b[^>]*class="card"[^>]*>([\s\S]*?)<\/article>/g)) {
    const card = match[1];
    const button = [...card.matchAll(/<button\b([^>]*)>/g)].map(match => attributes(match[1]))
      .find(value => value.class?.split(/\s+/).includes('add-btn'));
    if (!button) continue;
    const text = markup => decode((markup ?? '').replace(/<[^>]*>/g, '')).trim();
    const list = value => value ? value.split(',').map(part => part.trim()).filter(Boolean) : [];
    const images = [...card.matchAll(/data-bg="([^"]+)"/g)].map(match => decode(match[1]));
    products.push({
      id: button['data-id'], name: button['data-name'], category: button['data-category'],
      categoryId: memberships.get(button['data-id']) ?? null,
      price: Number(button['data-price']), description: text(/<p>([\s\S]*?)<\/p>/.exec(card)?.[1]),
      sizes: list(button['data-sizes']), options: list(button['data-options']), images,
      sizeChart: list(button['data-size-chart']), visible: true, version: 0
    });
  }
  if (!products.length || new Set(products.map(product => product.id)).size !== products.length) failure('invalid_source_catalog', 500);
  for (const product of products) validatePatch(product, true);
  return products;
}
const editable = ['name', 'category', 'price', 'description', 'sizes', 'options', 'images', 'sizeChart', 'visible'];
function asset(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020<>"'\\]/.test(value)
    || value.includes(String.fromCharCode(96))) failure('invalid_product_image');
  if (/^https:\/\//i.test(value)) {
    let url;
    try { url = new URL(value); } catch { failure('invalid_product_image'); }
    if (url.username || url.password || url.protocol !== 'https:') failure('invalid_product_image');
  } else if (value.startsWith('/') || value.includes('..') || /[?:#]/.test(value)) failure('invalid_product_image');
  return value;
}
function validatePatch(input, source = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) failure('invalid_product');
  const allowed = source ? [...editable, 'id', 'version', 'categoryId'] : editable;
  for (const key of Object.keys(input)) if (!allowed.includes(key)) failure('invalid_product_field');
  const result = {};
  for (const key of editable) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (key === 'visible') {
      if (typeof value !== 'boolean') failure('invalid_product_visibility');
    } else if (key === 'price') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 10000000) failure('invalid_product_price');
    } else if (['sizes', 'options', 'images', 'sizeChart'].includes(key)) {
      if (!Array.isArray(value) || value.length > 40 || (key === 'images' && !value.length)
        || value.some(item => typeof item !== 'string' || !item.trim() || item.length > (['images', 'sizeChart'].includes(key) ? 2048 : 100)
          || /[\u0000-\u001f]/.test(item)) || new Set(value).size !== value.length) failure('invalid_product_list');
      if (['sizes', 'options'].includes(key) && value.some(item => item.includes(','))) failure('invalid_product_list');
      if (['images', 'sizeChart'].includes(key)) value.forEach(asset);
    } else if (typeof value !== 'string' || value.length > (key === 'description' ? 5000 : 200)
      || !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) failure('invalid_product_text');
    result[key] = typeof value === 'string' ? value.trim() : structuredClone(value);
  }
  if (!source && !Object.keys(result).length) failure('empty_product_patch');
  return result;
}

function createProductCatalog({ html, getPool, settingsFile }) {
  const baseline = readCatalog(html);
  const byId = new Map(baseline.map(product => [product.id, product]));
  const categories = readCategories(html);
  const categoryKey = id => 'category:' + id;
  let tableReady;
  let fileQueue = Promise.resolve();
  async function poolReady() {
    const pool = getPool();
    if (!pool) return null;
    if (!tableReady) {
      tableReady = pool.query('CREATE TABLE IF NOT EXISTS entryfrag_product_settings ('
        + 'product_id TEXT PRIMARY KEY, settings JSONB NOT NULL, version INTEGER NOT NULL CHECK (version > 0),'
        + 'updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp())')
        .catch(error => { tableReady = null; throw error; });
    }
    await tableReady;
    return pool;
  }
  function readFile() {
    if (!fs.existsSync(settingsFile)) return {};
    const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') failure('invalid_product_storage', 503);
    return data;
  }
  function apply(base, stored) {
    if (!stored) return structuredClone(base);
    if (!Number.isSafeInteger(stored.version) || stored.version < 1) failure('invalid_product_storage', 503);
    return { ...base, ...validatePatch(stored.settings), version: stored.version };
  }
  function categoryRecord(category, stored) {
    if (stored && (!Number.isSafeInteger(stored.version) || stored.version < 1
      || typeof stored.settings?.visible !== 'boolean')) failure('invalid_category_storage', 503);
    return { id: category.id, name: category.name, visible: stored?.settings.visible ?? true,
      version: stored?.version ?? 0, productCount: category.productIds.length };
  }
  async function snapshot(includeHidden = false) {
    const pool = await poolReady();
    const stored = pool
      ? Object.fromEntries((await pool.query('SELECT product_id,settings,version FROM entryfrag_product_settings')).rows
        .map(row => [row.product_id, row]))
      : readFile();
    const products = baseline.map(base => apply(base, stored[base.id]));
    const categoryList = categories.map(category => categoryRecord(category, stored[categoryKey(category.id)]));
    const hidden = new Set(categoryList.filter(category => !category.visible).map(category => category.id));
    return { products: includeHidden ? products : products.filter(product => product.visible && !hidden.has(product.categoryId)),
      categories: includeHidden ? categoryList : categoryList.filter(category => category.visible) };
  }
  async function update(id, patch, expectedVersion) {
    const base = byId.get(id);
    if (!base) failure('product_not_found', 404);
    const safe = validatePatch(patch);
    const stored = await saveSettings(id, expectedVersion, previous => {
      const current = apply(base, previous);
      return Object.fromEntries(editable.map(key => [key, Object.hasOwn(safe, key) ? safe[key] : current[key]]));
    });
    return apply(base, stored);
  }
  async function updateCategory(id, visible, expectedVersion) {
    const category = categories.find(category => category.id === id);
    if (!category) failure('category_not_found', 404);
    if (typeof visible !== 'boolean') failure('invalid_category_visibility');
    const stored = await saveSettings(categoryKey(id), expectedVersion, previous => {
      categoryRecord(category, previous);
      return { visible };
    });
    return categoryRecord(category, stored);
  }
  async function saveSettings(id, expectedVersion, build) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) failure('invalid_product_version');
    const pool = await poolReady();
    if (pool) {
      const previous = await pool.query('SELECT settings,version FROM entryfrag_product_settings WHERE product_id=$1', [id]);
      if ((previous.rows[0]?.version ?? 0) !== expectedVersion) failure('product_version_conflict', 409);
      const settings = build(previous.rows[0]);
      if (expectedVersion === 0) {
        const result = await pool.query('INSERT INTO entryfrag_product_settings (product_id,settings,version) VALUES ($1,$2::jsonb,1)'
          + ' ON CONFLICT (product_id) DO NOTHING RETURNING settings,version', [id, JSON.stringify(settings)]);
        if (!result.rowCount) failure('product_version_conflict', 409);
        return result.rows[0];
      }
      const updated = await pool.query('UPDATE entryfrag_product_settings SET settings=$2::jsonb,version=version+1,'
        + 'updated_at=clock_timestamp() WHERE product_id=$1 AND version=$3 RETURNING settings,version',
      [id, JSON.stringify(settings), expectedVersion]);
      if (!updated.rowCount) failure('product_version_conflict', 409);
      return updated.rows[0];
    }
    const operation = fileQueue.then(() => {
      const records = readFile();
      const version = records[id]?.version ?? 0;
      if (version !== expectedVersion) failure('product_version_conflict', 409);
      const settings = build(records[id]);
      records[id] = { settings, version: version + 1 };
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      const temporary = settingsFile + '.' + randomUUID() + '.tmp';
      try {
        fs.writeFileSync(temporary, JSON.stringify(records), { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, settingsFile);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      return records[id];
    });
    fileQueue = operation.catch(() => {});
    return operation;
  }
  async function checkOrderItems(items) {
    if (!Array.isArray(items)) return;
    const { products: all, categories } = await snapshot(true);
    const hidden = new Set(categories.filter(category => !category.visible).map(category => category.id));
    for (const item of items) {
      const product = item.id ? all.find(product => product.id === item.id)
        : all.find(product => product.name === item.name || byId.get(product.id).name === item.name);
      if (product && (!product.visible || hidden.has(product.categoryId))) failure('product_unavailable', 409);
    }
  }
  return { list: async (includeHidden = false) => (await snapshot(includeHidden)).products,
    snapshot, update, updateCategory, checkOrderItems };
}
module.exports = { readCatalog, createProductCatalog, validatePatch };
