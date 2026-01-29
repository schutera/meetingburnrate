// Send a message to Discord webhook
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

import './style.css';

// Prevent double-tap zoom, pinch zoom, and page movement on mobile
function preventMobileZoomAndMove() {
  // Set viewport meta tag to disable zoom
  let viewport = document.querySelector('meta[name=viewport]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';

  // Prevent double-tap to zoom and pinch zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });
  document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
  });
  document.addEventListener('gestureend', function (e) {
    e.preventDefault();
  });

  // Prevent scrolling
  document.body.style.overflow = 'hidden';
  document.body.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });
}

window.addEventListener('DOMContentLoaded', preventMobileZoomAndMove);

const app = document.getElementById('app');

app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; min-height: 100vh; justify-content: center;">
        <div class="header-emoji">💸</div>
        <header class="page-header" style="width:100%; max-width:400px; text-align:center; margin-bottom:12px;">
          <h1 style="text-align: center;">Meeting Burn Rate</h1>
          <p class="sub" style="text-align: center;">Calculate and watch the money fly by in real time.</p>
        </header>

        <main style="width: 100%; max-width: 600px;">
          <div class="total-top">
            <div class="total-wrap">
              <div id="total">0,00 €</div>
            </div>
          </div>

          <section class="display" style="margin-bottom: 2.5em;">
              <div class="stat">
                  <div class="label">🔥 / min</div>
                  <div id="rate">0.00 €</div>
              </div>
          </section>

          <section class="controls" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2em; width: 100%; margin: 1.5em 0;">
              <div class="control-group" style="display: flex; flex-direction: column; align-items: center;">
                <div class="emoji" style="text-align:center; margin-bottom: 8px; font-size:2em;">🤑</div>
                <div class="control-row participant-control" style="justify-content: center;">
                    <button id="participants-decrease" aria-label="decrease">🧯</button>
                    <input id="participants-number" type="number" min="1" max="200" value="3">
                    <button id="participants-increase" aria-label="increase">🔥</button>
                </div>
                <div class="control-label" style="text-align:center; margin-top:0.25em;">Participants</div>
              </div>

              <div class="control-group" style="display: flex; flex-direction: column; align-items: center;">
                <div class="emoji" style="text-align:center; margin-bottom: 8px; font-size:2em;">💵</div>
                <div class="control-row participant-control" style="justify-content: center;">
                  <button id="salary-decrease" aria-label="decrease-salary">🧯</button>
                  <input id="salary" type="number" min="1000" step="5000" value="90000">
                  <button id="salary-increase" aria-label="increase-salary">🔥</button>
                </div>
                <div class="control-label" style="text-align:center; margin-top:0.25em;">Average annual salary</div>
              </div>
          </section>

          <div class="actions" style="display: flex; flex-direction: column; align-items: center; gap: 1em; width: 100%; max-width: 300px; margin: 2.5em auto 0 auto;">
            <button id="start" style="width: 100%; font-size: 1.1em;">🔥  Start</button>
            <button id="reset" class="ghost" style="width: 100%; font-size: 1.1em;">🧯 Reset</button>
            <button id="share" class="ghost" style="width: 100%; font-size: 1.1em;"> 😬 Share</button>
          </div>
        </main>

        <footer style="margin-top: 1em; text-align: center; font-size: 1.2em; color: #888; width: 100%;">
            <a href="https://partner.schutera.com/impressum" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: underline;">
                Imprint
            </a>
        </footer>
    </div>
