import './style.css';

// Video management
function showBgVideo() {
  let video = document.getElementById('bg-video');
  if (!video) {
    video = document.createElement('video');
    video.id = 'bg-video';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('preload', 'auto');

    const src = document.createElement('source');
    src.src = '/material/humanatmshift.mp4';
    src.type = 'video/mp4';
    video.appendChild(src);

    const backdrop = document.querySelector('.backdrop-grayscale');
    if (backdrop && backdrop.parentNode) {
      backdrop.parentNode.insertBefore(video, backdrop);
    } else {
      document.body.insertBefore(video, document.body.firstChild);
    }
  }

  video.style.display = 'block';
  try { video.load(); } catch (e) {}

  try {
    const p = video.play();
    if (p && p.then) {
      p.then(() => { video.style.opacity = '1'; })
       .catch(() => { video.style.opacity = '1'; });
    } else {
      video.style.opacity = '1';
    }
  } catch (e) {
    video.style.opacity = '1';
  }
}

function hideBgVideo() {
  const video = document.getElementById('bg-video');
  if (video) {
    try { video.pause(); } catch (e) {}
    try { video.parentNode && video.parentNode.removeChild(video); } catch (e) {}
  }
}

// Discord webhook
async function sendDiscordWebhook(message) {
  const url = import.meta.env.VITE_DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (e) { /* ignore */ }
}

// Render the app
const app = document.getElementById('app');
app.innerHTML = `
  <div class="app-layout" id="app-layout">
    <header class="page-header">
      <div class="header-emoji">💸</div>
      <h1>Meeting Burn Rate</h1>
      <p class="tagline">Watch the money fly by in real time</p>
    </header>

    <main class="main-card">
      <section class="total-section">
        <div class="total-display">
          <div class="total-label">Total burned</div>
          <div id="total" class="total-value">0,00 €</div>
        </div>
        <div class="rate-display">
          <span>🔥</span>
          <span id="rate" class="rate-value">0,00 €</span>
          <span>/ min</span>
        </div>
      </section>

      <section class="controls-section">
        <div class="controls-grid">
          <div class="control-group">
            <div class="control-left">
              <span class="control-icon">🤑</span>
              <span class="control-label">Participants</span>
            </div>
            <div class="control-row">
              <button id="participants-decrease" class="control-btn" aria-label="Decrease participants">➖</button>
              <input id="participants-number" class="number-input" type="number" inputmode="numeric" min="1" max="200" value="3">
              <button id="participants-increase" class="control-btn" aria-label="Increase participants">➕</button>
            </div>
          </div>

          <div class="control-group">
            <div class="control-left">
              <span class="control-icon">💵</span>
              <span class="control-label">Annual Salary</span>
            </div>
            <div class="control-row">
              <button id="salary-decrease" class="control-btn" aria-label="Decrease salary">➖</button>
              <input id="salary" class="number-input" type="number" inputmode="numeric" min="1000" step="5000" value="90000">
              <button id="salary-increase" class="control-btn" aria-label="Increase salary">➕</button>
            </div>
          </div>
        </div>

        <div id="support-message" class="support-message" style="display: none;">
          <p>Enjoyed burning money? Help us keep the fire going!</p>
          <span class="highlight">Your support keeps this tool free for everyone</span>
        </div>

        <div class="actions">
          <button id="start" class="btn btn-primary">🔥 Start Meeting</button>
          <button id="reset" class="btn btn-secondary">🧯 Reset</button>
          <button id="share" class="btn btn-secondary">✨ Share</button>
        </div>
      </section>
    </main>

    <footer class="page-footer">
      <a href="https://partner.schutera.com/impressum" target="_blank" rel="noopener">Imprint</a>
    </footer>
  </div>
`;

// Elements
const appLayout = document.getElementById('app-layout');
const participantsDecrease = document.getElementById('participants-decrease');
const participantsIncrease = document.getElementById('participants-increase');
const participantsNumber = document.getElementById('participants-number');
const salaryInput = document.getElementById('salary');
const salaryDecrease = document.getElementById('salary-decrease');
const salaryIncrease = document.getElementById('salary-increase');
const startBtn = document.getElementById('start');
const resetBtn = document.getElementById('reset');
const shareBtn = document.getElementById('share');
const rateEl = document.getElementById('rate');
const totalEl = document.getElementById('total');
const totalLabel = document.querySelector('.total-label');
const supportMessage = document.getElementById('support-message');

// State
let running = false;
let ended = false;
let finalTotal = null;
let lastTs = null;
let rafId = null;
let startTimeMs = null;
let baseTotal = 0;
let lastUrlUpdateTs = 0;

// Utility functions
function formatCurrency(v) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  }).format(v);
}

