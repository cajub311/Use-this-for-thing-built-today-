import { CHANT_SOURCES } from './data/chant-sources.js';

const DAY_PREFIX = 'mindful:day:';
const MODULE_FIELDS = ['diaryCard', 'chantSessions', 'bellSessions', 'practiceSessions'];

const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const storageKey = () => DAY_PREFIX + todayKey();

function readDay() {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '{}') || {};
  } catch {
    return {};
  }
}

function writeDay(next) {
  localStorage.setItem(storageKey(), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('stillness:forest-day-saved', { detail: next }));
}

function updateDay(mutator) {
  const day = readDay();
  MODULE_FIELDS.forEach((key) => {
    if (key === 'diaryCard' && (!day[key] || typeof day[key] !== 'object')) day[key] = {};
    if (key !== 'diaryCard' && !Array.isArray(day[key])) day[key] = [];
  });
  mutator(day);
  writeDay(day);
  return day;
}

function defaultDiaryFrom(day) {
  const maxScale = (arr) => Array.isArray(arr) ? Math.max(...arr.map((v) => Number(v) || 0), 0) : 0;
  return {
    emotions: {
      sadness: maxScale(day.phq2),
      anxiety: maxScale(day.gad2),
      anger: 0,
      shame: 0,
      joy: Number(day.mood) > 0 ? Math.max(0, Number(day.mood) - 1) : 0
    },
    urges: {
      harm: 0,
      avoid: Number(day.urgeLevel) || 0,
      substance: 0,
      contact: 0
    },
    targetBehavior: '',
    skills: Array.isArray(day.dbtSkills) ? day.dbtSkills.map((s) => s && s.skill).filter(Boolean).slice(-6) : [],
    vulnerabilityFactors: [],
    effectiveness: Number(day.skillHelped) || 0,
    sleepHours: Number(day.sleepHours) || 7,
    medsNote: '',
    bodyNote: day.careBodyNote || '',
    therapyQuestion: day.therapyQuestion || '',
    updatedAt: 0
  };
}

function ensureDiary(day) {
  const base = defaultDiaryFrom(day);
  const current = day.diaryCard && typeof day.diaryCard === 'object' ? day.diaryCard : {};
  return {
    ...base,
    ...current,
    emotions: { ...base.emotions, ...(current.emotions || {}) },
    urges: { ...base.urges, ...(current.urges || {}) },
    skills: Array.isArray(current.skills) ? current.skills : base.skills,
    vulnerabilityFactors: Array.isArray(current.vulnerabilityFactors) ? current.vulnerabilityFactors : base.vulnerabilityFactors
  };
}

const MEDITATION_BELL_PATH = 'assets/sounds/singing-bowl.ogg';

function playFallbackBell() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const now = ctx.currentTime;
  [196, 392, 588].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.2 : 0.07, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.7 + idx * 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + idx * 0.01);
    osc.stop(now + 3.1 + idx * 0.2);
  });
  window.setTimeout(() => ctx.close().catch(() => {}), 3600);
}

async function playSoftBell() {
  try {
    const audio = new Audio(MEDITATION_BELL_PATH);
    audio.preload = 'auto';
    audio.volume = 0.62;
    await audio.play();
  } catch {
    playFallbackBell();
  }
}

function recordSession(key, payload) {
  updateDay((day) => {
    if (!Array.isArray(day[key])) day[key] = [];
    day[key].push({ ...payload, ts: Date.now() });
  });
}

