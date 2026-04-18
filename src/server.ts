import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { generateSingleSpeakerSpeech, generateStyledSpeakerSpeech } from './tts/singleSpeaker';
import { PRESETS } from './tts/presets';
import { ModelTier, SingleSpeakerRequest, StyledSpeakerRequest } from './types';
import { getSessionEntries, getSessionTotals, logSessionCost, resetSession } from './utils/sessionLogger';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_MODELS: ModelTier[] = ['flash', 'pro'];

function normalizeInput(body: SingleSpeakerRequest): Required<SingleSpeakerRequest> {
  const text = body.text?.trim();
  const voiceName = body.voiceName?.trim() || 'Kore';
  const modelTier = body.modelTier || 'flash';

  if (!text) {
    throw new Error('Text is required.');
  }

  if (text.length > 4000) {
    throw new Error('Text is too long. Maximum 4000 characters.');
  }

  if (!ALLOWED_MODELS.includes(modelTier)) {
    throw new Error('Invalid model tier. Use flash or pro.');
  }

  return { text, voiceName, modelTier };
}

function normalizeStyledInput(body: StyledSpeakerRequest): Required<StyledSpeakerRequest> {
  const base = normalizeInput(body);
  const directorNotes = body.directorNotes?.trim();

  if (!directorNotes) {
    throw new Error('Director notes are required for style generation.');
  }

  if (directorNotes.length > 2000) {
    throw new Error('Director notes are too long. Maximum 2000 characters.');
  }

  return {
    ...base,
    directorNotes
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'gemini-tts-demo' });
});

app.get('/api/presets', (_req, res) => {
  res.json({ presets: PRESETS });
});

app.post('/api/tts/single', async (req, res) => {
  try {
    const { text, voiceName, modelTier } = normalizeInput(req.body as SingleSpeakerRequest);
    const result = await generateSingleSpeakerSpeech(text, voiceName, modelTier);

    logSessionCost(modelTier, result.usage);

    res.json({
      audioBase64: result.audioWavBase64,
      mimeType: 'audio/wav',
      usage: result.usage,
      session: {
        totals: getSessionTotals(),
        recent: getSessionEntries().slice(0, 5)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

app.post('/api/tts/style', async (req, res) => {
  try {
    const { text, voiceName, modelTier, directorNotes } = normalizeStyledInput(req.body as StyledSpeakerRequest);
    const result = await generateStyledSpeakerSpeech(text, directorNotes, voiceName, modelTier);

    logSessionCost(modelTier, result.usage);

    res.json({
      audioBase64: result.audioWavBase64,
      mimeType: 'audio/wav',
      usage: result.usage,
      session: {
        totals: getSessionTotals(),
        recent: getSessionEntries().slice(0, 5)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

app.get('/api/session', (_req, res) => {
  res.json({
    totals: getSessionTotals(),
    entries: getSessionEntries()
  });
});

app.post('/api/session/reset', (_req, res) => {
  resetSession();
  res.json({ ok: true });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Gemini TTS demo server running on http://localhost:${port}`);
});
