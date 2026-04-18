export type ModelTier = 'flash' | 'pro';

export interface PricingRate {
  input: number;
  output: number;
}

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  audioDurationSec: number;
  inputCostUSD: string;
  outputCostUSD: string;
  totalUSD: string;
  totalTHB: string;
}

export interface UsageMetadataLike {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

export interface SpeechResult {
  audioWavBase64: string;
  usage: CostBreakdown;
}

export interface SingleSpeakerRequest {
  text: string;
  voiceName?: string;
  modelTier?: ModelTier;
}

export interface StyledSpeakerRequest extends SingleSpeakerRequest {
  directorNotes: string;
}

export interface ScriptLine {
  speaker: string;
  text: string;
}

export interface SpeakerConfig {
  name: string;
  voice: string;
}

export interface PodcastRequest {
  topic: string;
  hostName?: string;
  guestName?: string;
  hostVoice?: string;
  guestVoice?: string;
  modelTier?: ModelTier;
}

export interface PodcastFromScriptRequest {
  script: ScriptLine[];
  speakers: SpeakerConfig[];
  modelTier?: ModelTier;
}

export interface SessionTotals {
  calls: number;
  totalUSD: string;
  totalTHB: string;
}

export interface CostEntry {
  timestamp: string;
  modelTier: ModelTier;
  usage: CostBreakdown;
}