function paintSanctuaryChoice(kind, value) {
  const attr = kind === 'mood' ? 'data-mood' : 'data-energy';
  const scope = kind === 'mood' ? '[data-forest-mood]' : '[data-forest-energy]';
  document.querySelectorAll(`${scope} button`).forEach((btn) => {
    const on = Number(btn.getAttribute(attr)) === Number(value);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setSanctuaryChoice(kind, value) {
  const row = kind === 'mood' ? '#gentleMoodRow' : '#gentleEnergyRow';
  const attr = kind === 'mood' ? 'mood' : 'energy';
  paintSanctuaryChoice(kind, value);
  updateDay((day) => {
    day[kind] = Number(value);
  });
  window.requestAnimationFrame(() => {
    document.querySelector(`${row} [data-${attr}="${value}"]`)?.click();
    syncSanctuaryState();
  });
}

function mountSanctuary() {
  const today = document.getElementById('view-today');
  const plate = today?.querySelector('.plate');
  if (!today || !plate || document.getElementById('forestSanctuary')) return;

  const section = document.createElement('section');
  section.className = 'forest-sanctuary no-print';
  section.id = 'forestSanctuary';
  section.innerHTML = `
    <div class="sanctuary-copy">
      <p class="forest-kicker">Forest monastery</p>
      <h2>Arrive before you record.</h2>
      <p>One bell, one breath, then only what helps. The rest of the app can wait.</p>
    </div>
    <div class="sanctuary-panel">
      <div class="sanctuary-action-row">
        <button type="button" class="sanctuary-sit" id="sanctuarySitNow">Sit now</button>
        <button type="button" class="sanctuary-bell" id="sanctuaryBellOnly">Bell only</button>
      </div>
      <div class="sanctuary-card">
        <h3>Mood</h3>
        <div class="tiny-check-row" data-forest-mood>
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-mood="${n}" aria-label="Mood ${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="sanctuary-card">
        <h3>Energy</h3>
        <div class="tiny-check-row" data-forest-energy>
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-energy="${n}" aria-label="Energy ${n}">${n}</button>`).join('')}
        </div>
      </div>
      <button type="button" class="sanctuary-next" id="sanctuaryNextStep">Open Practice</button>
    </div>
  `;
  plate.insertAdjacentElement('afterend', section);

  section.querySelector('#sanctuarySitNow')?.addEventListener('click', () => {
    recordSession('practiceSessions', { kind: 'sit-now', source: 'sanctuary' });
    document.querySelector('[data-practice-launch="breathe"]')?.click();
  });
  section.querySelector('#sanctuaryBellOnly')?.addEventListener('click', () => {
    playSoftBell();
    recordSession('bellSessions', { kind: 'single-bell', source: 'sanctuary' });
    setStatus(section.querySelector('#sanctuaryNextStep'), 'Bell invited. Open Practice');
  });
  section.querySelector('#sanctuaryNextStep')?.addEventListener('click', () => {
    const day = readDay();
    if (Number(day.mood) > 0 && Number(day.mood) <= 2) {
      document.querySelector('[data-practice-launch="tipp"]')?.click();
    } else {
      document.querySelector('[data-practice-launch="kindness"]')?.click();
    }
    recordSession('practiceSessions', { kind: 'recommended-step', source: 'sanctuary' });
  });

  section.querySelectorAll('[data-forest-mood] button').forEach((btn) => {
    const choose = () => paintSanctuaryChoice('mood', btn.dataset.mood);
    btn.addEventListener('pointerdown', choose);
    btn.addEventListener('click', () => setSanctuaryChoice('mood', btn.dataset.mood));
  });
  section.querySelectorAll('[data-forest-energy] button').forEach((btn) => {
    const choose = () => paintSanctuaryChoice('energy', btn.dataset.energy);
    btn.addEventListener('pointerdown', choose);
    btn.addEventListener('click', () => setSanctuaryChoice('energy', btn.dataset.energy));
  });
  syncSanctuaryState();
}

function setStatus(el, fallback) {
  if (!el) return;
  el.textContent = fallback;
}

function syncSanctuaryState() {
  const day = readDay();
  document.querySelectorAll('[data-forest-mood] button').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.mood) === Number(day.mood || 0));
  });
  document.querySelectorAll('[data-forest-energy] button').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.energy) === Number(day.energy || 0));
  });
  const next = document.getElementById('sanctuaryNextStep');
  if (!next) return;
  if (!day.mood) next.textContent = 'Recommended: ring one bell';
  else if (Number(day.mood) <= 2 || Number(day.urgeLevel) >= 2) next.textContent = 'Recommended: open TIPP';
  else next.textContent = 'Recommended: metta practice';
}

function mountChantDoor() {
  const anchor = document.getElementById('qfAmbience');
  if (!anchor || document.getElementById('chantDoor')) return;
  const chants = CHANT_SOURCES;
  let activeIndex = 0;
  const licenseLabel = (chant) => (
    chant.licenseShort
    || chant.license
      .replace('Creative Commons Attribution-NonCommercial 4.0', 'CC BY-NC 4.0')
      .replace('CC0 1.0 Universal Public Domain Dedication', 'CC0 1.0')
  );
  const renderChantText = (chant) => `
    <h3>Words and meaning</h3>
    <h4>${chant.title}</h4>
    <ul class="chant-lines">${chant.transcript.map((line) => `<li>${line}</li>`).join('')}</ul>
    <ul class="meaning-lines">${chant.meaning.map((line) => `<li>${line}</li>`).join('')}</ul>
    <p class="chant-credit">${chant.pronunciation}</p>
    <p class="chant-credit">Credit: <a href="${chant.sourceUrl}" target="_blank" rel="noopener noreferrer">${chant.credit}</a>${chant.guideUrl ? ` - <a href="${chant.guideUrl}" target="_blank" rel="noopener noreferrer">chant text</a>` : ''}.</p>
  `;
  const section = document.createElement('details');
  section.className = 'leaf chant-door flow-section no-print collapsible-section';
  section.id = 'chantDoor';
  section.innerHTML = `
    <summary class="leaf-head">
      <h2 class="leaf-title">Chant <em>door</em></h2>
      <span class="leaf-num">optional</span>
    </summary>
    <p class="leaf-sub">A small set of Theravada Pali chants. Listen only if it helps; the app never starts vocal audio without a tap.</p>
    <div class="chant-layout">
      <div class="chant-visual" role="img" aria-label="A singing bowl in a quiet practice hall open to rain"></div>
      <div class="chant-card chant-player">
        <h3 id="chantTitle">${chants[0].title}</h3>
        <audio id="chantAudio" preload="metadata" src="${chants[0].localPath}"></audio>
        <div class="sanctuary-action-row">
          <button type="button" class="chant-action" id="chantPlay">Play selected</button>
          <button type="button" class="chant-action secondary" id="chantStop">Stop</button>
        </div>
        <p class="chant-status" id="chantStatus">silent</p>
        <p class="chant-credit" id="chantMeta">${chants[0].duration} - ${chants[0].language} - ${licenseLabel(chants[0])}</p>
        <div class="chant-selector" id="chantSelector" aria-label="Choose a Pali chant">
          ${chants.map((item, index) => `
            <button type="button" class="chant-option ${index === 0 ? 'on' : ''}" data-chant-index="${index}" aria-pressed="${index === 0 ? 'true' : 'false'}">
              <span>${item.title}</span>
              <small>${item.duration} - ${item.tradition || item.language}</small>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="chant-card chant-text" id="chantText">${renderChantText(chants[0])}</div>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', section);
  const audio = section.querySelector('#chantAudio');
  const status = section.querySelector('#chantStatus');
  const title = section.querySelector('#chantTitle');
  const meta = section.querySelector('#chantMeta');
  const text = section.querySelector('#chantText');
  const selectChant = (index) => {
    const next = chants[index] || chants[0];
    activeIndex = chants.indexOf(next);
    audio.pause();
    audio.currentTime = 0;
    audio.src = next.localPath;
    audio.load();
    title.textContent = next.title;
    meta.textContent = `${next.duration} - ${next.language} - ${licenseLabel(next)}`;
    text.innerHTML = renderChantText(next);
    status.textContent = 'silent';
    section.querySelectorAll('.chant-option').forEach((btn) => {
      const on = Number(btn.dataset.chantIndex) === activeIndex;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };
  section.querySelectorAll('.chant-option').forEach((btn) => {
    btn.addEventListener('click', () => selectChant(Number(btn.dataset.chantIndex)));
  });
  section.querySelector('#chantPlay')?.addEventListener('click', async () => {
    const chant = chants[activeIndex] || chants[0];
    try {
      await audio.play();
      status.textContent = 'chant playing';
      recordSession('chantSessions', { chantId: chant.id, title: chant.title, source: 'chant-door' });
    } catch {
      status.textContent = 'could not play here';
    }
  });
  section.querySelector('#chantStop')?.addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    status.textContent = 'silent';
  });
  audio.addEventListener('ended', () => { status.textContent = 'complete'; });
}

function mountGuidedAudio() {
  const anchor = document.getElementById('qfAmbience');
  if (!anchor || document.getElementById('guidedAudioPanel')) return;
  const section = document.createElement('details');
  section.className = 'leaf guided-audio-panel flow-section no-print collapsible-section';
  section.id = 'guidedAudioPanel';
  section.innerHTML = `
    <summary class="leaf-head">
      <h2 class="leaf-title">Guided <em>audio</em></h2>
      <span class="leaf-num">9 min</span>
    </summary>
    <div class="guided-audio-card">
      <div>
        <p class="forest-kicker">UCLA Mindful</p>
        <h3>Loving Kindness Meditation</h3>
        <p class="leaf-sub">A free 9-minute compassion practice streamed from UCLA Mindful. It needs internet and never starts without a tap.</p>
      </div>
      <audio id="guidedMettaAudio" controls preload="none" src="https://d1cy5zxxhbcbkk.cloudfront.net/guided-meditations/05_Loving_Kindness_Meditation.mp3"></audio>
      <p class="chant-credit">Credit: <a href="https://www.uclahealth.org/uclamindful/guided-meditations" target="_blank" rel="noopener noreferrer">UCLA Mindful</a>. License: CC BY-NC-ND 4.0.</p>
    </div>
  `;
  anchor.insertAdjacentElement('afterend', section);
  section.querySelector('#guidedMettaAudio')?.addEventListener('play', () => {
    recordSession('practiceSessions', { kind: 'guided-metta', title: 'UCLA Loving Kindness Meditation', source: 'ucla-mindful' });
  }, { once: true });
}

function mountDiaryCard() {
  const track = document.getElementById('view-track');
  const plate = track?.querySelector('.plate');
  if (!track || !plate || document.getElementById('forestDiaryCard')) return;
  const section = document.createElement('section');
  section.className = 'leaf forest-diary-card';
  section.id = 'forestDiaryCard';
  section.innerHTML = `
    <div class="leaf-head">
      <div>
        <p class="forest-kicker">DBT diary card</p>
        <h2>Track what matters.</h2>
      </div>
      <span class="leaf-num">private</span>
    </div>
    <p class="leaf-sub">Emotions, urges, skills, sleep, body, and one therapy question. Full enough for care, quiet enough for daily use.</p>
    <div class="diary-grid">
      <div class="diary-panel" data-diary-emotions>
        <h3>Emotions</h3>
        ${meter('sadness', 'Sadness', 'emotion')}
        ${meter('anxiety', 'Anxiety', 'emotion')}
        ${meter('anger', 'Anger', 'emotion')}
        ${meter('shame', 'Shame', 'emotion')}
        ${meter('joy', 'Joy', 'emotion')}
      </div>
      <div class="diary-panel" data-diary-urges>
        <h3>Urges</h3>
        ${meter('harm', 'Harm urge', 'urge')}
        ${meter('avoid', 'Avoid/quit', 'urge')}
        ${meter('substance', 'Substance', 'urge')}
        ${meter('contact', 'Contact/text', 'urge')}
        ${meter('effectiveness', 'Skill helped', 'effect')}
      </div>
      <div class="diary-panel">
        <h3>Skills used</h3>
        <div class="diary-skill-grid">
          ${['Wise mind', 'Observe', 'STOP', 'TIPP', 'Self-soothe', 'Opposite action', 'Check facts', 'Radical acceptance', 'DEAR MAN'].map((skill) => `<button type="button" class="skill-pill" data-diary-skill="${skill}">${skill}</button>`).join('')}
        </div>
      </div>
      <div class="diary-panel">
        <h3>Care notes</h3>
        <label class="diary-meter"><span>Sleep</span><input id="diarySleep" type="number" min="0" max="16" step="0.25" /><output>h</output></label>
        <textarea id="diaryMedsNote" rows="2" maxlength="260" placeholder="Meds, appetite, cycle, side effects, or health note..."></textarea>
      </div>
    </div>
    <div class="diary-panel diary-factor-panel">
      <h3>What made it harder?</h3>
      <div class="diary-factor-grid">
        ${['tired', 'hungry', 'pain', 'conflict', 'too much caffeine', 'alone', 'rushed', 'missed meds'].map((factor) => `<button type="button" class="diary-chip" data-diary-factor="${factor}">${factor}</button>`).join('')}
      </div>
    </div>
    <div class="diary-write-grid" style="margin-top:12px">
      <textarea id="diaryTargetBehavior" rows="3" maxlength="360" placeholder="Target behavior or pattern to discuss..."></textarea>
      <textarea id="diaryBodyNote" rows="3" maxlength="360" placeholder="Body note..."></textarea>
      <textarea id="diaryTherapyQuestion" rows="3" maxlength="360" placeholder="Question for next therapy or medical visit..."></textarea>
      <textarea id="diaryOneLine" rows="3" maxlength="360" placeholder="One line summary of today..."></textarea>
    </div>
    <div class="diary-foot">
      <button type="button" class="diary-save" id="diarySave">Save diary card</button>
      <span class="diary-status" id="diaryStatus">local only</span>
    </div>
  `;
  plate.insertAdjacentElement('afterend', section);
  section.addEventListener('input', updateDiaryOutputs);
  section.querySelectorAll('.skill-pill').forEach((btn) => {
    btn.addEventListener('click', () => btn.classList.toggle('on'));
  });
  section.querySelectorAll('[data-diary-factor]').forEach((btn) => {
    btn.addEventListener('click', () => btn.classList.toggle('on'));
  });
  section.querySelector('#diarySave')?.addEventListener('click', saveDiaryCard);
  renderDiaryCard();
  wrapBodyTrackers();
}

function meter(id, label, group) {
  return `<label class="diary-meter"><span>${label}</span><input type="range" min="0" max="5" step="1" value="0" data-diary-${group}="${id}" /><output data-diary-out="${group}:${id}">0</output></label>`;
}

function updateDiaryOutputs() {
  document.querySelectorAll('#forestDiaryCard input[type="range"]').forEach((input) => {
    const group = input.dataset.diaryEmotion ? 'emotion' : input.dataset.diaryUrge ? 'urge' : 'effect';
    const id = input.dataset.diaryEmotion || input.dataset.diaryUrge || input.dataset.diaryEffect;
    const out = document.querySelector(`[data-diary-out="${group}:${id}"]`);
    if (out) out.textContent = input.value;
  });
}

function renderDiaryCard() {
  const day = readDay();
  const diary = ensureDiary(day);
  Object.entries(diary.emotions || {}).forEach(([key, value]) => {
    const input = document.querySelector(`[data-diary-emotion="${key}"]`);
    if (input) input.value = String(value || 0);
  });
  Object.entries(diary.urges || {}).forEach(([key, value]) => {
    const input = document.querySelector(`[data-diary-urge="${key}"]`);
    if (input) input.value = String(value || 0);
  });
  const effect = document.querySelector('[data-diary-effect="effectiveness"]');
  if (effect) effect.value = String(diary.effectiveness || 0);
  setValue('diarySleep', diary.sleepHours || '');
  setValue('diaryMedsNote', diary.medsNote || '');
  setValue('diaryTargetBehavior', diary.targetBehavior || '');
  setValue('diaryBodyNote', diary.bodyNote || '');
  setValue('diaryTherapyQuestion', diary.therapyQuestion || '');
  setValue('diaryOneLine', diary.oneLine || '');
  document.querySelectorAll('[data-diary-skill]').forEach((btn) => {
    btn.classList.toggle('on', (diary.skills || []).includes(btn.dataset.diarySkill));
  });
  document.querySelectorAll('[data-diary-factor]').forEach((btn) => {
    btn.classList.toggle('on', (diary.vulnerabilityFactors || []).includes(btn.dataset.diaryFactor));
  });
  updateDiaryOutputs();
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function saveDiaryCard() {
  const emotions = {};
  document.querySelectorAll('[data-diary-emotion]').forEach((input) => { emotions[input.dataset.diaryEmotion] = Number(input.value) || 0; });
  const urges = {};
  document.querySelectorAll('[data-diary-urge]').forEach((input) => { urges[input.dataset.diaryUrge] = Number(input.value) || 0; });
  const skills = [...document.querySelectorAll('[data-diary-skill].on')].map((btn) => btn.dataset.diarySkill);
  const vulnerabilityFactors = [...document.querySelectorAll('[data-diary-factor].on')].map((btn) => btn.dataset.diaryFactor);
  updateDay((day) => {
    day.diaryCard = {
      emotions,
      urges,
      skills,
      vulnerabilityFactors,
      effectiveness: Number(document.querySelector('[data-diary-effect="effectiveness"]')?.value) || 0,
      sleepHours: Number(document.getElementById('diarySleep')?.value) || 0,
      medsNote: document.getElementById('diaryMedsNote')?.value || '',
      targetBehavior: document.getElementById('diaryTargetBehavior')?.value || '',
      bodyNote: document.getElementById('diaryBodyNote')?.value || '',
      therapyQuestion: document.getElementById('diaryTherapyQuestion')?.value || '',
      oneLine: document.getElementById('diaryOneLine')?.value || '',
      updatedAt: Date.now()
    };
  });
  const status = document.getElementById('diaryStatus');
  if (status) status.textContent = 'saved';
  window.setTimeout(() => { if (status) status.textContent = 'local only'; }, 1800);
  syncSanctuaryState();
}

function wrapBodyTrackers() {
  const pack = document.getElementById('qfTrackPack');
  if (!pack || document.getElementById('bodyBasicsDetails')) return;
  const details = document.createElement('details');
  details.className = 'leaf body-basics-details collapsible-section';
  details.id = 'bodyBasicsDetails';
  details.innerHTML = `
    <summary class="leaf-head">
      <h2 class="leaf-title">Body <em>basics</em></h2>
      <span class="leaf-num">optional</span>
    </summary>
    <p class="leaf-sub">Water, bathroom, caffeine, movement, daylight, and steps. These stay folded until you need them.</p>
  `;
  pack.insertAdjacentElement('beforebegin', details);
  details.appendChild(pack);
}

function mountGardenCalm() {
  const history = document.getElementById('view-history');
  const streak = document.getElementById('streakCard');
  if (!history || !streak) return;
  const label = streak.querySelector('.streak-label');
  if (label) label.textContent = 'days tended';

  let weekly = document.getElementById('forestWeeklyReview');
  if (!weekly) {
    weekly = document.createElement('section');
    weekly.className = 'leaf forest-weekly-review';
    weekly.id = 'forestWeeklyReview';
    weekly.innerHTML = `
      <div class="leaf-head">
        <h2 class="leaf-title">Week <em>in practice</em></h2>
        <span class="leaf-num">gentle</span>
      </div>
      <p class="leaf-sub" id="forestWeekSummary">A soft look at the last seven days.</p>
      <div class="forest-week-row" id="forestWeekRow" aria-label="Last seven days tended"></div>
    `;
    streak.insertAdjacentElement('afterend', weekly);
  }

  if (!document.getElementById('gardenPatternsDetails')) {
    const vault = document.createElement('details');
    vault.className = 'leaf garden-patterns-details collapsible-section';
    vault.id = 'gardenPatternsDetails';
    vault.innerHTML = `
      <summary class="leaf-head">
        <h2 class="leaf-title">Charts <em>and patterns</em></h2>
        <span class="leaf-num">open</span>
      </summary>
      <p class="leaf-sub">Longer views are here when useful; the Garden starts with reflection first.</p>
    `;
    weekly.insertAdjacentElement('afterend', vault);
    ['moodHeatmapCard', 'moodGraphCard', 'gardenChart90Card', 'gardenBodySparks', 'gardenChartInsights'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) vault.appendChild(el);
    });
  }
  updateWeeklyReview();
}

function allDays() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(DAY_PREFIX))
    .sort()
    .map((key) => {
      try { return { date: key.slice(DAY_PREFIX.length), ...JSON.parse(localStorage.getItem(key) || '{}') }; }
      catch { return null; }
    })
    .filter(Boolean);
}

function updateWeeklyReview() {
  const row = document.getElementById('forestWeekRow');
  const summary = document.getElementById('forestWeekSummary');
  if (!row || !summary) return;
  const map = new Map(allDays().map((d) => [d.date, d]));
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    days.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), data: map.get(key) });
  }
  const tended = days.filter((d) => hasUsefulData(d.data)).length;
  const minutes = days.reduce((sum, d) => sum + (Number(d.data?.mindfulMinutes) || 0), 0);
  summary.textContent = tended
    ? `${tended} of 7 days tended. ${minutes ? `${minutes} mindful minutes recorded.` : 'No minute-count pressure.'}`
    : 'No week pattern yet. One bell or one line is enough to begin.';
  row.innerHTML = days.map((d) => `<div class="forest-week-dot" title="${d.key}">${d.label}<br>${hasUsefulData(d.data) ? 'tended' : 'open'}</div>`).join('');
}

function hasUsefulData(d) {
  if (!d) return false;
  return !!(d.mood || d.energy || d.intention || d.mindfulMinutes || d.diaryCard || (d.dbtSkills && d.dbtSkills.length) || (d.chantSessions && d.chantSessions.length) || (d.bellSessions && d.bellSessions.length) || (d.practiceSessions && d.practiceSessions.length));
}

function patchLabels() {
  const nav = document.querySelector('.nav-btn[data-view="track"]');
  nav?.setAttribute('aria-label', 'Diary - DBT and body');
  const navLabel = nav?.querySelector('.nav-label');
  if (navLabel) navLabel.textContent = 'Diary';
  const trackPlate = document.querySelector('#view-track .plate');
  const ornament = trackPlate?.querySelector('.ornament');
  const title = trackPlate?.querySelector('.greeting');
  if (ornament) ornament.textContent = 'Diary';
  if (title) title.textContent = 'Diary card.';
  const date = document.getElementById('trackDate');
  if (date) date.textContent = 'Emotions · urges · skills · body';
}

function installRefreshHooks() {
  document.addEventListener('click', (event) => {
    const nav = event.target.closest?.('.nav-btn');
    if (!nav) return;
    window.setTimeout(() => {
      if (nav.dataset.view === 'history') mountGardenCalm();
      syncSanctuaryState();
    }, 120);
  }, true);
  window.addEventListener('stillness:forest-day-saved', () => {
    syncSanctuaryState();
    updateWeeklyReview();
  });
}

function init() {
  document.documentElement.classList.add('forest-revamp');
  patchLabels();
  mountSanctuary();
  mountChantDoor();
  mountGuidedAudio();
  mountDiaryCard();
  mountGardenCalm();
  installRefreshHooks();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
