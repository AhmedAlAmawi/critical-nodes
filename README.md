# Critical Nodes — Design Visualization Discipline

A structured visualization discipline tool that helps students articulate, justify, and align visual decisions when using AI in design education.

Critical Nodes guides students through a 7-node workflow — from intent definition through visual priority, reference analysis, geometry validation, material & lighting decisions, prompt construction, and reflective post-render audit. Each node builds on the last, teaching students to think deliberately about every design decision before generating AI-mediated architectural visualizations.

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

## Nodes

1. **Design Mentor** — Articulate foundational intent through Socratic reflection
2. **Visual Priority Locator** — Identify what deserves visualization
3. **Reference Deconstruction** — Analytically deconstruct visual references
4. **Geometry & View Validation** — Upload 3D model and validate camera view
5. **Material & Light Validation** — Justify materials and define lighting logic
6. **Prompt Architecture** — Construct the render prompt (structure → reference → vision)
7. **Alignment Audit** — Reflect on the render against declared intent

## AI Features

- **Concept Clarity Summary** — AI evaluates your intent and provides feedback
- **Reference Alignment Alerts** — Advisory when references contradict intent
- **Material-Light Interaction Checks** — Flags inconsistencies between materials and lighting
- **Sketch Evaluation** — Upload hand-drawn sketches for AI feedback

## Models

- **Nano Banana 2** (`gemini-3.1-flash-image-preview`) — fast, cost-efficient
- **Nano Banana Pro** (`gemini-3-pro-image-preview`) — highest quality

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4, shadcn/ui
- Framer Motion
- Google Gemini API (`@google/genai`)
- Outfit + Playfair Display typography
