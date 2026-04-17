const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const rootDir = __dirname;
const ordersFile = path.join(rootDir, "orders.json");
const managerChatFile = path.join(rootDir, "telegram-manager-chat.txt");
const env = loadEnv(path.join(rootDir, ".env"));
const port = Number(env.PORT || process.env.PORT || 3000);
const telegramBotToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "";
const corsOrigin = env.CORS_ORIGIN || process.env.CORS_ORIGIN || "*";
const adminUsername = "ENTRYFRAGADMIN";
const adminPassword = "efs1mpleg0at@";

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

function ensureOrdersFile() {
  if (!fs.existsSync(ordersFile)) {
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
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}

function appendOrder(order) {
  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);
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
    "Access-Control-Allow-Headers": "Content-Type"
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
    appendOrder(orderRecord);
    sendJson(res, 200, { status: "ok" });
  } catch (error) {
    const knownStatus = {
      missing_bot_token: 503,
      missing_chat_id: 503,
      telegram_send_failed: 502,
      payload_too_large: 413
    };
    const code = knownStatus[error.message] || 500;
    sendJson(res, code, { error: error.message || "internal" });
  }
}

function handleOrdersHistory(res) {
  const orders = readOrders().sort((a, b) => String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")));
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
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/orders") {
    if (!hasAdminAccess(req)) {
      sendAdminUnauthorized(res);
      return;
    }
    handleOrdersHistory(res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/orders") {
    await handleOrderRequest(req, res);
    return;
  }

  const safePath = path.normalize(decodeURIComponent(requestUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const targetPath = safePath === "/" ? path.join(rootDir, "index.html") : path.join(rootDir, safePath);
  sendFile(res, targetPath);
});

server.listen(port, () => {
  console.log(`ENTRYFRAG hosted backend running on http://localhost:${port}`);
});
