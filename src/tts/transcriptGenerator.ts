import { GoogleGenAI } from '@google/genai';
import { TranscriptGenerateRequest, UsageMetadataLike } from '../types';

const TEXT_MODEL = 'gemini-2.5-flash';

export interface TranscriptGenerationResult {
  transcript: string;
  usage: UsageMetadataLike;
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment. Add it to .env before generating transcript.');
  }

  return apiKey;
}

function languageHint(language: TranscriptGenerateRequest['language']): string {
  if (language === 'th') {
    return 'Write transcript in Thai. Keep audio tags in English.';
  }

  if (language === 'en') {
    return 'Write transcript in English. Keep audio tags in English.';
  }

  return 'Write transcript in Thai and English naturally mixed. Keep audio tags in English.';
}

function extractTextResponse(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error('Transcript generation response did not include content parts.');
  }

  const text = parts.map((part: any) => part?.text || '').join('').trim();
  if (!text) {
    throw new Error('Transcript generation returned empty text.');
  }

  return text;
}

export async function generateTaggedTranscript(request: Required<TranscriptGenerateRequest>): Promise<TranscriptGenerationResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const prompt = [
    'You are writing a TTS transcript for a speech synthesis demo.',
    languageHint(request.language),
    `Audience requirements: ${request.requirements}`,
    `Overall vibe: ${request.vibe}`,
    `Target duration: around ${request.targetDurationSec} seconds`,
    'Rules:',
    '- Return transcript text only, no markdown, no explanations',
    '- Include inline audio tags in English such as [excited], [serious], [whispers], [laughs], [shouting], [curious]',
    '- Spread tags naturally throughout the transcript',
    '- Keep it concise and speakable',
    '- Do not output JSON'
  ].join('\n');

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ parts: [{ text: prompt }] }]
  });

  return {
    transcript: extractTextResponse(response as any),
    usage: ((response as any).usageMetadata ?? {}) as UsageMetadataLike
  };
}
