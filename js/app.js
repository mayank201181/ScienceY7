// ---------- Year 7 Science Revision app ----------
const EXAM_DATE = new Date('2026-06-12T09:00:00+08:00'); // Paper 1
const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

const state = { topic: null, mode: 'guide', level: 'basic', quiz: {} };

// Persistent answer store — keeps her progress when she switches topics,
// closes the tab, or comes back another day. Keyed as "<topic>::<qid>".
const Store = {
  ANS_KEY: 'vsci_answers_v1',
  ORD_KEY: 'vsci_order_v1',
  _ans: null, _ord: null,
  _loadAns() { if (!this._ans) { try { this._ans = JSON.parse(localStorage.getItem(this.ANS_KEY) || '{}'); } catch { this._ans = {}; } } return this._ans; },
  _saveAns() { try { localStorage.setItem(this.ANS_KEY, JSON.stringify(this._ans || {})); } catch {} },
  _loadOrd() { if (!this._ord) { try { this._ord = JSON.parse(localStorage.getItem(this.ORD_KEY) || '{}'); } catch { this._ord = {}; } } return this._ord; },
  _saveOrd() { try { localStorage.setItem(this.ORD_KEY, JSON.stringify(this._ord || {})); } catch {} },
  get(topic, qid) { return this._loadAns()[topic + '::' + qid]; },
  set(topic, qid, val) { this._loadAns()[topic + '::' + qid] = val; this._saveAns(); },
  getOrder(topic, level) { return this._loadOrd()[topic + '::' + level] || null; },
  setOrder(topic, level, qids) { this._loadOrd()[topic + '::' + level] = qids; this._saveOrd(); },
  clearTopicLevel(topic, level, pool) {
    const a = this._loadAns(); pool.forEach(q => { if (q.level === level) delete a[topic + '::' + q.id]; }); this._saveAns();
    const o = this._loadOrd(); delete o[topic + '::' + level]; this._saveOrd();
  }
};

// ---------- countdown ----------
function renderCountdown() {
  const days = Math.ceil((EXAM_DATE - new Date()) / 86400000);
  const c = $('#countdown');
  if (days > 0) c.textContent = `📚 ${days} day${days === 1 ? '' : 's'} to Paper 1`;
  else c.textContent = '🍀 Good luck!';
}

// ---------- views ----------
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $('#view-' + view).classList.remove('hidden');
  window.scrollTo(0, 0);
}

