# ENTRYFRAG Hosted Backend

## What was added

- `server.js` - hosted backend for orders and Telegram sending
- `package.json` - Node start scripts
- `.env.example` - required environment variables
- `entryfrag-config.js` - frontend API config
- `entryfrag-config.example.js` - example for separate frontend/backend deploy

## Deploy options

### Option 1: one deploy for both frontend and backend

Use the whole project as a Node app.

1. Install Node 18+
2. Copy `.env.example` to `.env`
3. Fill:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
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
3. In frontend, set `entryfrag-config.js` like:

```js
window.ENTRYFRAG_API_URL = "https://your-backend-url.onrender.com";
```

4. Publish frontend files to GitHub Pages

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
