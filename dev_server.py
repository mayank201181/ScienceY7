"""Local dev server: serves the static site and the /api/grade endpoint.

Run:  source .venv/bin/activate && python dev_server.py
Then open http://localhost:8000

If ANTHROPIC_API_KEY is set in your environment, short-answer grading uses
Claude; otherwise it falls back to the offline keyword heuristic.
"""
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

_HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(_HERE)  # serve the site regardless of where we're launched from
sys.path.insert(0, os.path.join(_HERE, "api"))
from grade import grade  # noqa: E402
from generate import generate  # noqa: E402

PORT = int(os.environ.get("PORT", 8000))


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        route = self.path.rstrip("/")
        if route in ("/api/grade", "/api/generate"):
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
                result = grade(payload) if route == "/api/grade" else generate(payload)
            except Exception as e:  # noqa: BLE001
                result = {"verdict": "partial", "feedback": "Server hiccup.", "questions": [], "error": str(e)}
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    key = "set ✅" if os.environ.get("ANTHROPIC_API_KEY") else "NOT set (offline keyword grading)"
    print(f"Serving http://localhost:{PORT}  ·  ANTHROPIC_API_KEY {key}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