async function renderHome() {
  show('home');
  const grid = $('#topicGrid');
  grid.innerHTML = '<p class="muted">Loading topics…</p>';
  try {
    const idx = await Content.getIndex();
    grid.innerHTML = '';
    idx.topics.forEach(t => {
      const card = el('button', 'topic-card');
      card.innerHTML = `
        <span class="emoji">${t.emoji || '🔬'}</span>
        <span class="tcode">${t.code}</span>
        <span class="tname">${t.title}</span>
        <span class="tmeta">${t.questionCount || ''} questions · ${t.flashcardCount || ''} flashcards</span>`;
      card.onclick = () => openTopic(t.code);
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = `<p class="muted">⚠️ ${e.message}</p>`;
  }
}

async function openTopic(code) {
  show('topic');
  $('#modeBody').innerHTML = '<p class="muted">Loading…</p>';
  try {
    state.topic = await Content.getTopic(code);
  } catch (e) {
    $('#modeBody').innerHTML = `<p class="muted">⚠️ ${e.message}</p>`;
    return;
  }
  $('#topicBadge').textContent = state.topic.code;
  $('#topicTitle').textContent = state.topic.title;
  $('#topicSubtitle').textContent = state.topic.subtitle || '';
  setMode('guide');
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'guide') renderGuide();
  else if (mode === 'flash') renderFlash();
  else if (mode === 'quiz') renderQuiz();
  else if (mode === 'mistakes') renderMistakes();
}

// ---------- study guide ----------
function renderGuide() {
  const body = $('#modeBody');
  body.innerHTML = '';
  (state.topic.studyGuide || []).forEach(sec => {
    const card = el('div', 'card');
    card.appendChild(el('h2', null, sec.heading));
    if (sec.html) card.insertAdjacentHTML('beforeend', sec.html);
    if (sec.diagram) {
      const fig = el('figure', 'diagram');
      fig.innerHTML = sec.diagram.svg + (sec.diagram.caption ? `<figcaption>${sec.diagram.caption}</figcaption>` : '');
      card.appendChild(fig);
    }
    if (sec.mnemonic) {
      card.insertAdjacentHTML('beforeend', `<div class="mnemonic"><b>💡 Memory trick:</b> ${sec.mnemonic}</div>`);
    }
    body.appendChild(card);
  });
  if (!state.topic.studyGuide || !state.topic.studyGuide.length) body.innerHTML = '<p class="muted">Study guide coming soon.</p>';
}

// ---------- flashcards ----------
function renderFlash() {
  const body = $('#modeBody');
  const cards = state.topic.flashcards || [];
  if (!cards.length) { body.innerHTML = '<p class="muted">No flashcards yet.</p>'; return; }
  let i = 0;
  body.innerHTML = `
    <div class="flash-wrap">
      <div class="flash-progress" id="flashProg"></div>
      <div class="flashcard" id="flashcard">
        <div class="flash-inner">
          <div class="flash-face flash-front"><span class="flash-tag">QUESTION</span><span id="flashFront"></span></div>
          <div class="flash-face flash-back"><span class="flash-tag">ANSWER</span><span id="flashBack"></span></div>
        </div>
      </div>
      <div class="flash-nav">
        <button class="btn ghost" id="flashPrev">← Prev</button>
        <button class="btn ghost" id="flashFlip">Flip 🔄</button>
        <button class="btn" id="flashNext">Next →</button>
      </div>
    </div>`;
  const fc = $('#flashcard');
  function draw() {
    fc.classList.remove('flipped');
    $('#flashFront').textContent = cards[i].front;
    $('#flashBack').textContent = cards[i].back;
    $('#flashProg').textContent = `Card ${i + 1} of ${cards.length}`;
  }
  fc.onclick = () => fc.classList.toggle('flipped');
  $('#flashFlip').onclick = () => fc.classList.toggle('flipped');
  $('#flashPrev').onclick = () => { i = (i - 1 + cards.length) % cards.length; draw(); };
  $('#flashNext').onclick = () => { i = (i + 1) % cards.length; draw(); };
  draw();
}

// ---------- quiz ----------
function renderQuiz() {
  const body = $('#modeBody');
  const levels = ['basic', 'intermediate', 'advanced'];
  body.innerHTML = `
    <div class="quiz-controls">
      ${levels.map(l => `<button class="level-pill ${l}" data-level="${l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}
      <span class="qcount" id="qcount"></span>
    </div>
    <div id="qnav" class="qnav"></div>
    <div id="qhost"></div>
    <div style="margin-top:14px;text-align:center;display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
      <button class="btn ghost" id="genMore">✨ Generate more practice</button>
      <button class="btn ghost" id="resetAns" title="Clear your saved answers for this level">↺ Reset answers</button>
    </div>`;
  body.querySelectorAll('.level-pill').forEach(p => p.onclick = () => { state.level = p.dataset.level; startQuiz(); });
  $('#genMore').onclick = generateMore;
  $('#resetAns').onclick = resetAnswers;
  startQuiz();
}

function resetAnswers() {
  if (!confirm(`Clear your saved answers for "${state.topic.title}" — ${state.level} level?`)) return;
  Store.clearTopicLevel(state.topic.code, state.level, state.quiz.pool);
  state.quiz.idx = 0;
  renderNav();
  drawQuestion();
  toast('Answers reset for this level.');
}

async function generateMore() {
  const btn = $('#genMore');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Writing new questions…';
  try {
    const examples = (state.topic.questions || []).filter(q => q.level === state.level).slice(0, 3);
    const res = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicTitle: state.topic.title, level: state.level, count: 5, examples })
    });
    const data = await res.json();
    if (data.questions && data.questions.length) {
      state.topic.questions.push(...data.questions);          // keep for this session
      state.quiz.pool.push(...shuffle(data.questions.slice()));
      Store.setOrder(state.topic.code, state.level, state.quiz.pool.map(q => q.id));
      $('#qcount').textContent = `${state.quiz.pool.length} questions`;
      renderNav();
      toast(`Added ${data.questions.length} new ${state.level} questions!`);
    } else {
      toast(data.error ? 'AI generation needs the API key set (works once deployed).' : 'No new questions returned.');
    }
  } catch (e) {
    toast('Could not reach the generator — is the server running?');
  }
  btn.disabled = false;
  btn.innerHTML = '✨ Generate more practice';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 3000);
}

function startQuiz() {
  document.querySelectorAll('.level-pill').forEach(p => p.classList.toggle('active', p.dataset.level === state.level));
  const all = (state.topic.questions || []).filter(q => q.level === state.level);
  // Freeze the question order per topic+level so Q1, Q2... stay the same
  // every visit. Shuffle only the very first time, then save the order.
  const savedOrder = Store.getOrder(state.topic.code, state.level);
  let pool;
  if (savedOrder) {
    const byId = new Map(all.map(q => [q.id, q]));
    pool = savedOrder.map(id => byId.get(id)).filter(Boolean);
    all.forEach(q => { if (!pool.includes(q)) pool.push(q); });   // any new questions go at the end
    if (pool.length !== savedOrder.length) Store.setOrder(state.topic.code, state.level, pool.map(q => q.id));
  } else {
    pool = shuffle(all.slice());
    Store.setOrder(state.topic.code, state.level, pool.map(q => q.id));
  }
  state.quiz = { pool, idx: 0 };
  $('#qcount').textContent = `${all.length} questions`;
  renderNav();
  drawQuestion();
}

// Clickable strip of question numbers at the top of the quiz.
function renderNav() {
  const nav = $('#qnav');
  if (!nav) return;
  nav.innerHTML = '';
  state.quiz.pool.forEach((q, i) => {
    const b = el('button', 'qnum', String(i + 1));
    const ans = Store.get(state.topic.code, q.id);
    if (ans) b.classList.add('answered', ans.verdict);
    if (i === state.quiz.idx) b.classList.add('current');
    b.onclick = () => { state.quiz.idx = i; drawQuestion(); };
    nav.appendChild(b);
  });
}

function updateNav() {
  const nav = $('#qnav');
  if (!nav) return;
  [...nav.children].forEach((b, i) => {
    const ans = Store.get(state.topic.code, state.quiz.pool[i].id);
    b.className = 'qnum' + (ans ? ' answered ' + ans.verdict : '') + (i === state.quiz.idx ? ' current' : '');
  });
}

function drawQuestion() {
  const host = $('#qhost');
  const { pool, idx } = state.quiz;
  if (!pool.length) { host.innerHTML = '<p class="muted">No questions at this level yet.</p>'; return; }
  const q = pool[idx];
  state.quiz.current = q;
  const saved = Store.get(state.topic.code, q.id);
  const card = el('div', 'q-card');
  card.appendChild(el('div', 'q-meta', `${q.level.toUpperCase()} · ${q.type === 'mcq' ? 'Multiple choice' : 'Short answer'} ${q.marks ? '· ' + q.marks + ' mark' + (q.marks > 1 ? 's' : '') : ''} · Q${idx + 1}/${pool.length}`));
  card.appendChild(el('div', 'q-text', q.q));

  let optList = null;
  if (q.type === 'mcq') {
    optList = el('div', 'opt-list');
    q.options.forEach((opt, oi) => {
      const b = el('button', 'opt', opt);
      b.onclick = () => submitMCQ(q, oi, optList);
      optList.appendChild(b);
    });
    card.appendChild(optList);
  } else {
    const ta = el('textarea', 'short-input');
    ta.id = 'shortAns';
    ta.placeholder = 'Write your answer here…';
    if (saved) ta.value = saved.text || '';
    card.appendChild(ta);
  }

  const actions = el('div', 'q-actions');
  const prev = el('button', 'btn ghost', '← Prev');
  prev.disabled = idx === 0;
  prev.onclick = () => { if (state.quiz.idx > 0) { state.quiz.idx--; drawQuestion(); } };
  actions.appendChild(prev);

  if (q.type === 'short') {
    const submit = el('button', 'btn', saved ? 'Re-check' : 'Check my answer');
    submit.onclick = () => submitShort(q, submit);
    actions.appendChild(submit);
  }
  const hintBtn = el('button', 'btn ghost', '💡 Hint');
  hintBtn.onclick = () => {
    if (card.querySelector('.hint-box')) return;
    actions.insertAdjacentHTML('afterend', `<div class="hint-box"><b>Hint:</b> ${q.hint || 'Think about the key words from your study guide.'}</div>`);
  };
  actions.appendChild(hintBtn);

  const next = el('button', 'btn ghost', 'Next →');
  next.disabled = idx >= pool.length - 1;
  next.onclick = () => { if (state.quiz.idx < pool.length - 1) { state.quiz.idx++; drawQuestion(); } };
  actions.appendChild(next);
  card.appendChild(actions);

  host.innerHTML = '';
  host.appendChild(card);

  // Restore a previously-given answer so she can review it.
  if (saved) {
    if (q.type === 'mcq' && optList) {
      [...optList.children].forEach((b, i) => {
        b.disabled = true;
        if (i === q.answer) b.classList.add('correct');
        else if (i === saved.chosen) b.classList.add('wrong');
        if (i === saved.chosen) b.classList.add('chosen');
      });
    }
    showVerdict(saved.res, q);
  }
  updateNav();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function submitMCQ(q, chosen, list) {
  const res = Grader.gradeMCQ(q, chosen);
  [...list.children].forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add('correct');
    else if (i === chosen) b.classList.add('wrong');
  });
  Store.set(state.topic.code, q.id, { type: 'mcq', chosen, verdict: res.verdict, res });
  showVerdict(res, q);
  updateNav();
}

async function submitShort(q, btn) {
  const answer = $('#shortAns').value;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Checking…';
  const res = await Grader.gradeShort(q, answer);
  btn.disabled = false;
  btn.innerHTML = 'Re-check';
  Store.set(state.topic.code, q.id, { type: 'short', text: answer, verdict: res.verdict, res });
  showVerdict(res, q);
  updateNav();
}

function showVerdict(res, q) {
  const card = $('.q-card');
  const old = card.querySelector('.verdict'); if (old) old.remove();
  const labels = { correct: '✅ Correct', partial: '🟡 Partially correct', wrong: '❌ Not quite' };
  const v = el('div', 'verdict ' + res.verdict);
  v.innerHTML = `<div class="vhead">${labels[res.verdict] || res.verdict}</div><div>${res.feedback || ''}</div>`;
  if (q.type === 'short' && q.modelAnswer) {
    v.insertAdjacentHTML('beforeend', `<div class="model-ans"><b>Model answer:</b> ${q.modelAnswer}</div>`);
  }
  if (q.examMistake) {
    v.insertAdjacentHTML('beforeend', `<div class="exam-mistake">⚠️ Common mistake: ${q.examMistake}</div>`);
  }
  card.appendChild(v);
}

// ---------- common mistakes ----------
function renderMistakes() {
  const body = $('#modeBody');
  const mistakes = state.topic.commonMistakes || [];
  if (!mistakes.length) { body.innerHTML = '<p class="muted">No mistakes listed yet.</p>'; return; }
  body.innerHTML = '<div class="card"><h2>⚠️ Common exam mistakes</h2><p class="muted">Watch out for these — they cost easy marks.</p></div>';
  mistakes.forEach(m => {
    const item = el('div', 'mistake-item');
    if (typeof m === 'string') item.innerHTML = m;
    else item.innerHTML = `<div class="mtitle">${m.title}</div><div>${m.detail}</div>`;
    body.appendChild(item);
  });
}

// ---------- utils ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ============================================================
// MOCK PAPERS — timed full-exam practice (Paper 1 MCQ, Paper 2 short answer)
// ============================================================
const Mocks = (() => {
  let fileData = null;
  const CUSTOM_KEY = 'vsci_custom_mocks';
  async function load() {
    if (!fileData) { const r = await fetch('content/mocks.json'); fileData = await r.json(); }
    let customs = [];
    try { customs = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch {}
    return { mocks: [...fileData.mocks, ...customs] };
  }
  const k = id => 'vsci_mock_' + id;
  function get(id) { try { return JSON.parse(localStorage.getItem(k(id)) || 'null'); } catch { return null; } }
  function put(id, s) { try { localStorage.setItem(k(id), JSON.stringify(s)); } catch {} }
  function del(id) { localStorage.removeItem(k(id)); }
  function _customs() { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; } }
  function saveCustom(mock) {
    const c = _customs().filter(m => m.id !== mock.id);
    c.push(mock);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(c));
  }
  function deleteCustom(id) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(_customs().filter(m => m.id !== id)));
    del(id);
  }
  return { load, get, put, del, saveCustom, deleteCustom };
})();

let examState = null;        // { mock, st, idx, tickHandle, saveTimer }
let submittingExam = false;

// Defer localStorage writes during typing — saves once she stops, so each
// keystroke stays instant. examState.st is the source of truth in memory.
function debouncedExamSave() {
  if (!examState) return;
  if (examState.saveTimer) clearTimeout(examState.saveTimer);
  examState.saveTimer = setTimeout(() => {
    examState.saveTimer = null;
    if (examState && examState.st) Mocks.put(examState.mock.id, examState.st);
  }, 400);
}
function flushExamSave() {
  if (examState && examState.saveTimer) {
    clearTimeout(examState.saveTimer);
    examState.saveTimer = null;
    Mocks.put(examState.mock.id, examState.st);
  }
}

async function openMocksList() {
  show('mocks');
  const body = $('#mocksBody');
  body.innerHTML = '<p class="muted">Loading mock papers…</p>';
  const { mocks } = await Mocks.load();
  const standard = mocks.filter(m => !m.isWeak);
  const customs = mocks.filter(m => m.isWeak);

  // Count wrong attempts across all submitted standard mocks.
  const submittedStandard = standard
    .map(m => ({ m, st: Mocks.get(m.id) }))
    .filter(x => x.st && x.st.submittedAt && x.st.results)
    .sort((a, b) => a.st.submittedAt - b.st.submittedAt);
  let totalWrongAcrossAll = 0;
  const uniqueWrongAcrossAll = new Set();
  submittedStandard.forEach(({ st }) => {
    for (const r of st.results.perQuestion) {
      if (r.verdict !== 'correct') {
        totalWrongAcrossAll++;
        uniqueWrongAcrossAll.add(r.qid);
      }
    }
  });
  const papersDone = submittedStandard.length;

  body.innerHTML = `
    <h1 style="margin:6px 0">📝 Mock Exam Papers</h1>
    <p class="muted" style="margin-top:0">Press <b>✓ Check answer</b> on each question for instant feedback, or just answer everything and Submit at the end.</p>

    <div class="weak-cta">
      <div class="weak-info">
        <b>🎯 Targeted practice</b><br>
        <span class="muted" id="weakStats">${papersDone === 0
            ? 'Once you finish a mock paper, your wrong/partial questions will appear here for re-practice.'
            : `You've got <b>${totalWrongAcrossAll}</b> wrong/partial attempt${totalWrongAcrossAll === 1 ? '' : 's'} across <b>${papersDone}</b> paper${papersDone === 1 ? '' : 's'} (covering <b>${uniqueWrongAcrossAll.size}</b> unique question${uniqueWrongAcrossAll.size === 1 ? '' : 's'}).`}</span>
      </div>
      ${papersDone > 0 ? `
      <div class="weak-controls">
        <label>From <select id="weakScope">
          <option value="all">all papers</option>
          ${papersDone > 1 ? '<option value="last">latest paper only</option>' : ''}
        </select></label>
        <label>Size <select id="weakSize">
          <option value="15">15 questions</option>
          <option value="30" selected>30 questions</option>
          <option value="60">60 questions</option>
          <option value="0">All weak (max 60)</option>
        </select></label>
        <button class="btn" id="genWeak">🎯 Generate</button>
      </div>` : ''}
    </div>
    ${customs.length ? `<h3 style="margin-top:18px">Your weak-points mocks</h3><div id="mockListCustom" class="mock-list"></div>` : ''}

    <h3 style="margin-top:24px">Paper 1 — multiple choice (60 questions · 45 min)</h3>
    <div id="mockListP1" class="mock-list"></div>
    <h3 style="margin-top:24px">Paper 2 — short answer + skills (~45 marks · 45 min)</h3>
    <div id="mockListP2" class="mock-list"></div>`;

  if (papersDone > 0) $('#genWeak').onclick = buildWeakPointsMock;

  function renderCard(m, target, opts = {}) {
    const card = el('button', 'mock-card');
    const st = Mocks.get(m.id);
    let statusHtml = '';
    if (st && st.submittedAt && st.results) {
      const r = st.results;
      const pct = Math.round((r.totalAwarded / r.totalMax) * 100);
      statusHtml = `<div class="mscore done">✅ Score: ${r.totalAwarded}/${r.totalMax} (${pct}%)</div>`;
    } else if (st && st.startedAt) {
      statusHtml = `<div class="mscore">⏸️ In progress — tap to resume</div>`;
    }
    const tag = m.isWeak ? '<span class="mock-tag weak">WEAK POINTS</span>' : `<span class="mock-tag ${m.paper === 1 ? 'p1' : 'p2'}">PAPER ${m.paper}</span>`;
    const closeBtn = m.isWeak ? '<button class="mock-close" title="Delete this weak-points mock" aria-label="Delete">✕</button>' : '';
    card.innerHTML = `
      ${closeBtn}
      ${tag}
      <span class="mname">${m.title}</span>
      <span class="mmeta">${m.totalQuestions} question${m.totalQuestions === 1 ? '' : 's'} · ${m.durationMin} min${m.totalMarks ? ' · ' + m.totalMarks + ' marks' : ''}</span>
      ${statusHtml}`;
    card.onclick = () => startMock(m.id);
    if (m.isWeak) {
      const close = card.querySelector('.mock-close');
      close.onclick = (e) => {
        e.stopPropagation();
        if (!confirm(`Delete ${m.title}?`)) return;
        Mocks.deleteCustom(m.id);
        openMocksList();
      };
    }
    target.appendChild(card);
  }
  standard.forEach(m => renderCard(m, m.paper === 1 ? $('#mockListP1') : $('#mockListP2')));
  if (customs.length) customs.forEach(m => renderCard(m, $('#mockListCustom')));
}

async function buildWeakPointsMock() {
  const scope = $('#weakScope') ? $('#weakScope').value : 'all';
  const sizeOpt = $('#weakSize') ? parseInt($('#weakSize').value, 10) : 30;
  const { mocks } = await Mocks.load();
  const standard = mocks.filter(m => !m.isWeak);
  const qIndex = new Map();
  standard.forEach(m => m.questions.forEach(q => qIndex.set(q.id, q)));

  let submitted = standard
    .map(m => ({ m, st: Mocks.get(m.id) }))
    .filter(x => x.st && x.st.submittedAt && x.st.results)
    .sort((a, b) => a.st.submittedAt - b.st.submittedAt);
  if (scope === 'last' && submitted.length) submitted = [submitted[submitted.length - 1]];

  // Count wrong attempts per qid (across the chosen scope).
  const counts = {};
  submitted.forEach(({ st }) => {
    for (const r of st.results.perQuestion) {
      if (r.verdict !== 'correct') {
        if (!counts[r.qid]) counts[r.qid] = { wrongs: 0, lastAttempt: 0 };
        counts[r.qid].wrongs++;
        counts[r.qid].lastAttempt = Math.max(counts[r.qid].lastAttempt, st.submittedAt);
      }
    }
  });
  const sortedQids = Object.keys(counts).sort((a, b) =>
    counts[b].wrongs - counts[a].wrongs || counts[b].lastAttempt - counts[a].lastAttempt
  );
  if (!sortedQids.length) { toast('No weak questions in the chosen scope.'); return; }

  const cap = sizeOpt === 0
    ? Math.min(60, sortedQids.length)
    : Math.min(sizeOpt, sortedQids.length);
  const pickedQids = sortedQids.slice(0, cap);
  const picked = shuffle(pickedQids.map(id => qIndex.get(id)).filter(Boolean));

  // Sequential numbering across existing weak mocks
  const existingWeak = mocks.filter(m => m.isWeak);
  const seq = existingWeak.length + 1;
  const mcqCount = picked.filter(q => q.type === 'mcq').length;
  const paper = mcqCount >= picked.length / 2 ? 1 : 2;
  const totalMarks = picked.reduce((s, q) => s + (q.marks || 1), 0);
  const scopeLabel = scope === 'last' ? ' · latest paper' : '';

  const mock = {
    id: 'P-weak-' + Date.now(),
    isWeak: true,
    paper,
    title: `🎯 Weak Points #${seq}`,
    durationMin: Math.max(15, Math.ceil(picked.length * 0.9)),
    totalQuestions: picked.length,
    totalMarks,
    instructions: `Practice on ${picked.length} of your wrong/partial questions${scopeLabel}. Use ✓ Check answer, or do it timed.`,
    questions: picked
  };
  Mocks.saveCustom(mock);
  toast(`Built ${mock.title} with ${picked.length} questions.`);
  openMocksList();
}

