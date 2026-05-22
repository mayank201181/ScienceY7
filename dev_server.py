"""Local dev server: serves the static site for quick previewing on your Mac.

Run:  python dev_server.py   →  open http://localhost:8000

This serves the static files only. Short-answer grading falls back to the
offline keyword check locally (the browser handles that automatically).
To test the real Claude-powered grading locally, use the Vercel dev server
instead:  npx vercel dev   (it runs the api/*.js functions with your key).
"""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", 8000))


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving http://localhost:{PORT}  (static preview; AI grading runs in production)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
