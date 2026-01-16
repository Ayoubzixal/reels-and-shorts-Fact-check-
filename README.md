# Video Fact Checker

AI-powered video fact-checking application that analyzes YouTube, TikTok, Instagram, and other social media videos for misinformation using Google Gemini AI.

## Features

- 🎥 **URL-based video analysis** - Paste any video URL from supported platforms
- 🎤 **AI Transcription** - Accurate transcription using Gemini 2.5 Flash
- ✅ **Fact-Checking** - Verify claims using Gemini 3 Flash Preview
- 🌍 **Multi-language** - Support for 13+ languages
- 📊 **Visual Results** - Clear true/false/misleading breakdown with sources

## Supported Platforms

- YouTube
- TikTok
- Instagram
- Twitter/X
- Facebook

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **AI**: Google Gemini API
- **Video Processing**: yt-dlp + FFmpeg

---

## 🚀 Deployment to Railway

### Prerequisites

1. A [Railway](https://railway.app) account (free tier available with $5/month credit)
2. A [GitHub](https://github.com) account
3. A [Google AI Studio](https://aistudio.google.com/) API key

### Step 1: Push to GitHub

Make sure your code is pushed to your GitHub repository:

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Deploy Backend on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect the backend - click on it
5. Go to **Settings** → **Root Directory** → Set to `backend`
6. Go to **Variables** and add:
   - `GEMINI_API_KEY` = your Gemini API key
   - `PORT` = 3001
7. Click **Deploy**
8. Go to **Settings** → **Networking** → **Generate Domain**
9. Copy the generated URL (e.g., `https://your-app.up.railway.app`)

### Step 3: Deploy Frontend on Railway

1. In the same project, click **"New"** → **"GitHub Repo"**
2. Select the same repository
3. Go to **Settings** → **Root Directory** → Set to `frontend`
4. Go to **Variables** and add:
   - `VITE_API_URL` = `https://your-backend-url.up.railway.app/api` (from Step 2)
5. Click **Deploy**
6. Go to **Settings** → **Networking** → **Generate Domain**
7. Your frontend is now live!

---

## Local Development

### Backend Setup

```bash
cd backend
npm install
# Create .env file with your GEMINI_API_KEY
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Environment Variables

### Backend (.env)

```
GEMINI_API_KEY=your_key_here
PORT=3001
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3001/api
```

---

## License

MIT
