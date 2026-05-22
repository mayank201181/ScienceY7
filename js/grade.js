// Grading client.
// MCQ is graded instantly in the browser.
// Short-answer is sent to /api/grade (Claude). If that endpoint is unavailable
// (e.g. opened as a bare file with no backend), we fall back to a local
// keyword-coverage heuristic so the app still works offline.
const Grader = (() => {

  function gradeMCQ(question, chosenIndex) {
    const correct = chosenIndex === question.answer;
    return {
      verdict: correct ? 'correct' : 'wrong',
      feedback: correct
        ? 'Correct! ' + (question.explanation || '')
        : 'Not quite. ' + (question.explanation || ''),
      correctIndex: question.answer
    };
  }

  // Local fallback: how many model keywords appear in the answer.
  function localShortGrade(question, answer) {
    const kws = (question.keywords || []).map(k => k.toLowerCase());
    const a = (answer || '').toLowerCase();
    if (!a.trim()) return { verdict: 'wrong', feedback: 'You did not write an answer yet.', offline: true };
    if (!kws.length) {
      return { verdict: 'partial', feedback: 'Compare your answer to the model answer below.', offline: true };
    }
    const hit = kws.filter(k => a.includes(k));
    const ratio = hit.length / kws.length;
    let verdict = 'wrong';
    if (ratio >= 0.7) verdict = 'correct';
    else if (ratio >= 0.34) verdict = 'partial';
    const missing = kws.filter(k => !a.includes(k));
    let fb = `You included ${hit.length} of ${kws.length} key ideas.`;
    if (missing.length) fb += ` Missing: ${missing.join(', ')}.`;
    return { verdict, feedback: fb, offline: true };
  }

  async function gradeShort(question, answer) {
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.q,
          modelAnswer: question.modelAnswer,
          keywords: question.keywords || [],
          marks: question.marks || 1,
          studentAnswer: answer
        })
      });
      if (!res.ok) throw new Error('grade endpoint ' + res.status);
      const data = await res.json();
      if (!data || !data.verdict) throw new Error('bad grade response');
      return data; // { verdict, feedback }
    } catch (e) {
      const local = localShortGrade(question, answer);
      local.feedback = local.feedback + ' (offline check — connect AI grading for smarter marking.)';
      return local;
    }
  }

  return { gradeMCQ, gradeShort };
})();
