export interface VoicePreset {
  label: string;
  voice: string;
  directorNotes: string;
}

export type PresetKey =
  | 'radioDJ'
  | 'calmNarrator'
  | 'podcastHost'
  | 'horrorStoryteller'
  | 'newsAnchor'
  | 'morningHost';

export const PRESETS: Record<PresetKey, VoicePreset> = {
  radioDJ: {
    label: 'Radio DJ Bangkok',
    voice: 'Puck',
    directorNotes:
      'Style: High-energy DJ with warm Thai-English delivery\nPacing: Fast and bouncy\nAccent: Thai-accented English'
  },
  calmNarrator: {
    label: 'Calm Narrator',
    voice: 'Kore',
    directorNotes:
      'Style: Measured, informative, steady\nPacing: Deliberate with clear pauses\nAccent: Neutral clear pronunciation'
  },
  podcastHost: {
    label: 'Podcast Host',
    voice: 'Aoede',
    directorNotes:
      'Style: Conversational and breezy\nPacing: Medium with natural rhythm\nAccent: Contemporary global English'
  },
  horrorStoryteller: {
    label: 'Horror Storyteller',
    voice: 'Enceladus',
    directorNotes:
      'Style: Breathy and dramatic\nPacing: Slow with suspense pauses\nAccent: Dark cinematic tone'
  },
  newsAnchor: {
    label: 'News Anchor',
    voice: 'Charon',
    directorNotes:
      'Style: Formal and informative\nPacing: Controlled and clear\nAccent: Neutral broadcaster style'
  },
  morningHost: {
    label: 'Morning Show Host',
    voice: 'Sulafat',
    directorNotes:
      'Style: Warm and welcoming\nPacing: Medium upbeat\nAccent: Friendly natural tone'
  }
};

export function buildDirectorPrompt(transcript: string, directorNotes: string): string {
  return `### DIRECTOR'S NOTES
${directorNotes}

### PERFORMANCE RULES
- If transcript contains audio tags like [excited], [whispers], [shouting], treat them as delivery cues.
- Do not read bracket tags aloud.
- Make tagged sections audibly different in tone and pacing.

#### TRANSCRIPT
${transcript}`;
}
