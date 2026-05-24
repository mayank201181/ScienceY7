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

// ---------- wiring ----------
document.querySelectorAll('.mode-tabs .tab').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('[data-go="home"]').forEach(b => b.onclick = renderHome);
$('#homeBtn').onclick = renderHome;

renderCountdown();
renderHome();
