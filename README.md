# Critical Nodes — AI Render Studio

Transform architectural 3D models into photorealistic renders using Google Gemini's image generation. Upload your Rhino model screenshot, reference materials, and furniture — describe the scene — and generate.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your Gemini API key to `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Models

- **Nano Banana 2** (`gemini-3.1-flash-image-preview`) — fast, cost-efficient, recommended
- **Nano Banana Pro** (`gemini-3-pro-image-preview`) — highest quality

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4, shadcn/ui
- Framer Motion
- Google Gemini API (`@google/genai`)
- Outfit + Playfair Display typography
