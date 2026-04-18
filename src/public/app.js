const statusEl = document.getElementById('status');
const generateBtn = document.getElementById('generateBtn');
const generateStyledBtn = document.getElementById('generateStyledBtn');
const textEl = document.getElementById('text');
const voiceEl = document.getElementById('voiceName');
const modelEl = document.getElementById('modelTier');
const directorNotesEl = document.getElementById('directorNotes');
const presetGridEl = document.getElementById('presetGrid');
const playerAEl = document.getElementById('playerA');
const playerBEl = document.getElementById('playerB');
const costCardAEl = document.getElementById('costCardA');
const costCardBEl = document.getElementById('costCardB');
const compareCardEl = document.getElementById('compareCard');
const sessionCardEl = document.getElementById('sessionCard');
const sampleThBtn = document.getElementById('sampleTh');
const sampleEnBtn = document.getElementById('sampleEn');
const resetSessionBtn = document.getElementById('resetSession');
const podcastTopicEl = document.getElementById('podcastTopic');
const hostNameEl = document.getElementById('hostName');
const hostVoiceEl = document.getElementById('hostVoice');
const guestNameEl = document.getElementById('guestName');
const guestVoiceEl = document.getElementById('guestVoice');
const scriptEditorEl = document.getElementById('scriptEditor');
const genScriptBtn = document.getElementById('genScriptBtn');
const genPodcastBtn = document.getElementById('genPodcastBtn');
const podcastPlayerEl = document.getElementById('podcastPlayer');
const podcastStepCardEl = document.getElementById('podcastStepCard');

let presets = {};
let selectedPreset = null;
let lastResultA = null;
let lastResultB = null;

sampleThBtn.addEventListener('click', () => {
  textEl.value =
    'สวัสดีครับ ยินดีต้อนรับสู่ Gemini TTS Demo วันนี้เราจะสาธิตการแปลงข้อความเป็นเสียงพูดด้วยการควบคุมโทนและสไตล์';
});

sampleEnBtn.addEventListener('click', () => {
  textEl.value =
    'Welcome to the Gemini TTS demo studio. We can shape tone, pacing, and character using natural language instructions.';
});

podcastTopicEl.value =
  'AI assistant adoption in Thailand: practical use cases for startups, SMEs, and enterprise teams in 2026';

resetSessionBtn.addEventListener('click', async () => {
  await fetch('/api/session/reset', { method: 'POST' });
  await refreshSession();
  status('Session reset complete');
});

generateBtn.addEventListener('click', async () => {
  await runGeneration('single');
});

generateStyledBtn.addEventListener('click', async () => {
  await runGeneration('style');
});

genScriptBtn.addEventListener('click', async () => {
  await generatePodcastScript();
});

genPodcastBtn.addEventListener('click', async () => {
  await generatePodcastAudio();
});

async function refreshSession() {
  const response = await fetch('/api/session');
  const payload = await response.json();
  renderSession(payload.totals);
}

function renderCost(usage) {
  return `
    <div>Input tokens: <strong>${usage.inputTokens}</strong></div>
    <div>Output tokens: <strong>${usage.outputTokens}</strong> (~${usage.audioDurationSec}s)</div>
    <div>Input cost: <strong>$${usage.inputCostUSD}</strong></div>
    <div>Output cost: <strong>$${usage.outputCostUSD}</strong></div>
    <div>Total USD: <strong>$${usage.totalUSD}</strong></div>
    <div>Total THB: <strong>${usage.totalTHB}</strong></div>
  `;
}