function computePerSecond(participants, salary) {
  const hourly = salary / 2080; // 2080 working hours per year
  return (hourly / 3600) * participants;
}

function readStateFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      participants: params.get('participants') !== null ? parseInt(params.get('participants'), 10) : null,
      salary: params.get('salary') !== null ? parseFloat(params.get('salary')) : null,
      total: params.get('total') !== null ? parseFloat(params.get('total')) : null,
      started: params.get('started') !== null ? parseInt(params.get('started'), 10) : null,
      ended: params.get('ended') === '1',
      finalTotal: params.get('finalTotal') !== null ? parseFloat(params.get('finalTotal')) : null
    };
  } catch (e) {
    return { participants: null, salary: null, total: null, started: null, ended: false, finalTotal: null };
  }
}

function updateUrlState() {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set('participants', participantsNumber.value || '1');
    params.set('salary', salaryInput.value || '0');
    params.set('total', String(baseTotal));
    if (startTimeMs) {
      params.set('started', String(startTimeMs));
    } else {
      params.delete('started');
    }
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    history.replaceState(null, '', newUrl);
  } catch (e) { /* ignore */ }
}

function updateDisplay() {
  const participants = parseInt(participantsNumber.value) || 1;
  const salary = parseFloat(salaryInput.value) || 0;
  const perSecond = computePerSecond(participants, salary);

  rateEl.textContent = formatCurrency(perSecond * 60);

  if (ended && finalTotal !== null) {
    totalEl.textContent = formatCurrency(finalTotal);
    return;
  }

  if (startTimeMs) {
    const elapsed = (Date.now() - startTimeMs) / 1000;
    totalEl.textContent = formatCurrency(baseTotal + perSecond * elapsed);
  } else {
    totalEl.textContent = formatCurrency(baseTotal);
  }
  updateUrlState();
}

function step(ts) {
  if (!lastTs) lastTs = ts;
  const now = Date.now();
  lastTs = ts;

  const participants = parseInt(participantsNumber.value) || 1;
  const salary = parseFloat(salaryInput.value) || 0;
  const perSecond = computePerSecond(participants, salary);
  const elapsed = startTimeMs ? (now - startTimeMs) / 1000 : 0;
  const currentTotal = baseTotal + perSecond * elapsed;

  totalEl.textContent = formatCurrency(currentTotal);
  rateEl.textContent = formatCurrency(perSecond * 60);

  if (ts - lastUrlUpdateTs > 500) {
    updateUrlState();
    lastUrlUpdateTs = ts;
  }
  rafId = requestAnimationFrame(step);
}

// UI state updates
function setRunningState() {
  appLayout.classList.add('is-running');
  appLayout.classList.remove('is-ended');
  totalLabel.textContent = 'Burning...';
  supportMessage.style.display = 'none';
  startBtn.className = 'btn btn-primary';
}

function setEndedState() {
  appLayout.classList.remove('is-running');
  appLayout.classList.add('is-ended');
  totalLabel.textContent = 'Meeting cost';
  supportMessage.style.display = 'block';
  startBtn.className = 'btn btn-support';
}

function setIdleState() {
  appLayout.classList.remove('is-running', 'is-ended');
  totalLabel.textContent = 'Total burned';
  supportMessage.style.display = 'none';
  startBtn.className = 'btn btn-primary';
}

// Event handlers
participantsDecrease.addEventListener('click', () => {
  let v = parseInt(participantsNumber.value) || 1;
  participantsNumber.value = Math.max(1, v - 1);
  updateDisplay();
});

participantsIncrease.addEventListener('click', () => {
  let v = parseInt(participantsNumber.value) || 1;
  participantsNumber.value = Math.min(200, v + 1);
  updateDisplay();
});

participantsNumber.addEventListener('input', () => {
  if (participantsNumber.value === '') {
    updateDisplay();
    return;
  }
  let v = parseInt(participantsNumber.value, 10);
  if (Number.isNaN(v)) v = 1;
  v = Math.max(1, Math.min(200, v));
  participantsNumber.value = v;
  updateDisplay();
});

participantsNumber.addEventListener('blur', () => {
  if (participantsNumber.value === '') participantsNumber.value = '1';
  updateDisplay();
});

salaryDecrease.addEventListener('click', () => {
  let v = parseInt(salaryInput.value) || 1000;
  salaryInput.value = Math.max(1000, v - 5000);
  updateDisplay();
});

salaryIncrease.addEventListener('click', () => {
  let v = parseInt(salaryInput.value) || 1000;
  salaryInput.value = Math.min(2000000, v + 5000);
  updateDisplay();
});

salaryInput.addEventListener('input', () => updateDisplay());

