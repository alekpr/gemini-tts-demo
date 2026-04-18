# 🎙️ Gemini 2.5 Flash TTS — Dev Demo Plan

> **Version:** 1.0.0  
> **Last Updated:** April 2026  
> **Stack:** Node.js + TypeScript + Express + `@google/genai`  
> **Model:** `gemini-2.5-flash-preview-tts` / `gemini-2.5-pro-preview-tts`

---

## 📌 ภาพรวม

Gemini TTS ต่างจาก TTS แบบดั้งเดิมตรงที่ใช้ LLM ซึ่งรู้ไม่แค่ **"what to say"** แต่รู้ **"how to say it"** ด้วย  
ผู้ใช้งานสามารถควบคุม style, tone, accent, pace ผ่าน natural language prompt ได้โดยตรง

### Supported Models

| Model ID | Single Speaker | Multi-Speaker | Status |
|---|---|---|---|
| `gemini-2.5-flash-preview-tts` | ✅ | ✅ | Preview |
| `gemini-2.5-pro-preview-tts` | ✅ | ✅ | Preview |

### ข้อจำกัดสำคัญ
- รับ **text input เท่านั้น** → output **audio เท่านั้น**
- Context window limit: **32,000 tokens** ต่อ session
- Output format: **PCM 24kHz, 16-bit, Mono** (ต้อง wrap เป็น WAV ก่อนเล่น)
- รองรับภาษาไทย (`th`) — ตรวจจับภาษาอัตโนมัติ

---

## 💰 Pricing & Cost Tracking

### ราคา API (ณ เมษายน 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|---|---|---|
| `gemini-2.5-flash-preview-tts` | **$0.50** | **$10.00** |
| `gemini-2.5-pro-preview-tts` | **$1.00** | **$20.00** |

> 🔑 **กฎสำคัญ:** Audio output tokens = **25 tokens ต่อ 1 วินาที** ของเสียงที่สร้างขึ้น

### สูตรคำนวณ Cost ต่อ Session

```
Input Cost  = (จำนวนตัวอักษร prompt / 4) × (ราคา input / 1,000,000)
Output Cost = (วินาทีของเสียง × 25)    × (ราคา output / 1,000,000)
Total Cost  = Input Cost + Output Cost
```

### ตัวอย่างค่าใช้จ่ายจริง (Flash TTS)

| Use Case | Input Tokens | Audio Duration | Output Tokens | ค่าใช้จ่าย (USD) | ค่าใช้จ่าย (THB ~36฿) |
|---|---|---|---|---|---|
| ประโยคสั้น (10 วินาที) | ~50 | 10 วิ | 250 | ~$0.0000025 + $0.0000025 | ~$0.000005 (~฿0.00018) |
| ย่อหน้า (30 วินาที) | ~200 | 30 วิ | 750 | ~$0.0001 + $0.0075 | ~$0.0076 (~฿0.27) |
| บทความ 1 หน้า (3 นาที) | ~800 | 180 วิ | 4,500 | ~$0.0004 + $0.045 | ~$0.0454 (~฿1.63) |
| Podcast 10 นาที | ~2,000 | 600 วิ | 15,000 | ~$0.001 + $0.15 | ~$0.151 (~฿5.44) |
| Audiobook 1 ชั่วโมง | ~10,000 | 3,600 วิ | 90,000 | ~$0.005 + $0.90 | ~$0.905 (~฿32.58) |

