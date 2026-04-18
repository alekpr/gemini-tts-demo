const statusEl = document.getElementById('status');
const generateBtn = document.getElementById('generateBtn');
const textEl = document.getElementById('text');
const voiceEl = document.getElementById('voiceName');
const modelEl = document.getElementById('modelTier');
const playerEl = document.getElementById('player');
const costCardEl = document.getElementById('costCard');
const sessionCardEl = document.getElementById('sessionCard');
const sampleThBtn = document.getElementById('sampleTh');
const sampleEnBtn = document.getElementById('sampleEn');
const resetSessionBtn = document.getElementById('resetSession');

sampleThBtn.addEventListener('click', () => {
  textEl.value =
    'สวัสดีครับ ยินดีต้อนรับสู่ Gemini TTS Demo วันนี้เราจะสาธิตการแปลงข้อความเป็นเสียงพูดด้วยการควบคุมโทนและสไตล์';
});

sampleEnBtn.addEventListener('click', () => {
  textEl.value =
    'Welcome to the Gemini TTS demo studio. We can shape tone, pacing, and character using natural language instructions.';
});

resetSessionBtn.addEventListener('click', async () => {
  await fetch('/api/session/reset', { method: 'POST' });
  await refreshSession();
  status('Session reset complete');
});

generateBtn.addEventListener('click', async () => {
  const text = textEl.value.trim();
  if (!text) {
    status('กรุณาใส่ข้อความก่อน', true);
    return;
  }

  generateBtn.disabled = true;
  status('Generating audio...');

  try {
    const response = await fetch('/api/tts/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName: voiceEl.value.trim() || 'Kore',
        modelTier: modelEl.value
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to generate speech');
    }

    const audioSrc = `data:${payload.mimeType};base64,${payload.audioBase64}`;
    playerEl.src = audioSrc;

    renderCost(payload.usage);
    renderSession(payload.session.totals);
    status('Generate success');
  } catch (err) {
    status(err.message || 'Unknown error', true);
  } finally {
    generateBtn.disabled = false;
  }
});

async function refreshSession() {
  const response = await fetch('/api/session');
  const payload = await response.json();
  renderSession(payload.totals);
}

function renderCost(usage) {
  costCardEl.classList.remove('empty');
  costCardEl.innerHTML = `
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

function status(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

refreshSession();
