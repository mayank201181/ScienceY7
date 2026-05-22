// Serverless grading endpoint (Vercel Node runtime).
// Marks a student's free-text answer as correct / partial / wrong with Claude.
// The API key is read from the ANTHROPIC_API_KEY environment variable
// (set in the Vercel project settings — never in the browser).

const MODEL = process.env.GRADER_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM =
  "You are a kind, encouraging Year 7 science teacher marking a 12-year-old's " +
  "answer. Compare the student's answer to the model answer and the key ideas. " +
  "Decide if it is 'correct' (all key ideas present), 'partial' (some key ideas, " +
  "or right idea but incomplete/imprecise), or 'wrong' (missing the point). " +
  "Be generous with phrasing and spelling — reward understanding, not wording. " +
  "Give one or two short sentences of warm, specific feedback: praise what is right " +
  "and name exactly what to add. Do not reveal the full model answer. " +
  'Reply ONLY with compact JSON: {"verdict":"correct|partial|wrong","feedback":"..."}';

function heuristic(p) {
  const kws = (p.keywords || []).map((k) => k.toLowerCase());
  const ans = (p.studentAnswer || "").toLowerCase();
  if (!ans.trim()) return { verdict: "wrong", feedback: "You haven't written an answer yet — give it a try!" };
  if (!kws.length) return { verdict: "partial", feedback: "Compare your answer with the model answer below." };
  const hit = kws.filter((k) => ans.includes(k));
  const ratio = hit.length / kws.length;
  const verdict = ratio >= 0.7 ? "correct" : ratio >= 0.34 ? "partial" : "wrong";
  const missing = kws.filter((k) => !ans.includes(k));
  let fb = `You included ${hit.length} of ${kws.length} key ideas.`;
  if (missing.length) fb += " Try to also mention: " + missing.join(", ") + ".";
  return { verdict, feedback: fb };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ verdict: "partial", feedback: "POST only." });

  let p = req.body;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = {}; } }
  if (!p) p = {};

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json(heuristic(p));

  const user =
    `Question: ${p.question || ""}\n` +
    `Marks available: ${p.marks || 1}\n` +
    `Key ideas the answer should contain: ${(p.keywords || []).join(", ") || "(none given)"}\n` +
    `Model answer: ${p.modelAnswer || ""}\n` +
    `Student's answer: ${p.studentAnswer || ""}\n\nMark it now.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, system: SYSTEM, messages: [{ role: "user", content: user }] }),
    });
    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    let verdict = parsed.verdict;
    if (!["correct", "partial", "wrong"].includes(verdict)) verdict = "partial";
    return res.status(200).json({ verdict, feedback: parsed.feedback || "" });
  } catch (e) {
    return res.status(200).json(heuristic(p));
  }
}
