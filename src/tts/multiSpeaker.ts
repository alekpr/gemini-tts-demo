import { GoogleGenAI } from '@google/genai';
import { calculateCost } from '../utils/costCalculator';
import { pcm16MonoToWav } from '../utils/wavEncoder';
import { CostBreakdown, ModelTier, ScriptLine, SpeakerConfig, UsageMetadataLike } from '../types';

export interface ScriptGenerationResult {
  script: ScriptLine[];
  usage: CostBreakdown;
}

export interface MultiSpeakerResult {
  audioWavBase64: string;
  usage: CostBreakdown;
}

export interface PodcastPipelineResult {
  script: ScriptLine[];
  audioWavBase64: string;
  step1Usage: CostBreakdown;
  step2Usage: CostBreakdown;
  totalUSD: string;
  totalTHB: string;
}

const TTS_MODEL_MAP: Record<ModelTier, string> = {
  flash: 'gemini-2.5-flash-preview-tts',
  pro: 'gemini-2.5-pro-preview-tts'
};

const SCRIPT_MODEL = 'gemini-2.5-flash';

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in environment. Add it to .env before generating podcast.');
  }

  return apiKey;
}

function createClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

function extractTextResponse(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error('Script generation response did not include content parts.');
  }

  const text = parts.map((part: any) => part?.text || '').join('').trim();
  if (!text) {
    throw new Error('Script generation returned empty text.');
  }

  return text;
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

function parseScriptJson(rawText: string): ScriptLine[] {
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fencedMatch?.[1] ?? rawText;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Script JSON parsing failed. Try a different topic and regenerate.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Script generation format is invalid. Expected an array of lines.');
  }

  const normalized = parsed
    .map((line) => {
      const speaker = typeof line?.speaker === 'string' ? line.speaker.trim() : '';
      const text = typeof line?.text === 'string' ? line.text.trim() : '';
      return { speaker, text };
    })
    .filter((line) => line.speaker.length > 0 && line.text.length > 0);

  if (normalized.length < 4) {
    throw new Error('Generated script is too short. Need at least 4 dialogue lines.');
  }

  return normalized;
}

function sumCost(step1Usage: CostBreakdown, step2Usage: CostBreakdown): { totalUSD: string; totalTHB: string } {
  const totalUSD = Number(step1Usage.totalUSD) + Number(step2Usage.totalUSD);
  const totalTHB = Number(step1Usage.totalTHB) + Number(step2Usage.totalTHB);

  return {
    totalUSD: totalUSD.toFixed(6),
    totalTHB: totalTHB.toFixed(4)
  };
}

export async function generatePodcastScript(
  topic: string,
  hostName: string,
  guestName: string
): Promise<ScriptGenerationResult> {
  const ai = createClient();
  const prompt = [
    `Create a 2-speaker podcast dialogue about: ${topic}`,
    `Speakers: ${hostName} and ${guestName}`,
    'Return strict JSON only. No markdown. Format:',
    '[{"speaker":"HOST_NAME","text":"..."},{"speaker":"GUEST_NAME","text":"..."}]',
    'Rules:',
    '- Exactly 10 to 14 lines',
    '- Alternate naturally between speakers',
    '- Mix Thai and English naturally where useful',
    '- Keep each line short and speakable'
  ].join('\n');

  const response = await ai.models.generateContent({
    model: SCRIPT_MODEL,
    contents: [{ parts: [{ text: prompt }] }]
  });

  const rawText = extractTextResponse(response as any);
  const script = parseScriptJson(rawText);
  const usageMeta = (response as any).usageMetadata as UsageMetadataLike;
  const usage = calculateCost(usageMeta ?? {}, 'flash');

  return {
    script,
    usage
  };
}

export async function generateMultiSpeakerSpeech(
  script: ScriptLine[],
  speakers: SpeakerConfig[],
  modelTier: ModelTier = 'flash'
): Promise<MultiSpeakerResult> {
  const ai = createClient();
  const model = TTS_MODEL_MAP[modelTier];

  if (speakers.length !== 2) {
    throw new Error('Multi-speaker synthesis requires exactly 2 speakers.');
  }

  const prompt = `TTS the following conversation:\n${script
    .map((line) => `${line.speaker}: ${line.text}`)
    .join('\n')}`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map((speaker) => ({
            speaker: speaker.name,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: speaker.voice }
            }
          }))
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

export async function generatePodcastPipeline(
  topic: string,
  hostName: string,
  guestName: string,
  hostVoice: string,
  guestVoice: string,
  modelTier: ModelTier = 'flash'
): Promise<PodcastPipelineResult> {
  const step1 = await generatePodcastScript(topic, hostName, guestName);

  const speakers: SpeakerConfig[] = [
    { name: hostName, voice: hostVoice },
    { name: guestName, voice: guestVoice }
  ];

  const step2 = await generateMultiSpeakerSpeech(step1.script, speakers, modelTier);
  const totals = sumCost(step1.usage, step2.usage);

  return {
    script: step1.script,
    audioWavBase64: step2.audioWavBase64,
    step1Usage: step1.usage,
    step2Usage: step2.usage,
    totalUSD: totals.totalUSD,
    totalTHB: totals.totalTHB
  };
}
