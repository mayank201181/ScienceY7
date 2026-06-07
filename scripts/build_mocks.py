"""Build content/mocks.json — eight mock exams composed from the topic bank.

Output is deterministic (fixed random seeds) so each mock is the same set of
questions every time, letting Vanshika compare scores across attempts.

Paper 1 mocks: 60 MCQs, 45 min, balanced across topics. (Eight in total.)
Paper 2 mocks: short-answer questions totalling ~45 marks, 45 min. (Four.)

Run from the project root:
    python3 scripts/build_mocks.py
"""
import json
import os
import random
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")

TOPIC_CODES = []
TOPIC_TITLES = {}
QUESTIONS_BY_CODE = {}

idx = json.load(open(os.path.join(CONTENT, "index.json")))
for t in idx["topics"]:
    code = t["code"]
    TOPIC_CODES.append(code)
    TOPIC_TITLES[code] = t["title"]
    QUESTIONS_BY_CODE[code] = json.load(open(os.path.join(CONTENT, f"{code}.json")))["questions"]


def denormalise(q, code):
    """Return a self-contained question dict tagged with its topic."""
    out = dict(q)
    out["topicCode"] = code
    out["topicTitle"] = TOPIC_TITLES[code]
    return out


def gather(qtype):
    out = []
    for code in TOPIC_CODES:
        for q in QUESTIONS_BY_CODE[code]:
            if q["type"] == qtype:
                out.append(denormalise(q, code))
    return out


def build_paper1():
    """8 mocks × 60 MCQs, balanced across topics."""
    pool = gather("mcq")  # ~135-145 MCQs
    mocks = []
    for n in range(8):
        rng = random.Random(100 + n)
        # bucket by topic, then take a slice with a different rotation each mock
        by_topic = {c: [q for q in pool if q["topicCode"] == c] for c in TOPIC_CODES}
        for c in TOPIC_CODES:
            rng.shuffle(by_topic[c])
        # round-robin draw across topics until we have 60
        paper, topics_q = [], {c: list(by_topic[c]) for c in TOPIC_CODES}
        while len(paper) < 60:
            progressed = False
            for c in TOPIC_CODES:
                if topics_q[c] and len(paper) < 60:
                    paper.append(topics_q[c].pop(0))
                    progressed = True
            if not progressed:
                # not enough unique → allow reuse by reseeding from full pool
                refill = list(pool)
                rng.shuffle(refill)
                paper.extend(refill[: 60 - len(paper)])
                break
        rng.shuffle(paper)
        mocks.append({
            "id": f"P1-mock{n + 1}",
            "paper": 1,
            "title": f"Paper 1 — Mock {n + 1}",
            "durationMin": 45,
            "totalQuestions": len(paper),
            "instructions": "60 multiple-choice questions. Answer all. 45 minutes. 1 mark each.",
            "questions": paper,
        })
    return mocks


def build_paper2():
    """4 mocks × ~45 marks of short-answer, balanced across topics."""
    pool = gather("short")  # ~120 shorts with various marks
    mocks = []
    for n in range(4):
        rng = random.Random(300 + n)
        by_topic = {c: [q for q in pool if q["topicCode"] == c] for c in TOPIC_CODES}
        for c in TOPIC_CODES:
            rng.shuffle(by_topic[c])
        paper, marks = [], 0
        # Round-robin pick, stop when we hit ~45 marks
        guard = 0
        while marks < 45 and guard < 50:
            progressed = False
            for c in TOPIC_CODES:
                if marks >= 45:
                    break
                if by_topic[c]:
                    q = by_topic[c].pop(0)
                    m = q.get("marks", 1)
                    if marks + m <= 48:  # small overshoot tolerated
                        paper.append(q)
                        marks += m
                        progressed = True
            if not progressed:
                break
            guard += 1
        rng.shuffle(paper)
        mocks.append({
            "id": f"P2-mock{n + 1}",
            "paper": 2,
            "title": f"Paper 2 — Mock {n + 1}",
            "durationMin": 45,
            "totalQuestions": len(paper),
            "totalMarks": marks,
            "instructions": f"Short-answer + skills questions. Total {marks} marks. 45 minutes.",
            "questions": paper,
        })
    return mocks


def main():
    mocks = build_paper1() + build_paper2()
    out_path = os.path.join(CONTENT, "mocks.json")
    with open(out_path, "w") as f:
        json.dump({"mocks": mocks}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {out_path}")
    for m in mocks:
        extra = f", marks={m.get('totalMarks')}" if m["paper"] == 2 else ""
        print(f"  {m['id']}: {len(m['questions'])} questions{extra}")


if __name__ == "__main__":
    main()