> ⚠️ ราคาอาจเปลี่ยนแปลงได้เนื่องจาก model ยังอยู่ใน Preview — ตรวจสอบล่าสุดที่ [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## 🗺️ Development Plan — 3 Phases

---

### Phase 1 — Single Speaker TTS (1–2 วัน)

**เป้าหมาย:** แปลงข้อความเป็นเสียงพูด 1 คน พร้อม cost tracking

#### Features
- Text input area
- Voice selector (30 voices)
- Generate & play audio
- แสดง token usage + ค่าใช้จ่ายหลัง generate

#### Tech Stack
```
@google/genai    — Gemini SDK
wav              — แปลง PCM → WAV
express          — API server
typescript       — Type-safe development
ts-node          — Run TypeScript directly
@types/express   — Express type definitions
@types/node      — Node.js type definitions
```

#### API Call Structure (TypeScript)
```ts
import { GoogleGenAI } from '@google/genai';
import wav from 'wav';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type ModelTier = 'flash' | 'pro';

interface SpeechResult {
  audioBuffer: Buffer;
  usage: CostBreakdown;
}

async function generateSpeech(
  text: string,
  voiceName: string = 'Kore'
): Promise<SpeechResult> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const audioData = response.candidates![0].content!.parts![0].inlineData!.data!;
  const usageMeta = response.usageMetadata!;

  return {
    audioBuffer: Buffer.from(audioData, 'base64'),
    usage: calculateCost(usageMeta, 'flash')
  };
}
```

#### Cost Calculator Function
```ts
interface PricingRate {
  input: number;
  output: number;
}

interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  audioDurationSec: number;
  inputCostUSD: string;
  outputCostUSD: string;
  totalUSD: string;
  totalTHB: string;
}

const PRICING: Record<ModelTier, PricingRate> = {
  flash: { input: 0.50, output: 10.00 },  // per 1M tokens
  pro:   { input: 1.00, output: 20.00 }
};

function calculateCost(
  usageMeta: { promptTokenCount: number; candidatesTokenCount: number },
  model: ModelTier = 'flash'
): CostBreakdown {
  const rate = PRICING[model];
  const inputCost  = (usageMeta.promptTokenCount     / 1_000_000) * rate.input;
  const outputCost = (usageMeta.candidatesTokenCount / 1_000_000) * rate.output;
  const totalUSD   = inputCost + outputCost;
  const totalTHB   = totalUSD * 36; // อัปเดตอัตราแลกเปลี่ยนตามจริง

  return {
    inputTokens:      usageMeta.promptTokenCount,
    outputTokens:     usageMeta.candidatesTokenCount,
    audioDurationSec: Math.round(usageMeta.candidatesTokenCount / 25),
    inputCostUSD:     inputCost.toFixed(6),
    outputCostUSD:    outputCost.toFixed(6),
    totalUSD:         totalUSD.toFixed(6),
    totalTHB:         totalTHB.toFixed(4)
  };
}
```

#### UI Cost Display (หลัง Generate)
```
┌─────────────────────────────────────────┐
│  📊 Session Cost Summary                │
├─────────────────────────────────────────┤
│  Input tokens   : 142 tokens            │
│  Output tokens  : 375 tokens (15 วิ)   │
│  Input cost     : $0.000071             │
│  Output cost    : $0.003750             │
│  ─────────────────────────────          │
│  💵 Total       : $0.003821             │
│  🇹🇭 Total (THB) : ฿0.1376             │
└─────────────────────────────────────────┘
```

---

### Phase 2 — Voice Style Control (1–2 วัน)

**เป้าหมาย:** โชว์ Expressive TTS ด้วย Director's Prompt System

#### Prompt Structure (5 ส่วน)

```
# AUDIO PROFILE: [ชื่อ Character]
## "[Role / Archetype]"

## THE SCENE: [ชื่อ Location]
[บรรยากาศ, สภาพแวดล้อม, อารมณ์ของ scene]

### DIRECTOR'S NOTES
Style: [อารมณ์และ style การพูด]
Pacing: [ความเร็ว จังหวะ]
Accent: [สำเนียง ระบุให้ specific เช่น "Brixton, London"]

### SAMPLE CONTEXT
[บริบทที่ช่วยให้ model เข้าใจ character]

#### TRANSCRIPT
[ข้อความที่ต้องการให้อ่าน]
```

#### Preset Characters สำหรับ Demo

| Preset | Voice | Style |
|---|---|---|
| 📻 Radio DJ Bangkok | `Puck` | Energetic, upbeat, Thai-accented |
| 📖 Calm Narrator | `Kore` | Steady, informative, clear |
| 🎙️ Podcast Host | `Aoede` | Conversational, breezy |
| 😱 Horror Storyteller | `Enceladus` | Breathy, slow, dramatic |
| 💼 News Anchor | `Charon` | Formal, informative |
| ☀️ Morning Show Host | `Sulafat` | Warm, friendly, welcoming |

#### Implementation
```ts
interface VoicePreset {
  voice: string;
  directorNotes: string;
}

type PresetKey = 'radioDJ' | 'calmNarrator' | 'podcastHost' | 'horrorStoryteller';

const PRESETS: Record<PresetKey, VoicePreset> = {
  radioDJ: {
    voice: 'Puck',
    directorNotes: `Style: High-energy Thai radio DJ, infectious enthusiasm
Pacing: Fast, bouncy cadence with no dead air
Accent: Thai-accented English, friendly and warm`
  },
  calmNarrator: {
    voice: 'Kore',
    directorNotes: `Style: Measured documentary narrator, authoritative
Pacing: Deliberate, clear, pauses for emphasis
Accent: Neutral, clear pronunciation`
  }
  // ...
};

function buildPrompt(transcript: string, preset: VoicePreset): string {
  return `### DIRECTOR'S NOTES
${preset.directorNotes}

#### TRANSCRIPT
${transcript}`;
}
```

---

### Phase 3 — Multi-Speaker Podcast Generator (2–3 วัน)

**เป้าหมาย:** 2-step pipeline สร้าง podcast dialogue อัตโนมัติ

#### Pipeline Flow

```
[Topic Input]
     │
     ▼
┌─────────────────────────────────┐
│  Step 1: Script Generation      │
│  Model: gemini-2.5-flash        │
│  → สร้าง dialogue 2 คน         │
│  → คืน JSON: [{speaker, line}]  │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Step 2: Multi-Speaker TTS      │
│  Model: gemini-2.5-flash-tts    │
│  → แปลง script → audio          │
│  → สูงสุด 2 speakers ต่อ call   │
└─────────────┬───────────────────┘
              │
              ▼
         [.wav output]
    + Cost breakdown per step
```

#### API Call — Multi-Speaker
```ts
interface ScriptLine {
  speaker: string;
  text: string;
}

interface SpeakerConfig {
  name: string;
  voice: string;
}

interface PodcastResult {
  audio: string;
  cost: CostBreakdown;
}

async function generatePodcast(
  script: ScriptLine[],
  speakers: SpeakerConfig[]
): Promise<PodcastResult> {
  const prompt = `TTS the following conversation:\n${
    script.map(line => `${line.speaker}: ${line.text}`).join('\n')
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map(s => ({
            speaker: s.name,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: s.voice }
            }
          }))
        }
      }
    }
  });

  return {
    audio: response.candidates![0].content!.parts![0].inlineData!.data!,
    cost: calculateCost(response.usageMetadata!, 'flash')
  };
}
```

#### Cost Display สำหรับ Multi-Step

```
┌──────────────────────────────────────────────┐
│  📊 Podcast Generation Cost Breakdown         │
├──────────────────────────────────────────────┤
│  Step 1 — Script Generation (gemini-2.5-flash)│
│    Input tokens   : 85 tokens                │
│    Output tokens  : 420 tokens               │
│    Cost           : $0.000105 + $0.001050    │
│    Subtotal       : $0.001155                │
├──────────────────────────────────────────────┤
│  Step 2 — TTS Synthesis (flash-preview-tts)  │
│    Input tokens   : 420 tokens               │
│    Output tokens  : 7,500 tokens (300 วิ)   │
│    Cost           : $0.000210 + $0.075000    │
│    Subtotal       : $0.075210                │
├──────────────────────────────────────────────┤
│  💵 Total Session Cost : $0.076365           │
│  🇹🇭 Total (THB)       : ฿2.7491            │
└──────────────────────────────────────────────┘
```

---

## 🎤 Voice Reference Table (30 Voices)

| Voice | Character | เหมาะสำหรับ |
|---|---|---|
| `Zephyr` | Bright | Upbeat content, ads |
| `Puck` | Upbeat | Podcast host, radio |
| `Charon` | Informative | News, tutorial |
| `Kore` | Firm | Narration, formal |
| `Fenrir` | Excitable | Sports, events |
| `Leda` | Youthful | Kids content, casual |
| `Aoede` | Breezy | Conversational, interview |
| `Enceladus` | Breathy | Drama, storytelling |
| `Achernar` | Soft | Meditation, calm content |
| `Sulafat` | Warm | Customer service |
| `Gacrux` | Mature | Documentary, audiobook |
| `Achird` | Friendly | Support bot, FAQ |

> ทดสอบเสียงทั้งหมดได้ที่ [aistudio.google.com/generate-speech](https://aistudio.google.com/generate-speech)

---

## 📁 Project Structure

```
gemini-tts-demo/
├── src/
│   ├── server.ts              # Express API server
│   ├── tts/
│   │   ├── singleSpeaker.ts   # Phase 1: Single speaker
│   │   ├── multiSpeaker.ts    # Phase 3: Multi-speaker
│   │   └── presets.ts         # Phase 2: Voice presets
│   ├── types/
│   │   └── index.ts           # Shared interfaces & types
│   ├── utils/
│   │   ├── costCalculator.ts  # Cost tracking logic
│   │   ├── wavEncoder.ts      # PCM → WAV converter
│   │   └── sessionLogger.ts   # Session cost history
│   └── public/
│       ├── index.html         # UI
│       ├── style.css
│       └── app.ts
├── tsconfig.json              # TypeScript config
├── .env                       # GEMINI_API_KEY
├── package.json
└── README.md
```

---

## 🗓️ Timeline

| Phase | งาน | เวลา |
|---|---|---|
| **Phase 1** | Single Speaker + Cost Display UI | 1–2 วัน |
| **Phase 2** | Style Presets + Director Prompt System | 1–2 วัน |
| **Phase 3** | Multi-Speaker Podcast Pipeline | 2–3 วัน |
| **รวม** | | **4–7 วัน** |

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "@google/genai": "^0.15.0",
    "express": "^4.18.0",
    "wav": "^1.0.2",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "ts-node": "^10.9.0",
    "tsx": "^4.7.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/wav": "^1.0.4"
  },
  "scripts": {
    "dev":   "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 🔗 References

- [Gemini TTS Documentation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [TTS Quickstart Cookbook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_TTS.ipynb)
- [Voice Library — AI Studio](https://aistudio.google.com/apps/bundled/voice-library)
