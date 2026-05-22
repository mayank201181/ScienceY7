"""Serverless endpoint that generates extra practice questions with Claude.

Given a topic and level, it returns a few new questions in exactly the same
JSON schema the app uses, so they slot straight into the quiz. This lets the
question bank grow on demand toward (and beyond) ~100 per topic without anyone
hand-writing them. Requires ANTHROPIC_API_KEY (same key as grading).

The core generate() function is also imported by dev_server.py for local use.
"""
import json
import os
import urllib.request
import urllib.error

MODEL = os.environ.get("GENERATOR_MODEL", "claude-haiku-4-5-20251001")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

SYSTEM = (
    "You are a Year 7 (age 11-12) science teacher writing exam-style practice "
    "questions for the IGCSE pathway. Match the requested topic and difficulty. "
    "Mix multiple-choice and short-answer questions. Questions must be accurate, "
    "age-appropriate and clearly worded. "
    "Reply with ONLY a JSON array (no prose, no code fences). Each item is an object:\n"
    "MCQ:   {\"type\":\"mcq\",\"level\":\"<level>\",\"q\":\"...\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"answer\":<index 0-3>,\"explanation\":\"...\",\"hint\":\"...\"}\n"
    "SHORT: {\"type\":\"short\",\"level\":\"<level>\",\"q\":\"...\",\"modelAnswer\":\"...\",\"keywords\":[\"...\"],\"marks\":<1-6>,\"hint\":\"...\",\"examMistake\":\"...\"}\n"
    "Keywords are the key ideas a correct short answer must contain. Make every "
    "question different from any examples given."
)


def generate(payload):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return {"error": "AI generation needs ANTHROPIC_API_KEY to be set on the server.", "questions": []}

    topic = payload.get("topicTitle", "science")
    level = payload.get("level", "basic")
    count = min(int(payload.get("count", 5)), 10)
    examples = payload.get("examples", [])[:3]

    user = (
        f"Topic: {topic}\n"
        f"Difficulty level: {level}\n"
        f"Write {count} new {level}-level questions for this topic.\n"
        f"Here are example questions already in the bank (do not repeat them):\n"
        f"{json.dumps(examples)[:1500]}\n\n"
        "Return the JSON array now."
    )
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 2000,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": user}],
    }).encode()

    req = urllib.request.Request(ANTHROPIC_URL, data=body, method="POST")
    req.add_header("x-api-key", key)
    req.add_header("anthropic-version", "2023-06-01")
    req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read().decode())
        text = "".join(b.get("text", "") for b in data.get("content", [])).strip()
        start, end = text.find("["), text.rfind("]")
        questions = json.loads(text[start:end + 1])
        clean = []
        for i, q in enumerate(questions):
            if q.get("type") not in ("mcq", "short"):
                continue
            q["level"] = level
            q["id"] = f"AI-{level[0].upper()}-{i}"
            clean.append(q)
        return {"questions": clean}
    except (urllib.error.URLError, ValueError, KeyError, json.JSONDecodeError) as e:
        return {"error": f"Could not generate questions ({e}).", "questions": []}


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
            self._send(200, generate(payload))
        except Exception as e:  # noqa: BLE001
            self._send(200, {"error": str(e), "questions": []})
