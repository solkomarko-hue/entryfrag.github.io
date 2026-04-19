const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const rootDir = __dirname;
const managerChatFile = path.join(rootDir, "telegram-manager-chat.txt");
const env = loadEnv(path.join(rootDir, ".env"));
const port = Number(env.PORT || process.env.PORT || 3000);
const telegramBotToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
const corsOrigin = env.CORS_ORIGIN || process.env.CORS_ORIGIN || "*";
const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL || "";
const databaseSslMode = (env.DATABASE_SSL || process.env.DATABASE_SSL || "").trim().toLowerCase();
const configuredDataDir = env.DATA_DIR || process.env.DATA_DIR || "";
const configuredOrdersFile = env.ORDERS_FILE || process.env.ORDERS_FILE || "";
const adminUsername = "ENTRYFRAGADMIN";
const adminPassword = "efs1mpleg0at@";
const defaultOrdersFile = path.join(rootDir, "orders.json");
const ordersFile = configuredOrdersFile
  ? resolveStoragePath(configuredOrdersFile)
  : configuredDataDir
    ? path.join(resolveStoragePath(configuredDataDir), "orders.json")
    : defaultOrdersFile;
let databasePool = null;
let storageMode = databaseUrl ? "database" : "file";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return acc;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function resolveStoragePath(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(rootDir, targetPath);
}

function shouldUseDatabaseSsl() {
  if (!databaseUrl) return false;
  if (databaseSslMode === "disable" || databaseSslMode === "false" || databaseSslMode === "off") return false;
  if (databaseSslMode === "strict") return { rejectUnauthorized: true };
  if (databaseSslMode === "require" || databaseSslMode === "true" || databaseSslMode === "on") return { rejectUnauthorized: false };
  try {
    const parsed = new URL(databaseUrl);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return false;
  } catch {}
  return { rejectUnauthorized: false };
}

function getDatabasePool() {
  if (!databaseUrl) return null;
  if (!databasePool) {
    const { Pool } = require("pg");
    databasePool = new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseDatabaseSsl() || undefined
    });
  }
  return databasePool;
}

function ensureOrdersFile() {
  fs.mkdirSync(path.dirname(ordersFile), { recursive: true });
  if (!fs.existsSync(ordersFile)) {
    if (ordersFile !== defaultOrdersFile && fs.existsSync(defaultOrdersFile)) {
      const legacyOrders = fs.readFileSync(defaultOrdersFile, "utf8").trim();
      if (legacyOrders) {
        fs.writeFileSync(ordersFile, legacyOrders, "utf8");
        return;
      }
    }
    fs.writeFileSync(ordersFile, "[]", "utf8");
  }
}