function renderSession(totals) {
  sessionCardEl.classList.remove('empty');
  sessionCardEl.innerHTML = `
    <div>Calls: <strong>${totals.calls}</strong></div>
    <div>Total USD: <strong>$${totals.totalUSD}</strong></div>
    <div>Total THB: <strong>${totals.totalTHB}</strong></div>
  `;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function status(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function runGeneration(mode) {
  const text = textEl.value.trim();
  if (!text) {
    status('กรุณาใส่ข้อความก่อน', true);
    return;
  }

  const voiceName = voiceEl.value.trim() || 'Kore';
  const modelTier = modelEl.value;
  const directorNotes = directorNotesEl.value.trim();

  if (mode === 'style' && !directorNotes) {
    status('กรุณาใส่ Director Notes สำหรับ Styled mode', true);
    return;
  }

  const endpoint = mode === 'style' ? '/api/tts/style' : '/api/tts/single';
  const button = mode === 'style' ? generateStyledBtn : generateBtn;

  button.disabled = true;
  status(mode === 'style' ? 'Generating styled audio (B)...' : 'Generating base audio (A)...');

  try {
    const body = { text, voiceName, modelTier };
    if (mode === 'style') {
      body.directorNotes = directorNotes;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to generate speech');
    }

    const audioSrc = `data:${payload.mimeType};base64,${payload.audioBase64}`;
    if (mode === 'style') {
      playerBEl.src = audioSrc;
      costCardBEl.classList.remove('empty');
      costCardBEl.innerHTML = renderCost(payload.usage);
      lastResultB = payload.usage;
      status('Styled generate success (B)');
    } else {
      playerAEl.src = audioSrc;
      costCardAEl.classList.remove('empty');
      costCardAEl.innerHTML = renderCost(payload.usage);
      lastResultA = payload.usage;
      status('Base generate success (A)');
    }

    renderSession(payload.session.totals);
    renderCompare();
  } catch (err) {
    status(err.message || 'Unknown error', true);
  } finally {
    button.disabled = false;
  }
}

async function generatePodcastScript() {
  const topic = podcastTopicEl.value.trim();
  const hostName = hostNameEl.value.trim();
  const guestName = guestNameEl.value.trim();

  if (!topic) {
    status('กรุณาใส่ podcast topic', true);
    return;
  }

  genScriptBtn.disabled = true;
  status('Generating podcast script (Step 1)...');

  try {
    const response = await fetch('/api/podcast/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, hostName, guestName })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to generate script');
    }

    scriptEditorEl.value = prettyJson(payload.script);
    renderSession(payload.session.totals);
    renderPodcastStepCard(payload.usage, null, null);
    status('Podcast script ready (Step 1)');
  } catch (err) {
    status(err.message || 'Unknown error', true);
  } finally {
    genScriptBtn.disabled = false;
  }
}

async function generatePodcastAudio() {
  const hostName = hostNameEl.value.trim() || 'HOST';
  const guestName = guestNameEl.value.trim() || 'GUEST';
  const hostVoice = hostVoiceEl.value.trim() || 'Puck';
  const guestVoice = guestVoiceEl.value.trim() || 'Kore';
  const modelTier = modelEl.value;
  const topic = podcastTopicEl.value.trim();

  if (!topic) {
    status('กรุณาใส่ podcast topic', true);
    return;
  }

  genPodcastBtn.disabled = true;
  status('Generating podcast pipeline (Step 1 + Step 2)...');

  try {
    const response = await fetch('/api/podcast/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        hostName,
        guestName,
        hostVoice,
        guestVoice,
        modelTier
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to generate podcast');
    }

    scriptEditorEl.value = prettyJson(payload.script);
    const audioSrc = `data:${payload.mimeType};base64,${payload.audioBase64}`;
    podcastPlayerEl.src = audioSrc;

    renderPodcastStepCard(payload.step1.usage, payload.step2.usage, payload.total);
    renderSession(payload.session.totals);
    status('Podcast generation success');
  } catch (err) {
    status(err.message || 'Unknown error', true);
  } finally {
    genPodcastBtn.disabled = false;
  }
}

function renderPodcastStepCard(step1Usage, step2Usage, total) {
  podcastStepCardEl.classList.remove('empty');

  if (!step2Usage || !total) {
    podcastStepCardEl.innerHTML = `
      <div><strong>Step 1 - Script Generation</strong></div>
      ${renderCost(step1Usage)}
    `;
    return;
  }

  podcastStepCardEl.innerHTML = `
    <div><strong>Step 1 - Script Generation</strong></div>
    ${renderCost(step1Usage)}
    <hr class="soft-rule" />
    <div><strong>Step 2 - Multi-speaker TTS</strong></div>
    ${renderCost(step2Usage)}
    <hr class="soft-rule" />
    <div><strong>Total Session for Pipeline</strong></div>
    <div>Total USD: <strong>$${total.totalUSD}</strong></div>
    <div>Total THB: <strong>${total.totalTHB}</strong></div>
  `;
}

function renderCompare() {
  if (!lastResultA || !lastResultB) {
    compareCardEl.classList.add('empty');
    compareCardEl.textContent = 'Generate A และ B เพื่อเปรียบเทียบ';
    return;
  }

  compareCardEl.classList.remove('empty');
  const base = Number(lastResultA.totalUSD);
  const styled = Number(lastResultB.totalUSD);
  const diff = styled - base;
  const percent = base > 0 ? (diff / base) * 100 : 0;

  compareCardEl.innerHTML = `
    <div>A Total: <strong>$${lastResultA.totalUSD}</strong></div>
    <div>B Total: <strong>$${lastResultB.totalUSD}</strong></div>
    <div>Delta (B - A): <strong>$${diff.toFixed(6)}</strong></div>
    <div>Delta %: <strong>${percent.toFixed(2)}%</strong></div>
  `;
}

function renderPresetGrid() {
  const keys = Object.keys(presets);
  if (keys.length === 0) {
    presetGridEl.innerHTML = '<div class="card empty">No presets available</div>';
    return;
  }

  presetGridEl.innerHTML = keys
    .map((key) => {
      const preset = presets[key];
      const activeClass = selectedPreset === key ? 'active' : '';
      return `
        <button class="preset-chip ${activeClass}" data-key="${key}" type="button">
          <span class="preset-label">${preset.label}</span>
          <span class="preset-voice">Voice: ${preset.voice}</span>
        </button>
      `;
    })
    .join('');

  Array.from(presetGridEl.querySelectorAll('.preset-chip')).forEach((node) => {
    node.addEventListener('click', () => {
      const key = node.getAttribute('data-key');
      if (!key || !presets[key]) {
        return;
      }

      selectedPreset = key;
      const preset = presets[key];
      voiceEl.value = preset.voice;
      directorNotesEl.value = preset.directorNotes;
      renderPresetGrid();
      status(`Preset loaded: ${preset.label}`);
    });
  });
}

async function loadPresets() {
  const response = await fetch('/api/presets');
  const payload = await response.json();
  presets = payload.presets || {};

  const defaultKey = Object.keys(presets)[0];
  if (defaultKey) {
    selectedPreset = defaultKey;
    voiceEl.value = presets[defaultKey].voice;
    directorNotesEl.value = presets[defaultKey].directorNotes;
  }

  renderPresetGrid();
}

Promise.all([refreshSession(), loadPresets()]).catch((err) => {
  status(err.message || 'Failed to initialize app', true);
});
