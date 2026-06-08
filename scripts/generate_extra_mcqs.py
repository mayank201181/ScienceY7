"""Generate fresh MCQs across all 9 topics by calling the deployed Vercel
/api/generate endpoint (which already holds the Claude API key). Save the
results to content/mocks_extra_questions.json. These are used by
build_mocks.py to assemble extra Paper-1 mock papers (Mocks 9-12) whose
questions don't overlap with Mocks 1-8.

Run from the project root:
    python3 scripts/generate_extra_mcqs.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

ENDPOINT = os.environ.get(
    "GENERATE_ENDPOINT",
    "https://vanshikascience.vercel.app/api/generate"
)


def call_generate(topic_title, examples, level, count):
    """POST to the deployed /api/generate endpoint."""
    body = json.dumps({
        "topicTitle": topic_title,
        "level": level,
        "count": min(count, 10),  # endpoint caps at 10
        "examples": examples,
    }).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
    if data.get("error"):
        raise ValueError(data["error"])
    return data.get("questions", [])


def main():
    idx = json.load(open(os.path.join(CONTENT, "index.json")))
    out_path = os.path.join(CONTENT, "mocks_extra_questions.json")
    # Resume: load any previously saved progress.
    if os.path.exists(out_path):
        out = json.load(open(out_path))
        out.setdefault("topics", {})
        print(f"Resuming — already have: {[k for k in out['topics']]}", flush=True)
    else:
        out = {"topics": {}}
    grand_total = sum(len(v) for v in out["topics"].values())

    for t in idx["topics"]:
        code = t["code"]
        title = t["title"]
        if code in out["topics"] and len(out["topics"][code]) >= 30:
            print(f"  {code}: already have {len(out['topics'][code])}, skipping", flush=True)
            continue
        bank = json.load(open(os.path.join(CONTENT, f"{code}.json")))["questions"]
        existing_mcqs = [q for q in bank if q["type"] == "mcq"]

        per_level = [("basic", 12), ("intermediate", 10), ("advanced", 8)]
        new_qs = []
        for level, count in per_level:
            samples = [q for q in existing_mcqs if q["level"] == level][:3]
            got_for_level = []
            attempts = 0
            # endpoint caps at 10 and returns a mix; keep calling until we have enough MCQs
            while len(got_for_level) < count and attempts < 8:
                attempts += 1
                try:
                    raw = call_generate(title, samples, level, 10)
                except Exception as e:
                    print(f"  {code} {level} call failed: {e}", file=sys.stderr)
                    time.sleep(3)
                    continue
                clean = [q for q in raw if isinstance(q, dict)
                        and q.get("type") == "mcq"
                        and isinstance(q.get("options"), list) and len(q["options"]) == 4
                        and isinstance(q.get("answer"), int) and 0 <= q["answer"] <= 3
                        and q.get("q")]
                for q in clean:
                    q["level"] = level
                got_for_level.extend(clean)
            got_for_level = got_for_level[:count]
            new_qs.extend(got_for_level)
            print(f"  {code} {level}: {len(got_for_level)}/{count} ({attempts} call(s))", flush=True)

        for i, q in enumerate(new_qs):
            q["id"] = f"{code}-X-{i + 1}"
            q["topicCode"] = code
            q["topicTitle"] = title
        out["topics"][code] = new_qs
        grand_total += len(new_qs)
        # Checkpoint after every topic so a kill doesn't lose progress.
        with open(out_path, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print(f"  {code}: total {len(new_qs)}  (checkpoint saved, {grand_total} so far)", flush=True)

    print(f"\nDone — {grand_total} fresh MCQs across {len(out['topics'])} topics in {out_path}", flush=True)


if __name__ == "__main__":
    main()