`;

// Elements
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

// Participants +/- controls
participantsDecrease.addEventListener('click', () => {
  let v = parseInt(participantsNumber.value) || 1; v = Math.max(1, v-1); participantsNumber.value = v; updateDisplay();
});
participantsIncrease.addEventListener('click', () => {
  let v = parseInt(participantsNumber.value) || 1; v = Math.min(200, v+1); participantsNumber.value = v; updateDisplay();
});
participantsNumber.addEventListener('input', () => {
  // Allow the user to clear the field while typing; only normalize on blur or when using buttons
  const raw = participantsNumber.value;
  if (raw === '') {
    // show updated rate (uses current total and treats participants as 0 for display until set)
    updateDisplay();
    return;
  }
  let v = parseInt(raw, 10);
  if (Number.isNaN(v)) v = 1;
  if (v < 1) v = 1;
  if (v > 200) v = 200;
  participantsNumber.value = v;
  updateDisplay();
});

// Normalize on blur to ensure a valid number if the field is left empty
participantsNumber.addEventListener('blur', () => {
  if (participantsNumber.value === '') participantsNumber.value = '1';
  updateDisplay();
});

// Simulation state
let running = false;
let ended = false;
let finalTotal = null;
let lastTs = null;
let rafId = null;
let startTimeMs = null; // epoch ms when current run started
let baseTotal = 0; // total at startTimeMs
let lastUrlUpdateTs = 0; // ms timestamp for throttling URL updates

function readStateFromUrl(){
  try{
    const params = new URLSearchParams(window.location.search);
    const p = params.get('participants') !== null ? parseInt(params.get('participants'), 10) : null;
    const s = params.get('salary') !== null ? parseFloat(params.get('salary')) : null;
    const t = params.get('total') !== null ? parseFloat(params.get('total')) : null;
    const started = params.get('started') !== null ? parseInt(params.get('started'), 10) : null;
    const ended = params.get('ended') === '1';
    const finalTotal = params.get('finalTotal') !== null ? parseFloat(params.get('finalTotal')) : null;
    return { participants: p, salary: s, total: t, started, ended, finalTotal };
  } catch(e){
    return { participants: null, salary: null, total: null, started: null };
  }
}

function updateUrlState(){
  try{
    const params = new URLSearchParams(window.location.search);
    const participants = participantsNumber && participantsNumber.value === '' ? '' : String(parseInt(participantsNumber.value || '1', 10));
    const salary = salaryInput && salaryInput.value === '' ? '' : String(parseFloat(salaryInput.value || '0'));
    params.set('participants', participants);
    params.set('salary', salary);
    // store the base total (total at the moment the current run started)
    params.set('total', String(baseTotal));
    // store start time as epoch ms so others can reproduce the same running state
    if (startTimeMs) params.set('started', String(startTimeMs)); else params.delete('started');
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    history.replaceState(null, '', newUrl);
  } catch(e){ /* ignore */ }
}

function formatCurrency(v){
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
}

// Salary +/- handlers and input live update
salaryDecrease.addEventListener('click', () => {
  let v = parseInt(salaryInput.value) || 1000; v = Math.max(1000, v - 5000); salaryInput.value = v; updateDisplay();
});
salaryIncrease.addEventListener('click', () => {
  let v = parseInt(salaryInput.value) || 1000; v = Math.min(2000000, v + 5000); salaryInput.value = v; updateDisplay();
});
salaryInput.addEventListener('input', () => updateDisplay());

function computePerSecond(participants, salary){
  // Assume 2080 working hours per year
  const hourly = salary / 2080;
  const perSecond = (hourly / 3600) * participants;
  return perSecond;
}


function updateDisplay(){
  const participants = parseInt(participantsNumber.value);
  const salary = parseFloat(salaryInput.value);
  const perSecond = computePerSecond(participants, salary);
  // show per-minute burn
  rateEl.textContent = formatCurrency(perSecond * 60);
  // If ended, show finalTotal and do not update
  if (ended && finalTotal !== null) {
    totalEl.textContent = formatCurrency(finalTotal);
    return;
  }
  // compute visible total depending on running state
  if (startTimeMs) {
    const elapsed = (Date.now() - startTimeMs) / 1000;
    totalEl.textContent = formatCurrency(baseTotal + perSecond * elapsed);
  } else {
    totalEl.textContent = formatCurrency(baseTotal);
  }
  updateUrlState();
}

function step(ts){
  if (!lastTs) lastTs = ts;
  const now = Date.now();
  lastTs = ts;
  const participants = parseInt(participantsNumber.value);
  const salary = parseFloat(salaryInput.value);
  const perSecond = computePerSecond(participants, salary);
  // compute total based on baseTotal + perSecond * elapsedSinceStart
  const elapsed = startTimeMs ? (now - startTimeMs) / 1000 : 0;
  const currentTotal = baseTotal + perSecond * elapsed;
  totalEl.textContent = formatCurrency(currentTotal);
  // show per-minute burn
  rateEl.textContent = formatCurrency(perSecond * 60);
  // throttle URL updates to once per 500ms to avoid flooding history
  if (ts - lastUrlUpdateTs > 500) {
    updateUrlState();
    lastUrlUpdateTs = ts;
  }
  rafId = requestAnimationFrame(step);
}

startBtn.addEventListener('click', () => {
  if (!running) {
    // start running: record start time and base total
    running = true;
    ended = false;
    finalTotal = null;
    startBtn.textContent = '🚒 End';
    startBtn.classList.remove('support-btn');
    lastTs = null;
    if (!startTimeMs) {
      startTimeMs = Date.now();
    }
    rafId = requestAnimationFrame(step);
    updateDisplay();
    sendDiscordWebhook('Someone is burning money in a meeting! 💸🔥');
  } else {
    // end meeting, then turn button into Support
    running = false;
    ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;
    if (startTimeMs) {
      const participants = parseInt(participantsNumber.value);
      const salary = parseFloat(salaryInput.value);
      const perSecond = computePerSecond(participants, salary);
      finalTotal = baseTotal + perSecond * ((Date.now() - startTimeMs) / 1000);
      baseTotal = finalTotal;
      startTimeMs = null;
    } else {
      finalTotal = baseTotal;
    }
    // Add ended flag and finalTotal to URL
    const params = new URLSearchParams(window.location.search);
    params.set('ended', '1');
    params.set('finalTotal', String(finalTotal));
    history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    startBtn.textContent = '⛽ Refuel Us';
    startBtn.classList.add('support-btn');
    startBtn.onclick = null;
    startBtn.addEventListener('click', () => {
      sendDiscordWebhook('⛽ Did we just get some fuel?');
      window.location.href = 'https://www.stripe.com';
    }, { once: true });
    updateDisplay();
  }
});

resetBtn.addEventListener('click', () => {
  window.location.href = window.location.pathname;
});

// Share button: Pure copy to clipboard
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    // Ensure URL is up-to-date and includes a running or ended state
    let url;
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
    url = window.location.origin + window.location.pathname + '?' + params.toString();
    try {
      await navigator.clipboard.writeText(url);
      const prev = shareBtn.textContent;
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = prev; }, 1500);
    } catch (err) {
      // Optionally handle clipboard error
    }
  });
}

// On page load, initialize from URL if present, else reset
(() => {
  const s = readStateFromUrl();
  if (s.participants !== null && !Number.isNaN(s.participants)) participantsNumber.value = String(s.participants);
  if (s.salary !== null && !Number.isNaN(s.salary)) salaryInput.value = String(s.salary);
  if (s.total !== null && !Number.isNaN(s.total)) baseTotal = s.total;
  ended = !!s.ended;
  finalTotal = s.finalTotal !== undefined && s.finalTotal !== null && !Number.isNaN(Number(s.finalTotal)) ? Number(s.finalTotal) : null;
  if (ended && finalTotal !== null) {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null; lastTs = null; startTimeMs = null;
    startBtn.textContent = '⛽ Refuel Us';
    startBtn.classList.add('support-btn');
    startBtn.onclick = null;
    startBtn.addEventListener('click', () => {
      window.location.href = '/support';
    }, { once: true });
    totalEl.textContent = formatCurrency(finalTotal);
    return;
  } else if (s.started !== null && !Number.isNaN(s.started)) {
    // reconstruct running state: set startTimeMs to the provided epoch ms and start the loop
    startTimeMs = s.started;
    running = true;
    startBtn.textContent = '🚒 End';
    rafId = requestAnimationFrame(step);
  } else {
    if (rafId) cancelAnimationFrame(rafId);
    running = false; rafId = null; lastTs = null;
    startTimeMs = null;
    baseTotal = 0;
    totalEl.textContent = formatCurrency(0);
    startBtn.textContent = '🔥 Start';
    startBtn.classList.remove('support-btn');
    startBtn.onclick = null;
  }
  updateDisplay();
  updateUrlState();
})();

// Decide whether to keep the background video on mobile/slow connections.
function applyVideoPolicy() {
  const video = document.getElementById('bg-video');
  if (!video) return;
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const saveData = conn && conn.saveData;
  const effectiveType = conn && conn.effectiveType ? conn.effectiveType : '';
  const slowNetwork = /2g/.test(effectiveType);
  // Vite environment override (VITE_SHOW_BG_VIDEO) — if explicitly set to 'true' or 'false'
  let envOverride = false;
  try { envOverride = typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_SHOW_BG_VIDEO !== 'undefined' ? import.meta.env.VITE_SHOW_BG_VIDEO : null; } catch(e){ envOverride = null }

  if (envOverride === 'false') {
    while (video.firstChild) video.removeChild(video.firstChild);
    video.style.display = 'none';
    return;
  }

  if ((saveData || slowNetwork) && envOverride !== 'true') {
    // remove sources to avoid automatic large downloads
    while (video.firstChild) video.removeChild(video.firstChild);
    video.style.display = 'none';
    return;
  }
  // ensure inline playback attribute for mobile
  video.setAttribute('playsinline', '');
}

applyVideoPolicy();