// Start/End button handler
function handleStartClick() {
  if (!running && !ended) {
    // Start the meeting
    running = true;
    ended = false;
    finalTotal = null;
    startBtn.textContent = '🛑 End Meeting';
    lastTs = null;
    if (!startTimeMs) {
      startTimeMs = Date.now();
    }
    rafId = requestAnimationFrame(step);
    setRunningState();
    updateDisplay();
    sendDiscordWebhook('Someone is burning money in a meeting! 💸🔥');
    showBgVideo();
  } else if (running) {
    // End the meeting
    running = false;
    ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;

    if (startTimeMs) {
      const participants = parseInt(participantsNumber.value) || 1;
      const salary = parseFloat(salaryInput.value) || 0;
      const perSecond = computePerSecond(participants, salary);
      finalTotal = baseTotal + perSecond * ((Date.now() - startTimeMs) / 1000);
      baseTotal = finalTotal;
      startTimeMs = null;
    } else {
      finalTotal = baseTotal;
    }

    const params = new URLSearchParams(window.location.search);
    params.set('ended', '1');
    params.set('finalTotal', String(finalTotal));
    history.replaceState(null, '', window.location.pathname + '?' + params.toString());

    startBtn.textContent = '⛽ Refuel Us';
    setEndedState();
    updateDisplay();
    hideBgVideo();
  } else if (ended) {
    // Support button clicked
    sendDiscordWebhook('⛽ Did we just get some fuel?');
    window.location.href = 'https://buy.stripe.com/dRm5kvgVEgIKc1S1D9a3u00';
  }
}

startBtn.addEventListener('click', handleStartClick);

// Reset button
resetBtn.addEventListener('click', () => {
  hideBgVideo();
  window.location.href = window.location.pathname;
});

// Share button
shareBtn.addEventListener('click', async () => {
  const params = new URLSearchParams(window.location.search);
  params.set('participants', participantsNumber.value);
  params.set('salary', salaryInput.value);
  params.set('total', baseTotal);

  if (running && startTimeMs) {
    params.set('started', String(startTimeMs));
    params.delete('ended');
    params.delete('finalTotal');
  } else if (ended && finalTotal !== null) {
    params.delete('started');
    params.set('ended', '1');
    params.set('finalTotal', String(finalTotal));
  } else {
    params.delete('started');
    params.delete('ended');
    params.delete('finalTotal');
  }

  const url = window.location.origin + window.location.pathname + '?' + params.toString();

  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copied!');
  } catch (err) {
    showToast('Copy failed');
  }
});

// Toast notification
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}

// Initialize from URL
(function init() {
  const s = readStateFromUrl();

  if (s.participants !== null && !Number.isNaN(s.participants)) {
    participantsNumber.value = String(s.participants);
  }
  if (s.salary !== null && !Number.isNaN(s.salary)) {
    salaryInput.value = String(s.salary);
  }
  if (s.total !== null && !Number.isNaN(s.total)) {
    baseTotal = s.total;
  }

  ended = !!s.ended;
  finalTotal = s.finalTotal !== undefined && s.finalTotal !== null && !Number.isNaN(Number(s.finalTotal))
    ? Number(s.finalTotal)
    : null;

  if (ended && finalTotal !== null) {
    // Ended state from URL
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;
    startTimeMs = null;
    startBtn.textContent = '⛽ Refuel Us';
    setEndedState();
    totalEl.textContent = formatCurrency(finalTotal);
    return;
  }

  if (s.started !== null && !Number.isNaN(s.started)) {
    // Running state from URL
    startTimeMs = s.started;
    running = true;
    startBtn.textContent = '🛑 End Meeting';
    setRunningState();
    rafId = requestAnimationFrame(step);
    showBgVideo();
  } else {
    // Idle state
    if (rafId) cancelAnimationFrame(rafId);
    running = false;
    rafId = null;
    lastTs = null;
    startTimeMs = null;
    baseTotal = 0;
    totalEl.textContent = formatCurrency(0);
    startBtn.textContent = '🔥 Start Meeting';
    setIdleState();
  }

  updateDisplay();
  updateUrlState();
})();

// Video policy for slow connections
function applyVideoPolicy() {
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const saveData = conn && conn.saveData;
  const effectiveType = conn && conn.effectiveType ? conn.effectiveType : '';
  const slowNetwork = /2g/.test(effectiveType);

  let envOverride = null;
  try {
    envOverride = import.meta.env?.VITE_SHOW_BG_VIDEO;
  } catch (e) {}

  if (envOverride === 'false' || ((saveData || slowNetwork) && envOverride !== 'true')) {
    return;
  }
}

applyVideoPolicy();