function readOrders() {
  ensureOrdersFile();
  try {
    const raw = fs.readFileSync(ordersFile, "utf8").trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  ensureOrdersFile();
  const tempFile = `${ordersFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(orders, null, 2), "utf8");
  fs.renameSync(tempFile, ordersFile);
}

function appendOrderToFile(order) {
  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);
}

function removeOrderFromFile(orderNumber) {
  const orders = readOrders();
  const filteredOrders = orders.filter((order) => String(order.orderNumber || "") !== String(orderNumber || ""));
  if (filteredOrders.length === orders.length) {
    return false;
  }
  writeOrders(filteredOrders);
  return true;
}

function updateOrderInFile(originalOrderNumber, updatedOrder) {
  const orders = readOrders();
  const targetOrderNumber = String(originalOrderNumber || "");
  const existingIndex = orders.findIndex((order) => String(order.orderNumber || "") === targetOrderNumber);
  if (existingIndex === -1) {
    return { error: "order_not_found" };
  }

  const nextOrderNumber = String(updatedOrder?.orderNumber || "").trim();
  if (!nextOrderNumber) {
    return { error: "missing_order_number" };
  }

  const duplicateIndex = orders.findIndex((order, index) => index !== existingIndex && String(order.orderNumber || "") === nextOrderNumber);
  if (duplicateIndex !== -1) {
    return { error: "duplicate_order_number" };
  }

  const nextOrder = {
    ...orders[existingIndex],
    ...updatedOrder,
    orderNumber: nextOrderNumber
  };
  orders[existingIndex] = nextOrder;
  writeOrders(orders);
  return { order: nextOrder };
}

function normalizeOrderRecord(order, fallbackReceivedAt = "", fallbackOrderNumber = "") {
  return {
    ...(order && typeof order === "object" ? order : {}),
    orderNumber: String(order?.orderNumber || fallbackOrderNumber || "").trim(),
    receivedAt: String(order?.receivedAt || fallbackReceivedAt || "")
  };
}

async function initializeDatabase() {
  const pool = getDatabasePool();
  if (!pool) {
    storageMode = "file";
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_number TEXT PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL,
      order_data JSONB NOT NULL
    )
  `);

  const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM orders");
  const orderCount = Number(countResult.rows?.[0]?.total || 0);
  if (orderCount > 0) {
    storageMode = "database";
    return;
  }

  const legacyOrders = readOrders();
  if (!legacyOrders.length) {
    storageMode = "database";
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const legacyOrder of legacyOrders) {
      const normalizedOrder = normalizeOrderRecord(legacyOrder, legacyOrder?.receivedAt, legacyOrder?.orderNumber);
      if (!normalizedOrder.orderNumber) continue;
      const receivedAt = normalizedOrder.receivedAt || new Date().toISOString();
      await client.query(
        `
          INSERT INTO orders (order_number, received_at, order_data)
          VALUES ($1, $2::timestamptz, $3::jsonb)
          ON CONFLICT (order_number) DO UPDATE
          SET received_at = EXCLUDED.received_at,
              order_data = EXCLUDED.order_data
        `,
        [normalizedOrder.orderNumber, receivedAt, JSON.stringify({ ...normalizedOrder, receivedAt })]
      );
    }
    await client.query("COMMIT");
    storageMode = "database";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function readOrdersStore() {
  const pool = getDatabasePool();
  if (!pool) {
    return readOrders();
  }

  const result = await pool.query(`
    SELECT order_number, received_at, order_data
    FROM orders
    ORDER BY received_at DESC, order_number DESC
  `);

  return result.rows.map((row) => normalizeOrderRecord(row.order_data, row.received_at, row.order_number));
}

async function appendOrderToStore(order) {
  const pool = getDatabasePool();
  if (!pool) {
    appendOrderToFile(order);
    return { order };
  }

  const normalizedOrder = normalizeOrderRecord(order, order?.receivedAt, order?.orderNumber);
  if (!normalizedOrder.orderNumber) {
    return { error: "missing_order_number" };
  }

  const receivedAt = normalizedOrder.receivedAt || new Date().toISOString();
  const payload = { ...normalizedOrder, receivedAt };
  await pool.query(
    `
      INSERT INTO orders (order_number, received_at, order_data)
      VALUES ($1, $2::timestamptz, $3::jsonb)
      ON CONFLICT (order_number) DO UPDATE
      SET received_at = EXCLUDED.received_at,
          order_data = EXCLUDED.order_data
    `,
    [payload.orderNumber, receivedAt, JSON.stringify(payload)]
  );

  return { order: payload };
}

async function removeOrderFromStore(orderNumber) {
  const pool = getDatabasePool();
  if (!pool) {
    return removeOrderFromFile(orderNumber);
  }

  const result = await pool.query("DELETE FROM orders WHERE order_number = $1", [String(orderNumber || "").trim()]);
  return result.rowCount > 0;
}

async function updateOrderInStore(originalOrderNumber, updatedOrder) {
  const pool = getDatabasePool();
  if (!pool) {
    return updateOrderInFile(originalOrderNumber, updatedOrder);
  }

  const targetOrderNumber = String(originalOrderNumber || "").trim();
  if (!targetOrderNumber) {
    return { error: "missing_original_order_number" };
  }

  const nextOrderNumber = String(updatedOrder?.orderNumber || "").trim();
  if (!nextOrderNumber) {
    return { error: "missing_order_number" };
  }

  const existingResult = await pool.query(
    "SELECT order_number, received_at, order_data FROM orders WHERE order_number = $1",
    [targetOrderNumber]
  );
  if (!existingResult.rowCount) {
    return { error: "order_not_found" };
  }

  if (nextOrderNumber !== targetOrderNumber) {
    const duplicateResult = await pool.query("SELECT 1 FROM orders WHERE order_number = $1", [nextOrderNumber]);
    if (duplicateResult.rowCount) {
      return { error: "duplicate_order_number" };
    }
  }

  const existingOrder = normalizeOrderRecord(
    existingResult.rows[0].order_data,
    existingResult.rows[0].received_at,
    existingResult.rows[0].order_number
  );
  const nextOrder = normalizeOrderRecord(
    {
      ...existingOrder,
      ...updatedOrder,
      orderNumber: nextOrderNumber,
      receivedAt: updatedOrder?.receivedAt || existingOrder.receivedAt || new Date().toISOString()
    },
    existingOrder.receivedAt,
    nextOrderNumber
  );

  await pool.query(
    `
      UPDATE orders
      SET order_number = $2,
          received_at = $3::timestamptz,
          order_data = $4::jsonb
      WHERE order_number = $1
    `,
    [targetOrderNumber, nextOrderNumber, nextOrder.receivedAt, JSON.stringify(nextOrder)]
  );

  return { order: nextOrder };
}

function getTelegramChatId() {
  if (fs.existsSync(managerChatFile)) {
    const fileChatId = fs.readFileSync(managerChatFile, "utf8").trim();
    if (fileChatId) {
      return fileChatId;
    }
  }
  return telegramChatId;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(body);
}

function readBasicAuth(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function hasAdminAccess(req) {
  const credentials = readBasicAuth(req);
  if (!credentials) return false;
  return credentials.username === adminUsername && credentials.password === adminPassword;
}

function sendAdminUnauthorized(res) {
  const body = JSON.stringify({ error: "admin_auth_required" });
  res.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "WWW-Authenticate": 'Basic realm="ENTRYFRAG Admin"'
  });
  res.end(body);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".cmd": "text/plain; charset=utf-8"
  };

  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function telegramRequest(method, payload) {
  return new Promise((resolve, reject) => {
    if (!telegramBotToken) {
      reject(new Error("missing_bot_token"));
      return;
    }
    const activeChatId = getTelegramChatId();
    if (!activeChatId) {
      reject(new Error("missing_chat_id"));
      return;
    }

    const body = JSON.stringify({
      ...payload,
      chat_id: payload.chat_id || activeChatId
    });
    const request = https.request(
      `https://api.telegram.org/bot${telegramBotToken}/${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            const data = raw ? JSON.parse(raw) : {};
            if (response.statusCode >= 400 || data.ok === false) {
              reject(new Error(data.description || "telegram_send_failed"));
              return;
            }
            resolve(data);
          } catch {
            reject(new Error("telegram_send_failed"));
          }
        });
      }
    );

    request.on("error", () => reject(new Error("telegram_send_failed")));
    request.write(body);
    request.end();
  });
}

async function handleOrderRequest(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody || "{}");
    const order = parsed.order || parsed;
    const telegram = parsed.telegram || null;

    if (!order.orderNumber) {
      sendJson(res, 400, { error: "missing_order_number" });
      return;
    }

    if (telegram && telegram.message) {
      await telegramRequest("sendMessage", {
        text: telegram.message,
        reply_markup: telegram.replyMarkup || undefined
      });
    }

    const orderRecord = {
      ...order,
      receivedAt: new Date().toISOString()
    };
    const result = await appendOrderToStore(orderRecord);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
      return;
    }
    sendJson(res, 200, { status: "ok" });
  } catch (error) {
    const knownStatus = {
      missing_bot_token: 503,
      missing_chat_id: 503,
      telegram_send_failed: 502,
      payload_too_large: 413,
      ECONNREFUSED: 503
    };
    const code = knownStatus[error.message] || 500;
    sendJson(res, code, { error: error.message || "internal" });
  }
}

async function handleDeleteOrderRequest(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody || "{}");
    const orderNumber = String(parsed.orderNumber || "").trim();

    if (!orderNumber) {
      sendJson(res, 400, { error: "missing_order_number" });
      return;
    }

    const deleted = await removeOrderFromStore(orderNumber);
    if (!deleted) {
      sendJson(res, 404, { error: "order_not_found" });
      return;
    }

    sendJson(res, 200, { status: "ok", deletedOrderNumber: orderNumber });
  } catch (error) {
    const code = error.message === "payload_too_large" ? 413 : 500;
    sendJson(res, code, { error: error.message || "internal" });
  }
}

async function handleUpdateOrderRequest(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody || "{}");
    const originalOrderNumber = String(parsed.originalOrderNumber || "").trim();
    const updatedOrder = parsed.order;

    if (!originalOrderNumber) {
      sendJson(res, 400, { error: "missing_original_order_number" });
      return;
    }

    if (!updatedOrder || typeof updatedOrder !== "object" || Array.isArray(updatedOrder)) {
      sendJson(res, 400, { error: "missing_order_payload" });
      return;
    }

    const result = await updateOrderInStore(originalOrderNumber, updatedOrder);
    if (result.error) {
      const statusCode = result.error === "order_not_found" ? 404 : 400;
      sendJson(res, statusCode, { error: result.error });
      return;
    }

    sendJson(res, 200, { status: "ok", order: result.order });
  } catch (error) {
    const code = error.message === "payload_too_large" ? 413 : 500;
    sendJson(res, code, { error: error.message || "internal" });
  }
}

async function handleOrdersHistory(res) {
  const orders = await readOrdersStore();
  sendJson(res, 200, { orders });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", storage: storageMode });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/orders") {
    if (!hasAdminAccess(req)) {
      sendAdminUnauthorized(res);
      return;
    }
    await handleOrdersHistory(res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/orders") {
    await handleOrderRequest(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/orders/delete") {
    if (!hasAdminAccess(req)) {
      sendAdminUnauthorized(res);
      return;
    }
    await handleDeleteOrderRequest(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/orders/update") {
    if (!hasAdminAccess(req)) {
      sendAdminUnauthorized(res);
      return;
    }
    await handleUpdateOrderRequest(req, res);
    return;
  }

  const safePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const targetPath = safePath === "/" ? path.join(rootDir, "index.html") : path.join(rootDir, safePath);
  sendFile(res, targetPath);
});

(async () => {
  try {
    await initializeDatabase();
    server.listen(port, () => {
      console.log(`ENTRYFRAG hosted backend running on http://localhost:${port} using ${storageMode} storage`);
    });
  } catch (error) {
    console.error("Failed to initialize storage", error);
    process.exit(1);
  }
})();