async function startMock(id) {
  const { mocks } = await Mocks.load();
  const mock = mocks.find(m => m.id === id);
  let st = Mocks.get(id);
  if (st && st.submittedAt && st.results) return showMockResults(mock, st);
  if (!st) {
    if (!confirm(`Start ${mock.title}?\n\nTimer: ${mock.durationMin} minutes (begins immediately). You can submit early.`)) return;
    st = { startedAt: Date.now(), answers: {}, checks: {}, submittedAt: null, results: null };
    Mocks.put(id, st);
  }
  enterExam(mock, st);
}

function enterExam(mock, st) {
  show('mocks');
  examState = { mock, st, idx: 0, tickHandle: null, saveTimer: null };
  const body = $('#mocksBody');
  body.innerHTML = `
    <button class="back" id="examLeave">← Save &amp; leave</button>
    <div class="exam-header">
      <div class="exam-title">${mock.title}</div>
      <div class="exam-timer" id="examTimer">--:--</div>
      <button class="exam-submit" id="examSubmit">Submit</button>
    </div>
    <div id="examNav" class="qnav"></div>
    <div id="examHost"></div>
    <div style="text-align:center;margin-top:12px;color:var(--muted);font-size:13px">${mock.instructions}</div>`;
  $('#examLeave').onclick = () => { flushExamSave(); stopTicker(); openMocksList(); };
  $('#examSubmit').onclick = () => submitExam();
  renderExamNav();
  drawExamQuestion();
  startTicker();
  tickTimer();
}

