# ENTRYFRAG Hosted Backend

## What was added

- `server.js` - hosted backend for orders and Telegram sending
- `package.json` - Node start scripts
- `.env.example` - required environment variables
- `entryfrag-config.js` - frontend API config
- `entryfrag-config.example.js` - example for separate frontend/backend deploy

## Storage modes

The hosted backend now supports two order-storage modes:

- `DATABASE_URL` set: orders are stored in Postgres
- no `DATABASE_URL`: orders fall back to local `orders.json`

For Render, use Postgres. Free Render web services have an ephemeral filesystem, so file storage will eventually lose old orders after a restart or redeploy.

## Deploy options

### Option 1: one deploy for both frontend and backend

Use the whole project as a Node app.

1. Install Node 18+
2. Copy `.env.example` to `.env`
3. Fill:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `DATABASE_URL`
   - optional: `DATABASE_SSL=require`
4. Run:
   - `npm start`

The site will open from the same server and frontend will use `/api/orders` automatically.

### Option 2: GitHub Pages for frontend + separate backend

1. Deploy `server.js` project to Render/Railway/Glitch
2. Set env vars there:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `PORT`
   - `CORS_ORIGIN`
   - `DATABASE_URL`
   - optional: `DATABASE_SSL=require`
3. In frontend, set `entryfrag-config.js` like:

```js
window.ENTRYFRAG_API_URL = "https://your-backend-url.onrender.com";
```

4. Publish frontend files to GitHub Pages

## Render free setup

If you want to keep the app on Render without paying for a disk:

1. Create a free Postgres database outside the web service, such as Neon
2. Copy the connection string into Render as `DATABASE_URL`
3. Redeploy the backend

On startup, the backend creates the `orders` table automatically. If the database is empty and a local `orders.json` file exists, it imports those legacy orders once.

## Local fallback

If you run the project locally without `DATABASE_URL`, the backend still uses `orders.json`. This keeps the local QA scripts and simple local testing working.

## Telegram chat id

For private bot messages, use numeric `chat_id`, not `@username`.

You now have two supported ways:

1. Set `TELEGRAM_CHAT_ID` in `.env`
2. Or let the manager account open the bot and press `/start` or `/bindmanager`

If `telegram-manager-chat.txt` exists, the backend will use that manager chat automatically before falling back to `.env`.

## Health check

- `GET /api/health`
- `POST /api/orders`
- `GET /api/orders`
