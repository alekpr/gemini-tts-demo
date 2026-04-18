import { ModelTier } from '../types';

export interface ScriptLine {
  speaker: string;
  text: string;
}

export interface SpeakerConfig {
  name: string;
  voice: string;
}

export interface PodcastResult {
  audioBase64: string;
  modelTier: ModelTier;
}

// Phase 3 implementation will land in the next iteration.
export async function generatePodcastDemo(): Promise<PodcastResult> {
  return {
    audioBase64: '',
    modelTier: 'flash'
  };
}