function startTicker() {
  stopTicker();
  examState.tickHandle = setInterval(tickTimer, 1000);
}
function stopTicker() {
  if (examState && examState.tickHandle) { clearInterval(examState.tickHandle); examState.tickHandle = null; }
}

function tickTimer() {
  if (!examState) return;
  const { mock, st } = examState;
  if (!st || st.submittedAt) { stopTicker(); return; }
  const elapsed = Math.floor((Date.now() - st.startedAt) / 1000);
  const remain = mock.durationMin * 60 - elapsed;
  const t = $('#examTimer');
  if (!t) return;
  if (remain <= 0) {
    t.textContent = '00:00';
    t.className = 'exam-timer danger';
    stopTicker();
    toast('Time up — submitting paper');
    submitExam(true);
    return;
  }
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  t.textContent = `${mm}:${ss}`;
  t.className = 'exam-timer' + (remain <= 60 ? ' danger' : remain <= 300 ? ' warn' : '');
}

function renderExamNav() {
  const nav = $('#examNav');
  const st = examState.st;
  nav.innerHTML = '';
  examState.mock.questions.forEach((q, i) => {
    const b = el('button', 'qnum', String(i + 1));
    const chk = st && st.checks && st.checks[q.id];
    if (chk) b.classList.add('answered', chk.verdict);
    else if (st && st.answers[q.id] !== undefined && st.answers[q.id] !== '') b.classList.add('answered');
    if (i === examState.idx) b.classList.add('current');
    b.onclick = () => { flushExamSave(); examState.idx = i; drawExamQuestion(); };
    nav.appendChild(b);
  });
}

