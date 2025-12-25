# Flash UI

Creative UI generation in a flash ⚡

## Local Development

**Important:** For local development with scraping feature, use:

```bash
npm run dev
```

This starts:
- ✅ Vite dev server (port 3000)
- ✅ Scraping API server (port 3001)

**Do NOT use** `npm start` for development - it doesn't include the scraping server!

---

## Production Deployment

The app is configured for **serverless** deployment on static hosting platforms.

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add `GEMINI_API_KEY` environment variable
4. Deploy ✅

### Deploy to Netlify

1. Push code to GitHub  
2. Import project on [netlify.com](https://netlify.com)
3. Add `GEMINI_API_KEY` environment variable
4. Deploy ✅

**Build command:** `npm run build`  
**Output directory:** `dist`

---

## How Scraping Works

**Local Development:**
- Express server on port 3001
- Proxied via Vite to `/api/scrape`

**Production (Vercel/Netlify):**
- Serverless function handles `/api/scrape`
- No server needed!

---

## Scripts

- `npm run dev` - Development mode (Vite + Server)
- `npm run build` - Build for production
- `npm start` - Preview built files (no scraping in local preview)

---

## Features

- ✨ AI-powered UI generation
- 🎨 Interactive design variations
- 📱 Responsive preview modes
- 🌐 Website scraping & import
- 💻 Magic Edit mode
- ⬇️ HTML export

---

Built with React + Vite + Google Gemini AI
