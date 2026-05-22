// Serverless endpoint that generates extra practice questions with Claude
// (Vercel Node runtime). Returns new questions in the same JSON schema the app
// uses, so the bank can grow on demand. Requires ANTHROPIC_API_KEY.

const MODEL = process.env.GENERATOR_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM =
  "You are a Year 7 (age 11-12) science teacher writing exam-style practice " +
  "questions for the IGCSE pathway. Match the requested topic and difficulty. " +
  "Mix multiple-choice and short-answer questions. Questions must be accurate, " +
  "age-appropriate and clearly worded. " +
  "Reply with ONLY a JSON array (no prose, no code fences). Each item is an object:\n" +
  'MCQ:   {"type":"mcq","level":"<level>","q":"...","options":["a","b","c","d"],"answer":<index 0-3>,"explanation":"...","hint":"..."}\n' +
  'SHORT: {"type":"short","level":"<level>","q":"...","modelAnswer":"...","keywords":["..."],"marks":<1-6>,"hint":"...","examMistake":"..."}\n' +
  "Keywords are the key ideas a correct short answer must contain. Make every " +
  "question different from any examples given.";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only", questions: [] });

  let p = req.body;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = {}; } }
  if (!p) p = {};

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ error: "AI generation needs ANTHROPIC_API_KEY to be set on the server.", questions: [] });

  const level = p.level || "basic";
  const count = Math.min(parseInt(p.count || 5, 10), 10);
  const examples = (p.examples || []).slice(0, 3);

  const user =
    `Topic: ${p.topicTitle || "science"}\n` +
    `Difficulty level: ${level}\n` +
    `Write ${count} new ${level}-level questions for this topic.\n` +
    `Here are example questions already in the bank (do not repeat them):\n` +
    `${JSON.stringify(examples).slice(0, 1500)}\n\nReturn the JSON array now.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    const clean = [];
    arr.forEach((q, i) => {
      if (q.type !== "mcq" && q.type !== "short") return;
      q.level = level;
      q.id = `AI-${level[0].toUpperCase()}-${Date.now()}-${i}`;
      clean.push(q);
    });
    return res.status(200).json({ questions: clean });
  } catch (e) {
    return res.status(200).json({ error: `Could not generate questions (${e}).`, questions: [] });
  }
}