function drawExamQuestion() {
  const host = $('#examHost');
  const { mock, st, idx } = examState;
  const q = mock.questions[idx];
  if (!st.checks) st.checks = {};
  const saved = st.answers[q.id];
  const checked = st.checks[q.id];
  const card = el('div', 'q-card');
  card.appendChild(el('div', 'q-meta', `${q.topicTitle} · ${q.type === 'mcq' ? 'Multiple choice' : 'Short answer'}${q.marks ? ' · ' + q.marks + ' mark' + (q.marks > 1 ? 's' : '') : ''} · Q${idx + 1}/${mock.questions.length}`));
  card.appendChild(el('div', 'q-text', q.q));

  let optList = null;
  if (q.type === 'mcq') {
    optList = el('div', 'opt-list');
    q.options.forEach((opt, oi) => {
      const b = el('button', 'opt', opt);
      if (saved === oi) b.classList.add('chosen');
      if (!checked) {
        b.onclick = () => {
          st.answers[q.id] = oi;
          Mocks.put(mock.id, st);
          [...optList.children].forEach(c => c.classList.remove('chosen'));
          b.classList.add('chosen');
          renderExamNav();
        };
      } else {
        b.disabled = true;
        if (oi === q.answer) b.classList.add('correct');
        else if (oi === saved) b.classList.add('wrong');
      }
      optList.appendChild(b);
    });
    card.appendChild(optList);
  } else {
    const ta = el('textarea', 'short-input');
    ta.id = 'examShort';
    ta.placeholder = 'Write your answer here…';
    if (saved) ta.value = saved;
    if (checked) ta.disabled = true;
    let hadContent = !!(saved && String(saved).length);
    ta.oninput = () => {
      st.answers[q.id] = ta.value;     // in-memory: instant
      debouncedExamSave();              // localStorage: 400ms after she stops typing
      const has = ta.value.length > 0;
      if (has !== hadContent) {         // only rebuild the nav on answered/unanswered transition
        hadContent = has;
        renderExamNav();
      }
    };
    card.appendChild(ta);
  }

  const actions = el('div', 'q-actions');
  const prev = el('button', 'btn ghost', '← Prev'); prev.disabled = idx === 0;
  prev.onclick = () => { flushExamSave(); if (examState.idx > 0) { examState.idx--; drawExamQuestion(); renderExamNav(); } };
  actions.appendChild(prev);

  const checkBtn = el('button', 'btn', checked ? '✓ Checked' : '✓ Check answer');
  checkBtn.disabled = !!checked;
  checkBtn.onclick = () => checkExamAnswer(q, checkBtn);
  actions.appendChild(checkBtn);

  const hintBtn = el('button', 'btn ghost', '💡 Hint');
  hintBtn.onclick = () => {
    if (card.querySelector('.hint-box')) return;
    actions.insertAdjacentHTML('afterend', `<div class="hint-box"><b>Hint:</b> ${q.hint || 'Think about the key words from your study guide.'}</div>`);
  };
  actions.appendChild(hintBtn);

  const next = el('button', 'btn ghost', 'Next →'); next.disabled = idx >= mock.questions.length - 1;
  next.onclick = () => { flushExamSave(); if (examState.idx < mock.questions.length - 1) { examState.idx++; drawExamQuestion(); renderExamNav(); } };
  actions.appendChild(next);
  card.appendChild(actions);

  // Restore verdict UI when she has already pressed Check on this question.
  if (checked) {
    const labels = { correct: '✅ Correct', partial: '🟡 Partially correct', wrong: '❌ Not quite' };
    const v = el('div', 'verdict ' + checked.verdict);
    v.innerHTML = `<div class="vhead">${labels[checked.verdict] || checked.verdict}</div><div>${checked.feedback || ''}</div>`;
    if (checked.verdict !== 'correct' && checked.correctText) {
      v.insertAdjacentHTML('beforeend', `<div class="model-ans"><b>${q.type === 'mcq' ? 'Correct answer' : 'Model answer'}:</b> ${checked.correctText}</div>`);
    }
    card.appendChild(v);
  }

  host.innerHTML = ''; host.appendChild(card);
}

