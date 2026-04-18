import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { generateSingleSpeakerSpeech, generateStyledSpeakerSpeech } from './tts/singleSpeaker';
import { generateMultiSpeakerSpeech, generatePodcastPipeline, generatePodcastScript } from './tts/multiSpeaker';
import { generateTaggedTranscript } from './tts/transcriptGenerator';
import { PRESETS } from './tts/presets';
import {
  ModelTier,
  PodcastFromScriptRequest,
  PodcastRequest,
  SingleSpeakerRequest,
  StyledSpeakerRequest,
  TranscriptGenerateRequest
} from './types';
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

function normalizePodcastInput(body: PodcastRequest): Required<PodcastRequest> {
  const topic = body.topic?.trim();
  const hostName = body.hostName?.trim() || 'HOST';
  const guestName = body.guestName?.trim() || 'GUEST';
  const hostVoice = body.hostVoice?.trim() || 'Puck';
  const guestVoice = body.guestVoice?.trim() || 'Kore';
  const modelTier = body.modelTier || 'flash';

  if (!topic) {
    throw new Error('Topic is required.');
  }

  if (topic.length > 500) {
    throw new Error('Topic is too long. Maximum 500 characters.');
  }

  if (hostName === guestName) {
    throw new Error('Host and guest names must be different.');
  }

  if (!ALLOWED_MODELS.includes(modelTier)) {
    throw new Error('Invalid model tier. Use flash or pro.');
  }

  return {
    topic,
    hostName,
    guestName,
    hostVoice,
    guestVoice,
    modelTier
  };
}

function normalizePodcastFromScriptInput(body: PodcastFromScriptRequest): Required<PodcastFromScriptRequest> {
  const script = Array.isArray(body.script)
    ? body.script
        .map((line) => ({
          speaker: String(line.speaker || '').trim(),
          text: String(line.text || '').trim()
        }))
        .filter((line) => line.speaker.length > 0 && line.text.length > 0)
    : [];

  const speakers = Array.isArray(body.speakers)
    ? body.speakers
        .map((speaker) => ({
          name: String(speaker.name || '').trim(),
          voice: String(speaker.voice || '').trim()
        }))
        .filter((speaker) => speaker.name.length > 0 && speaker.voice.length > 0)
    : [];

  const modelTier = body.modelTier || 'flash';

  if (script.length < 4) {
    throw new Error('Script is required and must include at least 4 lines.');
  }

  if (speakers.length !== 2) {
    throw new Error('Exactly 2 speakers are required.');
  }

  if (!ALLOWED_MODELS.includes(modelTier)) {
    throw new Error('Invalid model tier. Use flash or pro.');
  }

  return {
    script,
    speakers,
    modelTier
  };
}

function normalizeTranscriptInput(body: TranscriptGenerateRequest): Required<TranscriptGenerateRequest> {
  const requirements = body.requirements?.trim();
  const language = body.language || 'mix';
  const vibe = body.vibe?.trim() || 'Expressive, conversational, and clear';
  const targetDurationSec = body.targetDurationSec || 25;

  if (!requirements) {
    throw new Error('Requirements are required.');
  }

  if (requirements.length > 2000) {
    throw new Error('Requirements are too long. Maximum 2000 characters.');
  }

  if (!['th', 'en', 'mix'].includes(language)) {
    throw new Error('Invalid language. Use th, en, or mix.');
  }

  if (targetDurationSec < 5 || targetDurationSec > 180) {
    throw new Error('targetDurationSec must be between 5 and 180 seconds.');
  }

  return {
    requirements,
    language,
    vibe,
    targetDurationSec
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

app.post('/api/transcript/generate', async (req, res) => {
  try {
    const request = normalizeTranscriptInput(req.body as TranscriptGenerateRequest);
    const result = await generateTaggedTranscript(request);

    res.json({
      transcript: result.transcript,
      usage: result.usage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

app.post('/api/podcast/script', async (req, res) => {
  try {
    const { topic, hostName, guestName } = normalizePodcastInput(req.body as PodcastRequest);
    const result = await generatePodcastScript(topic, hostName, guestName);

    logSessionCost('flash', result.usage);

    res.json({
      script: result.script,
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

app.post('/api/podcast/audio', async (req, res) => {
  try {
    const { script, speakers, modelTier } = normalizePodcastFromScriptInput(req.body as PodcastFromScriptRequest);
    const result = await generateMultiSpeakerSpeech(script, speakers, modelTier);

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

app.post('/api/podcast/generate', async (req, res) => {
  try {
    const { topic, hostName, guestName, hostVoice, guestVoice, modelTier } = normalizePodcastInput(
      req.body as PodcastRequest
    );
    const result = await generatePodcastPipeline(topic, hostName, guestName, hostVoice, guestVoice, modelTier);

    logSessionCost('flash', result.step1Usage);
    logSessionCost(modelTier, result.step2Usage);

    res.json({
      script: result.script,
      audioBase64: result.audioWavBase64,
      mimeType: 'audio/wav',
      step1: {
        model: 'gemini-2.5-flash',
        usage: result.step1Usage
      },
      step2: {
        model: modelTier === 'pro' ? 'gemini-2.5-pro-preview-tts' : 'gemini-2.5-flash-preview-tts',
        usage: result.step2Usage
      },
      total: {
        totalUSD: result.totalUSD,
        totalTHB: result.totalTHB
      },
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
