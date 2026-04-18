# Gemini TTS Demo

Studio-style demo for Gemini TTS on Node.js + TypeScript + Express.

## Features (Phase 1-2)

- Single-speaker text-to-speech with configurable voice
- Expressive style generation using Director Notes
- Preset character gallery (Radio DJ, Narrator, Podcast Host, etc.)
- A/B compare mode for base vs styled voice output
- WAV audio playback in browser
- Token usage and cost summary (USD/THB)
- Session cost accumulation and reset

## Requirements

- Node.js 20+
- GEMINI_API_KEY

## Setup

1. Copy `.env.example` to `.env`
2. Add your API key to `.env`
3. Install dependencies

```bash
npm install
```

## Run (dev)

```bash
npm run dev
```

Open http://localhost:3000

## Build and run

```bash
npm run build
npm start
```

## API Endpoints

- `GET /api/health`
- `GET /api/presets`
- `POST /api/tts/single`
- `POST /api/tts/style`
- `GET /api/session`
- `POST /api/session/reset`