async function checkExamAnswer(q, btn) {
  flushExamSave();                   // make sure latest typing is captured
  const { mock, st } = examState;
  if (!st.checks) st.checks = {};
  const ans = st.answers[q.id];
  if (q.type === 'mcq') {
    if (ans === undefined || ans === '') { toast('Pick an option first.'); return; }
    const correct = ans === q.answer;
    st.checks[q.id] = {
      qid: q.id, type: 'mcq', q: q.q, topic: q.topicTitle,
      verdict: correct ? 'correct' : 'wrong',
      awarded: correct ? 1 : 0, maxMarks: 1,
      studentText: q.options[ans], correctText: q.options[q.answer],
      feedback: q.explanation || ''
    };
    Mocks.put(mock.id, st);
    drawExamQuestion();
    renderExamNav();
  } else {
    const text = (ans || '').trim();
    if (!text) { toast('Write your answer first.'); return; }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Marking…';
    const res = await Grader.gradeShort(q, text);
    const max = q.marks || 1;
    const awarded = res.verdict === 'correct' ? max : res.verdict === 'partial' ? Math.ceil(max / 2) : 0;
    st.checks[q.id] = {
      qid: q.id, type: 'short', q: q.q, topic: q.topicTitle, verdict: res.verdict,
      awarded, maxMarks: max, studentText: text, correctText: q.modelAnswer, feedback: res.feedback || ''
    };
    Mocks.put(mock.id, st);
    drawExamQuestion();
    renderExamNav();
  }
}

