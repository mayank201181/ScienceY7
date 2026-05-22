"""Serverless grading endpoint (Vercel Python runtime).

Receives a student's free-text answer and grades it with the Claude API as
correct / partial / wrong, with short kid-friendly feedback. The API key is
read from the ANTHROPIC_API_KEY environment variable (set in the host's
project settings — never in the browser).

The core grade() function is also imported by dev_server.py for local testing.
"""
import json
import os
import urllib.request
import urllib.error

MODEL = os.environ.get("GRADER_MODEL", "claude-haiku-4-5-20251001")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

SYSTEM = (
    "You are a kind, encouraging Year 7 science teacher marking a 12-year-old's "
    "answer. Compare the student's answer to the model answer and the key ideas. "
    "Decide if it is 'correct' (all key ideas present), 'partial' (some key ideas, "
    "or right idea but incomplete/imprecise), or 'wrong' (missing the point). "
    "Be generous with phrasing and spelling — reward understanding, not wording. "
    "Give one or two short sentences of warm, specific feedback: praise what is right "
    "and name exactly what to add. Do not reveal the full model answer. "
    "Reply ONLY with compact JSON: {\"verdict\":\"correct|partial|wrong\",\"feedback\":\"...\"}"
)


def _heuristic(payload):
    """Offline fallback if no API key is configured."""
    kws = [k.lower() for k in payload.get("keywords", [])]
    ans = (payload.get("studentAnswer") or "").lower()
    if not ans.strip():
        return {"verdict": "wrong", "feedback": "You haven't written an answer yet — give it a try!"}
    if not kws:
        return {"verdict": "partial", "feedback": "Compare your answer with the model answer below."}
    hit = [k for k in kws if k in ans]
    ratio = len(hit) / len(kws)
    verdict = "correct" if ratio >= 0.7 else "partial" if ratio >= 0.34 else "wrong"
    missing = [k for k in kws if k not in ans]
    fb = f"You included {len(hit)} of {len(kws)} key ideas."
    if missing:
        fb += " Try to also mention: " + ", ".join(missing) + "."
    return {"verdict": verdict, "feedback": fb}


def grade(payload):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _heuristic(payload)

    user = (
        f"Question: {payload.get('question','')}\n"
        f"Marks available: {payload.get('marks',1)}\n"
        f"Key ideas the answer should contain: {', '.join(payload.get('keywords', [])) or '(none given)'}\n"
        f"Model answer: {payload.get('modelAnswer','')}\n"
        f"Student's answer: {payload.get('studentAnswer','')}\n\n"
        "Mark it now."
    )
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 300,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": user}],
    }).encode()

    req = urllib.request.Request(ANTHROPIC_URL, data=body, method="POST")
    req.add_header("x-api-key", key)
    req.add_header("anthropic-version", "2023-06-01")
    req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode())
        text = "".join(b.get("text", "") for b in data.get("content", [])).strip()
        # tolerate code fences or stray prose around the JSON
        start, end = text.find("{"), text.rfind("}")
        parsed = json.loads(text[start:end + 1])
        verdict = parsed.get("verdict", "partial")
        if verdict not in ("correct", "partial", "wrong"):
            verdict = "partial"
        return {"verdict": verdict, "feedback": parsed.get("feedback", "")}
    except (urllib.error.URLError, ValueError, KeyError, json.JSONDecodeError):
        return _heuristic(payload)


# ----- Vercel handler -----
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_OPTIONS(self):
        self._send(200, {})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._send(200, grade(payload))
        except Exception as e:  # noqa: BLE001 — never 500 silently to a kid mid-quiz
            self._send(200, {"verdict": "partial", "feedback": "Grader hiccup — check the model answer below.", "error": str(e)})
