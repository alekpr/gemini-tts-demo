import { GoogleGenAI } from '@google/genai';
import { calculateCost } from '../utils/costCalculator';
import { pcm16MonoToWav } from '../utils/wavEncoder';
import { ModelTier, SpeechResult, UsageMetadataLike } from '../types';
import { buildDirectorPrompt } from './presets';

const MODEL_MAP: Record<ModelTier, string> = {
  flash: 'gemini-2.5-flash-preview-tts',
  pro: 'gemini-2.5-pro-preview-tts'
};

const AUDIO_TAG_PATTERN = /\[[^\]]+\]/;

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment. Add it to .env before generating speech.');
  }

  return apiKey;
}

function extractAudioBase64(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error('No audio response returned by Gemini API.');
  }

  const audioPart = parts.find((part: any) => part?.inlineData?.data);
  const data = audioPart?.inlineData?.data;
  if (!data) {
    throw new Error('Gemini API response did not include inline audio data.');
  }

  return data;
}

function buildSpeechPrompt(inputText: string): string {
  const hasAudioTags = AUDIO_TAG_PATTERN.test(inputText);

  if (!hasAudioTags) {
    return inputText;
  }

  return [
    'You are generating expressive speech audio from a transcript.',
    'Treat text in square brackets as performance cues (emotion, tone, pace, delivery).',
    'Do not speak the bracket tags literally.',
    'Apply noticeable variation between tagged segments while keeping natural voice quality.',
    'Transcript:',
    inputText
  ].join('\n');
}

export async function generateSingleSpeakerSpeech(
  text: string,
  voiceName = 'Kore',
  modelTier: ModelTier = 'flash'
): Promise<SpeechResult> {
  return generateSpeechFromPrompt(buildSpeechPrompt(text), voiceName, modelTier);
}

async function generateSpeechFromPrompt(
  promptText: string,
  voiceName: string,
  modelTier: ModelTier
): Promise<SpeechResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = MODEL_MAP[modelTier];

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const audioPcmBase64 = extractAudioBase64(response as any);
  const audioPcmBuffer = Buffer.from(audioPcmBase64, 'base64');
  const wavBuffer = pcm16MonoToWav(audioPcmBuffer);

  const usageMeta = (response as any).usageMetadata as UsageMetadataLike;
  const usage = calculateCost(usageMeta ?? {}, modelTier);

  return {
    audioWavBase64: wavBuffer.toString('base64'),
    usage
  };
}

export async function generateStyledSpeakerSpeech(
  transcript: string,
  directorNotes: string,
  voiceName = 'Kore',
  modelTier: ModelTier = 'flash'
): Promise<SpeechResult> {
  const prompt = buildSpeechPrompt(buildDirectorPrompt(transcript, directorNotes));
  return generateSpeechFromPrompt(prompt, voiceName, modelTier);
}