async function submitExam(auto) {
  if (submittingExam) return;
  flushExamSave();                   // capture any pending keystrokes
  const { mock, st } = examState;
  const answered = mock.questions.filter(q => st.answers[q.id] !== undefined && st.answers[q.id] !== '').length;
  if (!auto && answered < mock.questions.length) {
    if (!confirm(`You've answered ${answered} of ${mock.questions.length}. Submit anyway?`)) return;
  }
  submittingExam = true;
  stopTicker();
  const host = $('#examHost');
  host.innerHTML = `<div class="card" style="text-align:center"><p><span class="spinner"></span> Marking your paper… this can take ~30 seconds for short answers.</p></div>`;
  const perQuestion = await Promise.all(mock.questions.map(async (q) => {
    const already = st.checks && st.checks[q.id];
    if (already) return already;
    const ans = st.answers[q.id];
    if (q.type === 'mcq') {
      const chosen = (ans === undefined || ans === '') ? -1 : ans;
      const correct = chosen === q.answer;
      return {
        qid: q.id, type: 'mcq', q: q.q, topic: q.topicTitle,
        verdict: correct ? 'correct' : 'wrong',
        awarded: correct ? 1 : 0, maxMarks: 1,
        studentText: chosen >= 0 ? q.options[chosen] : '(not answered)',
        correctText: q.options[q.answer],
        feedback: q.explanation || ''
      };
    } else {
      const text = ans || '';
      const max = q.marks || 1;
      if (!text.trim()) {
        return { qid: q.id, type: 'short', q: q.q, topic: q.topicTitle, verdict: 'wrong',
          awarded: 0, maxMarks: max, studentText: '(not answered)', correctText: q.modelAnswer, feedback: 'No answer given.' };
      }
      const res = await Grader.gradeShort(q, text);
      const awarded = res.verdict === 'correct' ? max : res.verdict === 'partial' ? Math.ceil(max / 2) : 0;
      return { qid: q.id, type: 'short', q: q.q, topic: q.topicTitle, verdict: res.verdict,
        awarded, maxMarks: max, studentText: text, correctText: q.modelAnswer, feedback: res.feedback || '' };
    }
  }));
  const totalAwarded = perQuestion.reduce((s, r) => s + r.awarded, 0);
  const totalMax = perQuestion.reduce((s, r) => s + r.maxMarks, 0);
  const mcqResults = perQuestion.filter(r => r.type === 'mcq');
  st.submittedAt = Date.now();
  st.results = {
    perQuestion, totalAwarded, totalMax,
    mcqCount: mcqResults.length,
    mcqCorrect: mcqResults.filter(r => r.verdict === 'correct').length
  };
  Mocks.put(mock.id, st);
  submittingExam = false;
  showMockResults(mock, st);
}

