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
