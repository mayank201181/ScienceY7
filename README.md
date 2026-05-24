# Vanshika's Year 7 Science Revision

An interactive revision website for the Year 7 (Tanglin, IGCSE pathway) science
exams: **Paper 1 — Fri 12 June** (60 MCQs) and **Paper 2 — Tue 16 June** (short
answer + skills).

**Live site: https://vanshikascience.vercel.app** (hosted on Vercel; share freely).

The repo on GitHub at <https://github.com/mayank201181/ScienceY7> is connected to
Vercel — every push to `main` auto-deploys to the live site.

Each of the **9 topics** has:

- **Study Guide** — concepts explained simply, with diagrams and memory tricks (mnemonics)
- **Flashcards** — flip cards for the key terms
- **Quiz** — questions at three levels (Basic / Intermediate / Advanced), with a
  **Hint** button, a verdict of **correct / partially correct / wrong**, a model
  answer, and a "common exam mistake" note
- **Exam Mistakes** — a list of the classic slip-ups for that topic
- **✨ Generate more practice** — asks the AI to write fresh questions on demand

**Topics:** Introduction to Science · Cells to Systems · Matter and Separation ·
Electricity and Energy · Ecological Interactions · The Particle Model ·
Reproduction and Variation · Waves and Sound · Atoms and Elements.

The starter bank has **270 questions + 144 flashcards** (30 questions per topic),
and the "Generate more practice" button extends each topic toward 100+ on demand.

---

## How the AI marking works

- **Multiple-choice** questions are marked instantly in the browser (no internet needed).
- **Short-answer** questions are sent to a tiny serverless function (`api/grade.js`)
  that asks Claude to mark them as correct / partial / wrong with friendly feedback.
- If the AI isn't connected, short answers fall back to an offline keyword check so
  the app still works — it just won't be as clever.

The Claude API key lives **only** on the server (an environment variable), never in
the browser.

---

## Run it on your Mac (local preview)

```bash
cd ~/vanshika_science
python dev_server.py
```

Then open **http://localhost:8000**. This is a static preview: short answers use the
offline keyword check locally (the browser falls back automatically).

To test the *real* Claude marking locally too, use Vercel's dev server, which runs
the `api/*.js` functions with your key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
npx vercel dev
```

---

## Deploying updates (Vercel — already set up)

The site is already deployed at **https://vanshikascience.vercel.app** and the
project is linked. To push any change live:

```bash
cd ~/vanshika_science
npx vercel --prod
```

The serverless functions are Node (`api/grade.js`, `api/generate.js`), which Vercel
auto-detects with no extra config. The large `data/` folder (source PDF + page
images) is excluded from uploads by `.vercelignore`.

### The Claude API key

AI marking and question generation read `ANTHROPIC_API_KEY` from the Vercel project
settings (never the browser). To set or rotate it:

```bash
npx vercel env add ANTHROPIC_API_KEY production   # paste the key at the value prompt
npx vercel --prod                                 # redeploy to pick it up
```

> Getting a Claude API key: sign in at **console.anthropic.com**, go to **API Keys**,
> create one, and add a small amount of credit. Marking a short answer costs a
> fraction of a cent (it uses the fast, cheap Haiku model). Keep the key private —
> never paste it into a chat or commit it.

---

## Editing or adding content

All the learning content is plain text files in **`content/`** — one JSON file per
topic (e.g. `WS.json` for Waves and Sound), plus `index.json` listing the topics.

A question looks like this:

```json
{ "level": "basic", "type": "mcq", "q": "What is needed to make a sound?",
  "options": ["A vacuum", "A vibration", "A magnet", "Light"], "answer": 1,
  "explanation": "All sounds are made by something vibrating.", "hint": "Think of a guitar string." }
```

```json
{ "level": "intermediate", "type": "short", "q": "Explain why there is no sound in space.",
  "modelAnswer": "Space is a vacuum with no particles ...", "keywords": ["vacuum", "no particles"],
  "marks": 2, "hint": "What does sound need?", "examMistake": "Saying it's 'too cold'." }
```

Add as many as you like — the app picks them up automatically. (For MCQ, `answer` is
the position of the correct option, starting at 0.)

---

## What's in the folders

```
index.html          the page
css/styles.css      styling
js/                 app logic (app.js), content loader, grading client
content/*.json      the study guides, flashcards, mistakes and questions
api/grade.js        AI marking (serverless, Node)
api/generate.js     AI "generate more questions" (serverless, Node)
dev_server.py       local static preview server for your Mac
.vercelignore       keeps the big data/ folder out of deploys
```

## A note on accuracy

Content is written to the standard Year 7 / IGCSE-pathway scope and the school's
own skills organiser. Always double-check anything that looks off against her
textbook (Longman Biology / Chemistry / Physics) — and tell me if a topic needs
re-weighting toward what her class actually covered.