function showMockResults(mock, st) {
  show('mocks');
  const r = st.results;
  const pct = Math.round((r.totalAwarded / r.totalMax) * 100);
  const elapsedMin = st.submittedAt && st.startedAt ? Math.round((st.submittedAt - st.startedAt) / 60000) : null;
  const body = $('#mocksBody');
  body.innerHTML = `
    <button class="back" id="resBack">← All mock papers</button>
    <div class="results-summary">
      <div style="font-size:14px;opacity:.85">${mock.title}</div>
      <div class="score">${r.totalAwarded} / ${r.totalMax}</div>
      <div class="pct">${pct}% · ${mock.paper === 1 ? `${r.mcqCorrect} of ${r.mcqCount} MCQs correct` : `${r.perQuestion.length} questions marked`}${elapsedMin != null ? ' · ' + elapsedMin + ' min' : ''}</div>
      <div class="detail"><button class="btn ghost" id="redoMock" style="margin-top:10px">Try again from scratch</button></div>
    </div>
    <div id="resList"></div>`;
  $('#resBack').onclick = openMocksList;
  $('#redoMock').onclick = () => {
    if (!confirm('Clear this attempt and start again?')) return;
    Mocks.del(mock.id);
    startMock(mock.id);
  };
  const list = $('#resList');
  r.perQuestion.forEach((row, i) => {
    const item = el('div', 'result-item ' + row.verdict);
    const verdictLabel = { correct: '✅ Correct', partial: '🟡 Partial', wrong: '❌ Wrong' }[row.verdict];
    item.innerHTML = `
      <div class="rhead"><span>Q${i + 1} · ${row.topic} · ${row.awarded}/${row.maxMarks}</span><span class="rverdict ${row.verdict}">${verdictLabel}</span></div>
      <div class="rq">${row.q}</div>
      <div class="ryour"><b>Your answer:</b> ${row.studentText}</div>
      ${row.verdict !== 'correct' ? `<div class="rcorrect"><b>${row.type === 'mcq' ? 'Correct answer' : 'Model answer'}:</b> ${row.correctText}</div>` : ''}
      ${row.feedback ? `<div class="rfeedback">${row.feedback}</div>` : ''}`;
    list.appendChild(item);
  });
}

// ---------- wiring ----------
document.querySelectorAll('.mode-tabs .tab').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('[data-go="home"]').forEach(b => b.onclick = renderHome);
$('#homeBtn').onclick = renderHome;
$('#mocksCard').onclick = openMocksList;

renderCountdown();
renderHome();
